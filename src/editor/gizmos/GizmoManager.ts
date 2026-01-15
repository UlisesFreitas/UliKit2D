
import { Graphics, Container, Point } from 'pixi.js';
import { useEditorStore } from '../../stores/useEditorStore';
import { world, type Entity } from '../../engine/ecs/ECS';
import { instance as engine } from '../../engine/core/Engine';
import { eventBus } from '../../engine/core/EventBus';

type HandleType = 'center' | 'rotate' | 'nw' | 'ne' | 'sw' | 'se' | null;

export class GizmoManager {
    private container: Container;
    private selectedEntity: Entity | null = null;
    private gizmoGraphics: Graphics;
    
    // Interaction State
    private isDragging: boolean = false;
    public dragHandle: HandleType = null;
    private dragStartPos: Point = new Point();
    
    // Snapshot state for Undo/Delta
    private entityStart: { 
        x: number, y: number, 
        scaleX: number, scaleY: number, 
        rotation: number,
        width: number, height: number 
    } = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, width: 0, height: 0 };
    
    public snapToGrid: boolean = false; 
    public getGridSizeCallback: ((layerId: string) => { x: number, y: number } | undefined) | null = null;
    
    public hoverHandle: HandleType = null;
    private storeUnsub: () => void;
    
    // Constants
    private readonly HANDLE_SIZE = 12;
    private readonly ROTATE_OFFSET = 30;

    constructor() {
        this.container = new Container();
        this.container.zIndex = 9999; 
        this.container.label = 'Gizmo Overlay';
        
        // Auto-add to stage if valid. 
        // If engine inits later, ScenePanel or init() will trigger re-check.
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
            if (state.selectedEntityId) {
                const entity = world.with('id', 'transform').where(e => e.id === state.selectedEntityId).first;
                this.selectedEntity = entity || null;
            } else {
                this.selectedEntity = null;
            }
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
        if (!this.selectedEntity) return false;

        // Use GLOBAL coordinates for Hit Test directly
        const handle = this.getHitHandleGlobal(screenX, screenY);

        if (handle) {
            this.isDragging = true;
            this.dragHandle = handle;
            
            // For dragging delta, we can still use local or global delta.
            // Using Local ensures we move in World Space correctly.
            const localPos = this.container.toLocal(new Point(screenX, screenY));
            this.dragStartPos.set(localPos.x, localPos.y);
            
            const t = this.selectedEntity.transform!;
            
            // Get original unscaled size for scaling math
            const displayObject = engine.renderSystem.getDisplayObject(this.selectedEntity.id!);
            const localBounds = displayObject ? displayObject.getLocalBounds() : { width: 1, height: 1 };
            
            this.entityStart = { 
                x: t.x, 
                y: t.y, 
                scaleX: t.scale.x, 
                scaleY: t.scale.y, 
                rotation: t.rotation,
                width: localBounds.width,
                height: localBounds.height
            };
            return true;
        }
        return false;
    }

    public processPointerMove(screenX: number, screenY: number) {
        if (!this.selectedEntity) return;

        // Global for Hit Test, Local for Drag Math (handled in handleDragMove)
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
            eventBus.emit('entity-change-end', this.selectedEntity?.id); // For Undo history if we had it
        }
    }

    // --- Logic ---

    private handleDragMove(currentPos: Point) {
        if (!this.isDragging || !this.selectedEntity) return;

        // Position Logic (Center)
        if (this.dragHandle === 'center') {
             const dx = currentPos.x - this.dragStartPos.x;
             const dy = currentPos.y - this.dragStartPos.y;
             
             let newX = this.entityStart.x + dx;
             let newY = this.entityStart.y + dy;

             if (this.snapToGrid) {
                 const layerId = this.selectedEntity.layer || 'Base Layer';
                 const grid = this.getGridSizeCallback?.(layerId) || { x: 32, y: 32 };
                 newX = Math.round(newX / grid.x) * grid.x;
                 newY = Math.round(newY / grid.y) * grid.y;
             }
             
             this.selectedEntity.transform!.x = newX;
             this.selectedEntity.transform!.y = newY;
        
        } else if (this.dragHandle === 'rotate') {
            // Rotation Logic
            // We need Center in Gizmo Local Space?
            // Actually, Transform (x,y) is World Space (immortal canvas). 
            // Gizmo Container is usually at (0,0) World Space?
            // No, Gizmo Container is child of Stage. Stage moves with Camera.
            // WAIT! 
            // ScenePanel moves `engine.app.stage.position`.
            // So `this.container` (child of stage) moves with camera.
            // Entities also move with camera.
            // So `toLocal` of Gizmo Container == World Space if Gizmo Container is at (0,0) inside Stage.
            
            // However, `currentPos` is explicitly converted via `this.container.toLocal(global)`.
            // So `currentPos` is in Gizmo Local Space.
            
            // We need Entity Center in Gizmo Logic Space.
            // Since Gizmo Container is sibling of Layers (conceptually), or overlays them.
            // It shares the same Transform context as Layers usually.
            
            // To be safe, project Entity (0,0) to Global then to Gizmo.
            const displayObject = engine.renderSystem.getDisplayObject(this.selectedEntity.id!);
            if (displayObject && displayObject.parent) {

                 // We want the Pivot Point (Transform X,Y).
                 // Actually, Entity.Transform.x/y IS the pivot point in parent (Layer).
                 // If Gizmo Container is in Stage, and Layers are in Stage.
                 // Then Gizmo Local == Layer Local (mostly).
                 // Let's rely on `toGlobal` of the Entity's position.
                 
                 // Better: Use `getProjectedCorners` center? No.
                 // Use `displayObject.toGlobal(new Point(0,0))` if anchor is top-left, this is top-left.
                 // DisplayObject position IS transform position.
                 const globalPosOfEntity = displayObject.parent.toGlobal(displayObject.position);
                 const localCenter = this.container.toLocal(globalPosOfEntity);
                 
                 const startAngle = Math.atan2(this.dragStartPos.y - localCenter.y, this.dragStartPos.x - localCenter.x);
                 const currentAngle = Math.atan2(currentPos.y - localCenter.y, currentPos.x - localCenter.x);
                 
                 const deltaRotation = currentAngle - startAngle;
                 this.selectedEntity.transform!.rotation = this.entityStart.rotation + deltaRotation;
            }

        } else if (this.dragHandle) {
             // Scaling Logic
             // Simplified: Scale based on distance from center or axis projection?
             // Let's stick to the "Projected Delta" approach.
             
             // Base Size
             const baseW = this.entityStart.width || 32;
             const baseH = this.entityStart.height || 32;
             
             const cos = Math.cos(this.entityStart.rotation);
             const sin = Math.sin(this.entityStart.rotation);
             
             const dx = currentPos.x - this.dragStartPos.x;
             const dy = currentPos.y - this.dragStartPos.y;
             
             // Rotate delta into object local space
             const localDx = dx * cos + dy * sin;
             const localDy = -dx * sin + dy * cos;
             
             let mx = 0; let my = 0;
             if (this.dragHandle.includes('e')) mx = 1;
             if (this.dragHandle.includes('w')) mx = -1;
             if (this.dragHandle.includes('s')) my = 1;
             if (this.dragHandle.includes('n')) my = -1;
             
             // New Scale = Old Scale + (Delta / HalfSize) * Direction
             // Add check for 0 to avoid Infinity
             const safeBaseW = baseW < 1 ? 1 : baseW;
             const safeBaseH = baseH < 1 ? 1 : baseH;
             
             const newScaleX = this.entityStart.scaleX + (localDx / (safeBaseW * 0.5)) * mx * 0.5;
             const newScaleY = this.entityStart.scaleY + (localDy / (safeBaseH * 0.5)) * my * 0.5;

             this.selectedEntity.transform!.scale.x = newScaleX;
             this.selectedEntity.transform!.scale.y = newScaleY;
        }

        eventBus.emit('entity-updated', this.selectedEntity.id);
    }

    private getProjectedCorners(): [Point, Point, Point, Point] | null {
        if (!this.selectedEntity) return null;
        const displayObject = engine.renderSystem.getDisplayObject(this.selectedEntity.id!);
        if (!displayObject) return null;

        const bounds = displayObject.getLocalBounds();
        
        // Define corners in Local Space
        const points = [
            new Point(bounds.x, bounds.y), // TL
            new Point(bounds.x + bounds.width, bounds.y), // TR
            new Point(bounds.x + bounds.width, bounds.y + bounds.height), // BR
            new Point(bounds.x, bounds.y + bounds.height) // BL
        ];

        // Project -> Global -> Gizmo Local
        const projected = points.map(p => {
             const global = displayObject.toGlobal(p);
             return this.container.toLocal(global);
        });

        return projected as [Point, Point, Point, Point];
    }

    private render() {
        this.gizmoGraphics.clear();
        
        if (!this.selectedEntity || !world.entities.includes(this.selectedEntity)) {
             this.selectedEntity = null;
             this.gizmoGraphics.visible = false;
             return;
        }

        const corners = this.getProjectedCorners();
        if (!corners) {
            this.gizmoGraphics.visible = false;
            return;
        }

        this.gizmoGraphics.visible = true;
        
        // Get Zoom Factor for consistent handle size
        const zoom = engine.app.stage.scale.x || 1;
        const size = this.HANDLE_SIZE / zoom;
        const stroke = 2 / zoom;
        const subStroke = 1 / zoom;

        const [nw, ne, se, sw] = corners;

        // Draw Box
        this.gizmoGraphics.stroke({ width: stroke, color: 0x00A3FF, alpha: 0.8 });
        // this.gizmoGraphics.fill({ color: 0x00A3FF, alpha: 0.05 }); // Maybe too noisy?
        this.gizmoGraphics.moveTo(nw.x, nw.y);
        this.gizmoGraphics.lineTo(ne.x, ne.y);
        this.gizmoGraphics.lineTo(se.x, se.y);
        this.gizmoGraphics.lineTo(sw.x, sw.y);
        this.gizmoGraphics.lineTo(nw.x, nw.y);
        this.gizmoGraphics.stroke({ width: stroke, color: 0x00A3FF });

        // Draw Handles
        const handlePoints = [
            { id: 'nw', p: nw }, { id: 'ne', p: ne },
            { id: 'se', p: se }, { id: 'sw', p: sw }
        ];

        handlePoints.forEach(({ id, p }) => {
            const isHover = this.hoverHandle === id;
            const isDrag = this.dragHandle === id;
            
            this.gizmoGraphics.rect(p.x - size/2, p.y - size/2, size, size);
            // Color: Red if Hover, White if Drag, Blue Default
            let color = 0x00A3FF; // Default blue
            if (isDrag) {
                color = 0xFFFFFF; // White if dragging
            } else if (isHover) {
                color = 0xFF0000; // Red if hovering (and not dragging)
            }
            this.gizmoGraphics.fill({ color });
            this.gizmoGraphics.stroke({ width: subStroke, color: 0x000000 });
        });

        // Rotate Handle
        // Midpoint of Upper Edge
        const midTopX = (nw.x + ne.x) / 2;
        const midTopY = (nw.y + ne.y) / 2;
        
        // Normal Direction (Perpendicular to NW-NE) pointing UP
        // Edge Vector
        const dx = ne.x - nw.x;
        const dy = ne.y - nw.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        
        // Rotate 90 degrees CCW (for UP in Pixi Y-down space if unrotated)
        // (x, y) -> (y, -x)
        const nx = dy / len;
        const ny = -dx / len;
        
        const offset = this.ROTATE_OFFSET / zoom;
        const rx = midTopX + nx * offset;
        const ry = midTopY + ny * offset;

        this.gizmoGraphics.moveTo(midTopX, midTopY);
        this.gizmoGraphics.lineTo(rx, ry);
        this.gizmoGraphics.stroke({ width: subStroke, color: 0x00A3FF, alpha: 0.5 });
        
        const isRotHover = this.hoverHandle === 'rotate';
        const isRotDrag = this.dragHandle === 'rotate';
        
        let rotColor = 0x00A3FF; // Default blue
        if (isRotDrag) {
            rotColor = 0xFFFFFF; // White if dragging
        } else if (isRotHover) {
            rotColor = 0xFF0000; // Red if hovering (and not dragging)
        }

        this.gizmoGraphics.circle(rx, ry, size/2);
        this.gizmoGraphics.fill({ color: rotColor });
        this.gizmoGraphics.stroke({ width: subStroke, color: 0x000000 });

        // DEBUG: Draw Hit Areas (Transparent White)
        // This helps verify if the "Action Area" matches the Zoom logic
        //const hitSize = (this.HANDLE_SIZE + 8) / zoom; // Tolerance used in getHitHandle (+8 = 20px screen)
        
        //this.gizmoGraphics.beginPath();
        // Corners
        //handlePoints.forEach(({ p }) => {
        //     this.gizmoGraphics.circle(p.x, p.y, hitSize);
        //});
        // Rotate
        //this.gizmoGraphics.circle(rx, ry, hitSize);
        //this.gizmoGraphics.fill({ color: 0xFFFFFF, alpha: 0.2 });
    }



    private getHitHandleGlobal(screenX: number, screenY: number): HandleType {
        const corners = this.getProjectedCorners(); 
        if (!corners) return null;
        
        // Convert projected (Local) to Global for Hit Test
        // This ensures checking against Mouse (Global) is accurate 1:1
        const globalCorners = corners.map(p => this.container.toGlobal(p));
        const [nw, ne, se, sw] = globalCorners;

        // Hit Size should be CONSTANT in Screen Space (e.g. 10px) regardless of Zoom
        // Previous logic: size = 12 / zoom. 
        // If zoom is 0.1, size = 120 (HUGE). This was the bug.
        // We want the handle to BE drawn larger in World Space to APPEAR constant in Screen Space.
        // BUT for Hit Test in Global Space, we just want raw screen pixels.
        const HIT_TOLERANCE = 10; // 2 pixels radius around mouse cursor
        
        const dist = (p: {x: number, y: number}) => Math.hypot(p.x - screenX, p.y - screenY);

        if (dist(nw!) < HIT_TOLERANCE) return 'nw';
        if (dist(ne!) < HIT_TOLERANCE) return 'ne';
        if (dist(se!) < HIT_TOLERANCE) return 'se';
        if (dist(sw!) < HIT_TOLERANCE) return 'sw';

        // Rotate Global
        const midTopX = (nw!.x + ne!.x) / 2;
        const midTopY = (nw!.y + ne!.y) / 2;
        
        const dx = ne!.x - nw!.x;
        const dy = ne!.y - nw!.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        
        const nx = dy / len;
        const ny = -dx / len;
        
        // The visual line is OFFSET by 30 screen pixels
        const ROTATE_OFFSET_SCREEN = 30;
        
        const rx = midTopX + nx * ROTATE_OFFSET_SCREEN;
        const ry = midTopY + ny * ROTATE_OFFSET_SCREEN;
        
        if (Math.hypot(rx - screenX, ry - screenY) < HIT_TOLERANCE) return 'rotate';

        // Poly Check (Global)
        const poly = [nw, ne, se, sw];
        let inside = false;
        for (let i = 0, j = 3; i < 4; j = i++) {
            const xi = poly[i]!.x, yi = poly[i]!.y;
            const xj = poly[j]!.x, yj = poly[j]!.y;
            
            const intersect = ((yi > screenY) !== (yj > screenY))
                 && (screenX < (xj - xi) * (screenY - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        
        return inside ? 'center' : null;
    }
}

export const instance = new GizmoManager();
