import { Graphics, Container, Point } from 'pixi.js';
import { useEditorStore } from '../../stores/useEditorStore';
import { world, type Entity } from '../../engine/ecs/ECS';
import { instance as engine } from '../../engine/core/Engine';
import { eventBus } from '../../engine/core/EventBus';

type HandleType = 'center' | 'rotate' | 'nw' | 'ne' | 'sw' | 'se' | null;

interface EntityStartState {
    id: string;
    x: number; y: number;
    scaleX: number; scaleY: number;
    rotation: number;
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
                 const localBounds = displayObject ? displayObject.getLocalBounds() : { width: 1, height: 1 };
                 
                 this.startStates.set(entity.id, {
                    id: entity.id,
                    x: t.x,
                    y: t.y,
                    scaleX: t.scale.x,
                    scaleY: t.scale.y,
                    rotation: t.rotation,
                    width: localBounds.width,
                    height: localBounds.height
                 });
            });

            return true;
        }
        return false;
    }

    public processPointerMove(screenX: number, screenY: number) {
        if (!this.primaryEntity) return;

        // Global for Hit Test, Local for Drag Math
        const globalPos = new Point(screenX, screenY);
        const localPos = this.container.toLocal(globalPos);

        if (this.isDragging) {
            this.handleDragMove(localPos);
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

    private handleDragMove(localPos: Point) {
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
             // Calculate angle relative to Entity Center in Gizmo Space
             // We need current center of entity in Gizmo Local Space
             // Since we moved it? No, rotation uses current mouse vs start mouse? 
             // Or mouse vs object center.
             // Entity center hasn't changed position (rotation around center).
             // We need to project Entity Center to Gizmo Local.
             
             const displayObject = engine.renderSystem.getDisplayObject(entity.id);
             if (displayObject && displayObject.parent) {
                  // Project (0,0) of entity to Gizmo Local
                  const globalCenter = displayObject.toGlobal(new Point(0,0)); 
                  const localCenter = this.container.toLocal(globalCenter);
                  
                  const angle = Math.atan2(localPos.y - localCenter.y, localPos.x - localCenter.x);
                  // -90 degrees offset because handle is at top
                  let newRotation = angle + Math.PI / 2;

                  if (this.snapToGrid) { 
                      const snapRad = Math.PI / 12; // 15 deg
                      newRotation = Math.round(newRotation / snapRad) * snapRad;
                  }
                  
                  entity.transform.rotation = newRotation;
             }

        } else {
            // SCALING
            
            // Rotate mouse point back to unrotated space for easy axis scaling
            const cos = Math.cos(-start.rotation);
            const sin = Math.sin(-start.rotation);
            
            // Delta from START position of dragging (not object center)
            // Wait, scaling is usually done relative to pivot. 
            // If I pull Right Handle, I expect Right side to expand.
            // Let's rely on Start State + Delta.
            
            // To simplify: Calculate Drag Vector in Object Local Space
            // But 'dx, dy' is from DragStart.
            
            // Simple approach:
            // Calculate distance from Center to Mouse.
            // Compare to Distance from Center to StartMouse.
            // Ratio = New / Old.
            
            // This is robust against rotation.
            // BUT this does uniform scaling if we just compare magnitude.
            // We want axis-aligned scaling.
            
            // Project 'localPos' (GizmoSpace) into Unrotated Object Space (centered at object).
            // Object Center in Gizmo Space:
            const displayObject = engine.renderSystem.getDisplayObject(entity.id);
            if (!displayObject) return;
             
            const globalCenter = displayObject.toGlobal(new Point(0,0)); 
            const center = this.container.toLocal(globalCenter); // Object center in Gizmo Local
             
            // Point in Unrotated Local Space relative to center
            const getUnrotated = (p: Point) => {
                const rx = p.x - center.x;
                const ry = p.y - center.y;
                return {
                    x: rx * cos - ry * sin,
                    y: rx * sin + ry * cos
                };
            };
            
            const curU = getUnrotated(localPos);
            // We need the MouseStart in Unrotated too? 
            // Actually, we can just look at 'curU' vs 'Half Size'.
            
            let newScaleX = start.scaleX;
            let newScaleY = start.scaleY;
            
            // Handle X
            if (this.dragHandle?.includes('e')) { // Right
                // Ratio: curU.x / (origWidth/2)
                // OrigWidth/2 is start.width * start.scaleX / 2.
                // But let's just use absolute delta?
                // Scale = CurrentPos / OriginalHalfWidth
                // OriginalHalfWidth (Unscaled) = start.width / 2.
                newScaleX = curU.x / (start.width / 2);
            } else if (this.dragHandle?.includes('w')) { // Left
                newScaleX = curU.x / (-start.width / 2);
            }
            
            // Handle Y
            if (this.dragHandle?.includes('s')) { // Bottom
                newScaleY = curU.y / (start.height / 2);
            } else if (this.dragHandle?.includes('n')) { // Top
                newScaleY = curU.y / (-start.height / 2);
            }
            
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
         
         if (dist(mouse, points.rotate) < tolerance) return 'rotate';
         if (dist(mouse, points.nw) < tolerance) return 'nw';
         if (dist(mouse, points.ne) < tolerance) return 'ne';
         if (dist(mouse, points.sw) < tolerance) return 'sw';
         if (dist(mouse, points.se) < tolerance) return 'se';
         
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
            rotate: new Point(lb.x + lb.width / 2, lb.y - 30) // -30px Local Up
        };
        
        return {
            nw: displayObject.toGlobal(localPts.nw),
            ne: displayObject.toGlobal(localPts.ne),
            sw: displayObject.toGlobal(localPts.sw),
            se: displayObject.toGlobal(localPts.se),
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
                const rot = this.container.toLocal(pts.rotate);
                const centerTop = new Point((nw.x + ne.x)/2, (nw.y + ne.y)/2);

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
                
                const rotSize = this.HANDLE_SIZE / Math.abs(this.container.parent?.scale.x ?? 1);
                this.gizmoGraphics.circle(rot.x, rot.y, rotSize/2);
                this.gizmoGraphics.fill({ color: (this.hoverHandle === 'rotate' || this.dragHandle === 'rotate') ? 0xFF0000 : 0xFFFFFF });
                this.gizmoGraphics.stroke({ width: 1, color: 0x000000 });
            }
        }
    }
}

export const instance = new GizmoManager();
