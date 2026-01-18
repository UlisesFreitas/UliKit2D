import { Graphics, Container, Point } from 'pixi.js';
import { useEditorStore } from '../../stores/useEditorStore';
import { world, type Entity } from '../../engine/ecs/ECS';
import { instance as engine } from '../../engine/core/Engine';
import { eventBus } from '../../engine/core/EventBus';

type HandleType = 'center' | 'rotate' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null;

interface EntityStartState {
    id: string;
    x: number; y: number;
    scaleX: number; scaleY: number;
    rotation: number;
    // Bounds relative to (0,0) (Pivot)
    lbX: number; lbY: number; 
    width: number; height: number;
}

export class GizmoManager {
    private container: Container;
    
    // Multi-Selection State
    private selectedEntities: Entity[] = [];
    private primaryEntity: Entity | null = null;
    
    private gizmoGraphics: Graphics;
    
    // Interaction State
    private isDragging: boolean = false;
    public dragHandle: HandleType = null;
    private dragStartPos: Point = new Point();
    
    // Snapshot state (Map ID -> StartState)
    private startStates: Map<string, EntityStartState> = new Map();
    
    public snapToGrid: boolean = false; 
    public getGridSizeCallback: ((layerId: string) => { x: number, y: number } | undefined) | null = null;
    
    public hoverHandle: HandleType = null;
    private storeUnsub: () => void;
    
    // Constants
    private readonly HANDLE_SIZE = 12;

    constructor() {
        this.container = new Container();
        this.container.zIndex = 9999; 
        this.container.label = 'Gizmo Overlay';
        
        // Auto-add to stage if valid. 
        if (engine.app && engine.app.stage) {
            engine.app.stage.addChild(this.container);
        }

        this.gizmoGraphics = new Graphics();
        this.container.addChild(this.gizmoGraphics);
        this.gizmoGraphics.eventMode = 'none'; // Passthrough
        
        this.storeUnsub = () => {}; 
        
        // Bind Render
        engine.onRender = () => {
             if (this.gizmoGraphics && !this.gizmoGraphics.destroyed) {
                 this.render();
             }
        };
    }

    public init() {
         // Re-check stage Parenting
        if (engine.app && engine.app.stage && this.container.parent !== engine.app.stage) {
            engine.app.stage.addChild(this.container);
        }

        // Subscribe to Store
        const store = useEditorStore();
        this.storeUnsub = store.$subscribe((_, state) => {
            const ids = state.selectedEntityIds || (state.selectedEntityId ? [state.selectedEntityId] : []);
            
            // Filter valid entities from world
            this.selectedEntities = ids
                .map(id => world.with('id', 'transform').where(e => e.id === id).first)
                .filter(e => e !== undefined && e.transform !== undefined) as Entity[];
                
            // Primary is usually the last selected or explicitly 'selectedEntityId'
            const primaryId = state.selectedEntityId;
            this.primaryEntity = this.selectedEntities.find(e => e.id === primaryId) || this.selectedEntities[0] || null;

            this.render();
        });
    }

    public dispose() {
        if (this.storeUnsub) this.storeUnsub();
        if (this.container && !this.container.destroyed) {
            this.container.destroy({ children: true });
        }
    }

    // --- Interaction API ---

    public processPointerDown(screenX: number, screenY: number): boolean {
        if (!this.primaryEntity) return false;

        // Use GLOBAL coordinates for Hit Test directly (Checks only Primary Gizmo handles)
        const handle = this.getHitHandleGlobal(screenX, screenY);

        if (handle) {
            this.isDragging = true;
            this.dragHandle = handle;
            
            const localPos = this.container.toLocal(new Point(screenX, screenY));
            this.dragStartPos.set(localPos.x, localPos.y);
            
            // Capture Start State for ALL Selected Entities
            this.startStates.clear();
            
            this.selectedEntities.forEach(entity => {
                 if (!entity.transform || !entity.id) return;

                 const t = entity.transform;
                 const displayObject = engine.renderSystem.getDisplayObject(entity.id);
                 const localBounds = displayObject ? displayObject.getLocalBounds() : { x: 0, y: 0, width: 1, height: 1 };
                 
                 this.startStates.set(entity.id, {
                    id: entity.id,
                    x: t.x,
                    y: t.y,
                    scaleX: t.scale.x,
                    scaleY: t.scale.y,
                    rotation: t.rotation,
                    lbX: localBounds.x,
                    lbY: localBounds.y,
                    width: localBounds.width,
                    height: localBounds.height
                 });
            });

            return true;
        }
        return false;
    }

    public processPointerMove(screenX: number, screenY: number, shiftKey: boolean = false) {
        if (!this.primaryEntity) return;

        // Global for Hit Test, Local for Drag Math
        const globalPos = new Point(screenX, screenY);
        const localPos = this.container.toLocal(globalPos);

        if (this.isDragging) {
            this.handleDragMove(localPos, shiftKey);
        } else {
             const hit = this.getHitHandleGlobal(screenX, screenY);
             if (hit !== this.hoverHandle) {
                this.hoverHandle = hit;
            }
        }
    }

    public processPointerUp() {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragHandle = null;
            // Emit change end for all
            if (this.primaryEntity && this.primaryEntity.id) {
                eventBus.emit('entity-change-end', this.primaryEntity.id);
            }
        }
    }

    private handleDragMove(localPos: Point, shiftKey: boolean) {
        if (!this.isDragging || !this.dragHandle) return;

        const dx = localPos.x - this.dragStartPos.x;
        const dy = localPos.y - this.dragStartPos.y;

        // --- MOVE OPERATION (Supports Multi-Select) ---
        if (this.dragHandle === 'center') {
            this.selectedEntities.forEach(entity => {
                if (!entity.id || !entity.transform) return;

                const start = this.startStates.get(entity.id);
                if (!start) return;

                let tx = start.x + dx;
                let ty = start.y + dy;

                if (this.snapToGrid && this.getGridSizeCallback) {
                    const gridSize = this.getGridSizeCallback(entity.layer || 'Base Layer');
                    if (gridSize) {
                        tx = Math.round(tx / gridSize.x) * gridSize.x;
                        ty = Math.round(ty / gridSize.y) * gridSize.y;
                    }
                }
                
                entity.transform.x = tx;
                entity.transform.y = ty;
                eventBus.emit('entity-change', entity.id);
            });
            return;
        }

        // --- SCALE / ROTATE (Primary Only) ---
        const entity = this.primaryEntity;
        if (!entity || !entity.id || !entity.transform) return;
        
        const start = this.startStates.get(entity.id);
        if (!start) return;

        if (this.dragHandle === 'rotate') {
             const displayObject = engine.renderSystem.getDisplayObject(entity.id);
             if (displayObject && displayObject.parent) {
                  const globalCenter = displayObject.toGlobal(new Point(0,0)); 
                  const localCenter = this.container.toLocal(globalCenter);
                  
                  const angle = Math.atan2(localPos.y - localCenter.y, localPos.x - localCenter.x);
                  let newRotation = angle + Math.PI / 2; // -90 offset

                  if (this.snapToGrid || shiftKey) { 
                      const snapRad = Math.PI / 12; // 15 deg
                      newRotation = Math.round(newRotation / snapRad) * snapRad;
                  }
                  
                  entity.transform.rotation = newRotation;
             }

        } else {
            // SCALING
            const cos = Math.cos(-start.rotation);
            const sin = Math.sin(-start.rotation);
            
            // Generate Unrotated Coordinates relative to object center
            const displayObject = engine.renderSystem.getDisplayObject(entity.id);
            if (!displayObject) return;
             
            const globalCenter = displayObject.toGlobal(new Point(0,0)); 
            const center = this.container.toLocal(globalCenter); 
             
            // Delta from center to mouse in unrotated space?
            // Existing logic uses simple parsing of handles.
            
            // Standard approach: Unproject mouse pos to object space
            const rx = localPos.x - center.x;
            const ry = localPos.y - center.y;
            const curUx = rx * cos - ry * sin;
            const curUy = ry * cos + rx * sin; // Corrected rotation for Y
            
            let newScaleX = start.scaleX;
            let newScaleY = start.scaleY;
            
            // Distance from center to handle (Local Space Unscaled) -> (width/2)
            // But width is 'bounds width'.
            // Let's assume handles are at bounds edges.
            
            // Calculate nominal distance from Pivot (0,0) to Edge
            // If dragging 'E', nominal X is lbX + width
            // If dragging 'W', nominal X is lbX
            
            // X-Axis
            if (this.dragHandle.includes('e')) {
                 const nominal = start.lbX + start.width;
                 if (Math.abs(nominal) > 0.1) newScaleX = curUx / nominal;
                 
            } else if (this.dragHandle.includes('w')) {
                 const nominal = start.lbX;
                 if (Math.abs(nominal) > 0.1) newScaleX = curUx / nominal;
            }
            
            // Y-Axis
            if (this.dragHandle.includes('s')) {
                const nominal = start.lbY + start.height;
                if (Math.abs(nominal) > 0.1) newScaleY = curUy / nominal;

            } else if (this.dragHandle.includes('n')) {
                const nominal = start.lbY;
                if (Math.abs(nominal) > 0.1) newScaleY = curUy / nominal;
            }
            
            // Proportional Scaling (SHIFT)
            if (shiftKey) {
                // Determine which axis changed the most relative to its start
                const ratioX = Math.abs(newScaleX / start.scaleX);
                const ratioY = Math.abs(newScaleY / start.scaleY);
                
                // If dragging a corner, we usually want to lock ratio
                if (ratioX > ratioY) {
                    // X dominates, adjust Y
                    newScaleY = newScaleX * (start.scaleY / start.scaleX);
                } else {
                    // Y dominates, adjust X
                    newScaleX = newScaleY * (start.scaleX / start.scaleY);
                }
            }
            
            // Apply scale (prevent zero scale issues)
            // Use 0.001 as min scale
            if (Math.abs(newScaleX) < 0.001) newScaleX = 0.001 * Math.sign(newScaleX || 1);
            if (Math.abs(newScaleY) < 0.001) newScaleY = 0.001 * Math.sign(newScaleY || 1);

            entity.transform.scale.x = newScaleX;
            entity.transform.scale.y = newScaleY;
        }

        eventBus.emit('entity-change', entity.id);
    }

    private getHitHandleGlobal(screenX: number, screenY: number): HandleType {
         if (!this.primaryEntity) return null;
         
         const tolerance = 20; 
         const dist = (p1: Point, p2: Point) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
         
         const points = this.getProjectedPoints(this.primaryEntity);
         if (!points) return null;
         
         const mouse = new Point(screenX, screenY);
         
         // Find closest handle within tolerance
         let bestHandle: HandleType = null;
         let minDiv = tolerance;
         
         const check = (p: Point, type: HandleType) => {
             const d = dist(mouse, p);
             if (d < minDiv) {
                 minDiv = d;
                 bestHandle = type;
             }
         };
         
         check(points.rotate, 'rotate');
         check(points.nw, 'nw');
         check(points.ne, 'ne');
         check(points.sw, 'sw');
         check(points.se, 'se');
         check(points.n, 'n');
         check(points.s, 's');
         check(points.w, 'w');
         check(points.e, 'e');
         
         if (bestHandle) return bestHandle;
         
         const poly = [points.nw, points.ne, points.se, points.sw];
         let inside = false;
         for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
             const pi = poly[i];
             const pj = poly[j];
             if (!pi || !pj) continue;
             
             const xi = pi.x, yi = pi.y;
             const xj = pj.x, yj = pj.y;
             
             const intersect = ((yi > mouse.y) !== (yj > mouse.y))
                 && (mouse.x < (xj - xi) * (mouse.y - yi) / (yj - yi) + xi);
             if (intersect) inside = !inside;
         }
         
         if (inside) return 'center';
         return null;
    }

    private getProjectedPoints(entity: Entity) {
        if (!entity || !entity.id) return null;
        
        const displayObject = engine.renderSystem.getDisplayObject(entity.id);
        if (!displayObject) return null;
        
        const lb = displayObject.getLocalBounds(); 
        
        const localPts = {
            nw: new Point(lb.x, lb.y),
            ne: new Point(lb.x + lb.width, lb.y),
            sw: new Point(lb.x, lb.y + lb.height),
            se: new Point(lb.x + lb.width, lb.y + lb.height),
            n: new Point(lb.x + lb.width / 2, lb.y),
            s: new Point(lb.x + lb.width / 2, lb.y + lb.height),
            w: new Point(lb.x, lb.y + lb.height / 2),
            e: new Point(lb.x + lb.width, lb.y + lb.height / 2),
            rotate: new Point(lb.x + lb.width / 2, lb.y - 10) // -10px Local Up
        };
        
        return {
            nw: displayObject.toGlobal(localPts.nw),
            ne: displayObject.toGlobal(localPts.ne),
            sw: displayObject.toGlobal(localPts.sw),
            se: displayObject.toGlobal(localPts.se),
            n: displayObject.toGlobal(localPts.n),
            s: displayObject.toGlobal(localPts.s),
            w: displayObject.toGlobal(localPts.w),
            e: displayObject.toGlobal(localPts.e),
            rotate: displayObject.toGlobal(localPts.rotate)
        };
    }

    private render() {
        this.gizmoGraphics.clear();
        
        // 1. Render Secondary Selections (Simple Outline)
        this.selectedEntities.forEach(entity => {
            if (entity === this.primaryEntity) return;
            
            const pts = this.getProjectedPoints(entity);
            if (!pts) return;
            
            const nw = this.container.toLocal(pts.nw);
            const ne = this.container.toLocal(pts.ne);
            const sw = this.container.toLocal(pts.sw);
            const se = this.container.toLocal(pts.se);
            
            const path = [nw, ne, se, sw, nw];
           
            this.gizmoGraphics.beginPath();
            if (path[0]) this.gizmoGraphics.moveTo(path[0].x, path[0].y);
            path.forEach(p => { if(p) this.gizmoGraphics.lineTo(p.x, p.y); });
            this.gizmoGraphics.stroke({ width: 1, color: 0x00A3FF, alpha: 0.5 });
        });

        // 2. Render Primary Selection (Full Gizmo)
        if (this.primaryEntity) {
            const pts = this.getProjectedPoints(this.primaryEntity);
            if (pts) {
                const nw = this.container.toLocal(pts.nw);
                const ne = this.container.toLocal(pts.ne);
                const sw = this.container.toLocal(pts.sw);
                const se = this.container.toLocal(pts.se);
                const n = this.container.toLocal(pts.n);
                const s = this.container.toLocal(pts.s);
                const w = this.container.toLocal(pts.w);
                const e = this.container.toLocal(pts.e);
                const rot = this.container.toLocal(pts.rotate);
                const centerTop = n;

                // Box
                const path = [nw, ne, se, sw, nw];
                this.gizmoGraphics.beginPath();
                if (path[0]) this.gizmoGraphics.moveTo(path[0].x, path[0].y);
                path.forEach(p => { if(p) this.gizmoGraphics.lineTo(p.x, p.y); });
                this.gizmoGraphics.stroke({ width: 1, color: 0x00A3FF });

                // Rotate Handle Line
                this.gizmoGraphics.moveTo(centerTop.x, centerTop.y);
                this.gizmoGraphics.lineTo(rot.x, rot.y);
                this.gizmoGraphics.stroke({ width: 1, color: 0x00A3FF });

                // Handles
                const drawHandle = (p: Point, type: HandleType) => {
                    const color = (this.hoverHandle === type || this.dragHandle === type) ? 0xFF0000 : 0xFFFFFF; 
                    const size = this.HANDLE_SIZE / Math.abs(this.container.parent?.scale.x ?? 1); 
                    
                    this.gizmoGraphics.rect(p.x - size/2, p.y - size/2, size, size);
                    this.gizmoGraphics.fill({ color });
                    this.gizmoGraphics.stroke({ width: 1, color: 0x000000 });
                };

                drawHandle(nw, 'nw');
                drawHandle(ne, 'ne');
                drawHandle(sw, 'sw');
                drawHandle(se, 'se');
                drawHandle(n, 'n');
                drawHandle(s, 's');
                drawHandle(w, 'w');
                drawHandle(e, 'e');
                
                const rotSize = this.HANDLE_SIZE / Math.abs(this.container.parent?.scale.x ?? 1);
                this.gizmoGraphics.circle(rot.x, rot.y, rotSize/2);
                this.gizmoGraphics.fill({ color: (this.hoverHandle === 'rotate' || this.dragHandle === 'rotate') ? 0xFF0000 : 0xFFFFFF });
                this.gizmoGraphics.stroke({ width: 1, color: 0x000000 });
            }
        }
    }
}

export const instance = new GizmoManager();
