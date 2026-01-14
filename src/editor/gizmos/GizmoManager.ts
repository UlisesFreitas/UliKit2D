
import { Graphics, Container, FederatedPointerEvent, Point } from 'pixi.js';
import { useEditorStore } from '../../stores/useEditorStore';
import { world, type Entity } from '../../engine/ecs/ECS';
import { instance as engine } from '../../engine/core/Engine';
import { eventBus } from '../../engine/core/EventBus';

type HandleType = 'center' | 'rotate' | 'nw' | 'ne' | 'sw' | 'se' | null;

export class GizmoManager {
    private container: Container;
    private selectedEntity: Entity | null = null;
    private gizmoGraphics: Graphics;
    
    // Drag state
    private isDragging: boolean = false;
    public dragHandle: HandleType = null;
    private dragStartPos: Point = new Point();
    private entityStart: { x: number, y: number, scaleX: number, scaleY: number, rotation: number } = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    
    public snapToGrid: boolean = false; 
    
    public getGridSizeCallback: ((layerId: string) => { x: number, y: number } | undefined) | null = null;
    
    // Hover state
    public hoverHandle: HandleType = null;

    private storeUnsub: () => void;
    private boundOnDragMove: (e: FederatedPointerEvent) => void;
    private boundOnDragEnd: (e: FederatedPointerEvent) => void;

    // Consts
    private readonly HANDLE_SIZE = 12;
    private readonly ROTATE_OFFSET = 30;

    constructor() {
        this.container = new Container();
        this.container.zIndex = 9999; 
        engine.app.stage.addChild(this.container);
        engine.app.stage.sortableChildren = true;

        this.gizmoGraphics = new Graphics();
        this.container.addChild(this.gizmoGraphics);
        
        // Setup Interactions
        this.gizmoGraphics.eventMode = 'static';
        this.gizmoGraphics.on('pointermove', this.onPointerMove.bind(this));
        this.gizmoGraphics.on('pointerdown', this.onDragStart.bind(this));
        
        // Global drag listeners
        this.boundOnDragMove = this.onDragMove.bind(this);
        this.boundOnDragEnd = this.onDragEnd.bind(this);

        engine.app.stage.eventMode = 'static';
        engine.app.stage.on('pointermove', this.boundOnDragMove);
        engine.app.stage.on('pointerup', this.boundOnDragEnd);
        engine.app.stage.on('pointerupoutside', this.boundOnDragEnd);

        // Subscribe to selection changes
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
        
        engine.onRender = () => {
             if (this.gizmoGraphics && !this.gizmoGraphics.destroyed) {
                 this.render();
             }
        };
    }

    public dispose() {
        this.storeUnsub();
        engine.app.stage.off('pointermove', this.boundOnDragMove);
        engine.app.stage.off('pointerup', this.boundOnDragEnd);
        engine.app.stage.off('pointerupoutside', this.boundOnDragEnd);
        
        engine.onRender = () => {}; // Clear render loop hook

        if (!this.container.destroyed) {
            engine.app.stage.removeChild(this.container);
            this.container.destroy({ children: true });
        }
    }

    private getBounds() {
        if (!this.selectedEntity || !this.selectedEntity.transform) return null;
        const { x, y } = this.selectedEntity.transform;
        
        let w = 100;
        let h = 100;
        
        if (this.selectedEntity.boxCollider) {
            w = this.selectedEntity.boxCollider.width * this.selectedEntity.transform.scale.x;
            h = this.selectedEntity.boxCollider.height * this.selectedEntity.transform.scale.y;
        } else if (this.selectedEntity.nineSliceSprite) {
            w = this.selectedEntity.nineSliceSprite.width * this.selectedEntity.transform.scale.x;
            h = this.selectedEntity.nineSliceSprite.height * this.selectedEntity.transform.scale.y;
        } else if (this.selectedEntity.sprite && this.selectedEntity.sprite.width) {
            w = this.selectedEntity.sprite.width * this.selectedEntity.transform.scale.x;
            h = (this.selectedEntity.sprite.height || 100) * this.selectedEntity.transform.scale.y;
        } else if (this.selectedEntity.bitmapText && this.selectedEntity.bitmapText.width) {
            w = this.selectedEntity.bitmapText.width * this.selectedEntity.transform.scale.x;
            h = (this.selectedEntity.bitmapText.height || 32) * this.selectedEntity.transform.scale.y;
        } else if (this.selectedEntity.label && this.selectedEntity.label.width) {
             w = this.selectedEntity.label.width * this.selectedEntity.transform.scale.x;
             h = (this.selectedEntity.label.height || 24) * this.selectedEntity.transform.scale.y;
        } else if (this.selectedEntity.camera) {
             // Camera Gizmo Size (Standard 32x32)
             w = 32 * this.selectedEntity.transform.scale.x;
             h = 32 * this.selectedEntity.transform.scale.y;
        } else {
             w = 100 * this.selectedEntity.transform.scale.x;
             h = 100 * this.selectedEntity.transform.scale.y;
        }

        const anchor = this.selectedEntity.sprite?.anchor || { x: 0.5, y: 0.5 };
        const dx = (0.5 - anchor.x) * w;
        const dy = (0.5 - anchor.y) * h;
        
        const rot = this.selectedEntity.transform.rotation;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        
        const centerX = x + (dx * cos - dy * sin);
        const centerY = y + (dx * sin + dy * cos);

        return { x: centerX, y: centerY, w, h, rotation: rot };
    }

    private render() {
        if (this.gizmoGraphics.destroyed) return;
        this.gizmoGraphics.clear();
        
        const bounds = this.getBounds();
        if (!bounds) {
            this.gizmoGraphics.visible = false;
            engine.app.canvas.style.cursor = 'default';
            return;
        }

        this.gizmoGraphics.visible = true;
        const { x, y, w, h, rotation } = bounds;
        
        // Calculate Zoom-invariant Handle Size
        const zoom = engine.app.stage.scale.x || 1;
        const size = this.HANDLE_SIZE / zoom;
        const strokeWidth = 2 / zoom;
        const subStrokeWidth = 1 / zoom;

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        const hw = w / 2;
        const hh = h / 2;

        // Corners (Local to Center)
        const corners = [
            { id: 'nw', lx: -hw, ly: -hh },
            { id: 'ne', lx: hw, ly: -hh },
            { id: 'se', lx: hw, ly: hh },
            { id: 'sw', lx: -hw, ly: hh }
        ].map(c => ({
            id: c.id,
            x: x + (c.lx * cos - c.ly * sin),
            y: y + (c.lx * sin + c.ly * cos)
        }));

        // Bounding Box
        // Check if Camera
        const isCamera = !!this.selectedEntity?.camera;
        const mainAlpha = isCamera ? 0 : 1; 
        const fillAlpha = isCamera ? 0.01 : 0.05; // 0.01 is enough for pointer events
        const cornerAlpha = isCamera ? 0 : 1;
        const activeStrokeWidth = isCamera ? 0 : strokeWidth;

        // Bounding Box
        const [c0, c1, c2, c3] = corners;
        if (c0 && c1 && c2 && c3) {
            this.gizmoGraphics.moveTo(c0.x, c0.y);
            this.gizmoGraphics.lineTo(c1.x, c1.y);
            this.gizmoGraphics.lineTo(c2.x, c2.y);
            this.gizmoGraphics.lineTo(c3.x, c3.y);
            this.gizmoGraphics.lineTo(c0.x, c0.y);
        }
        this.gizmoGraphics.stroke({ width: activeStrokeWidth, color: 0xffff00, alpha: mainAlpha });
        // Use transparent fill to catch clicks for move
        this.gizmoGraphics.fill({ color: 0xffff00, alpha: fillAlpha });

        // Draw Corners
        corners.forEach(c => {
            const color = (this.hoverHandle === c.id || this.dragHandle === c.id) ? 0xffffff : 0xffff00;
            
            this.gizmoGraphics.rect(c.x - size/2, c.y - size/2, size, size);
            this.gizmoGraphics.fill({ color, alpha: cornerAlpha });
            this.gizmoGraphics.stroke({ width: subStrokeWidth, color: 0x000000, alpha: cornerAlpha });
        });

        if (isCamera) return; // Skip Rotate Handle for Camera

        // Rotation Handle (Top Right + Offset)
        const offset = this.ROTATE_OFFSET / zoom;
        const rotX = x + ((hw + offset) * cos);
        const rotY = y + ((hw + offset) * sin);
        
        // Line to handle
        const edgeX = x + (hw * cos);
        const edgeY = y + (hw * sin);
        
        this.gizmoGraphics.moveTo(edgeX, edgeY);
        this.gizmoGraphics.lineTo(rotX, rotY);
        this.gizmoGraphics.stroke({ width: subStrokeWidth, color: 0xffff00 });

        // Circle
        const rotColor = (this.hoverHandle === 'rotate' || this.dragHandle === 'rotate') ? 0xffffff : 0xffff00;
        this.gizmoGraphics.circle(rotX, rotY, size / 2);
        this.gizmoGraphics.fill({ color: rotColor });
        this.gizmoGraphics.stroke({ width: subStrokeWidth, color: 0x000000 });
    }

    private getHitHandle(gx: number, gy: number): HandleType {
        const bounds = this.getBounds();
        if (!bounds) return null;

        const zoom = engine.app.stage.scale.x || 1;
        const handleSize = this.HANDLE_SIZE / zoom;
        const rotateOffset = this.ROTATE_OFFSET / zoom;

        const { x, y, w, h, rotation } = bounds;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = w / 2;
        const hh = h / 2;

        const dist = (p1x: number, p1y: number, p2x: number, p2y: number) => {
            return Math.sqrt(Math.pow(p1x - p2x, 2) + Math.pow(p1y - p2y, 2));
        };

        // Check Rotate Handle
        const rotX = x + ((hw + rotateOffset) * cos);
        const rotY = y + ((hw + rotateOffset) * sin);
        if (dist(gx, gy, rotX, rotY) < handleSize) return 'rotate';

        // Check Corners
        // We have to reuse corner logic
        const corners = [
            { id: 'nw', lx: -hw, ly: -hh },
            { id: 'ne', lx: hw, ly: -hh },
            { id: 'se', lx: hw, ly: hh },
            { id: 'sw', lx: -hw, ly: hh }
        ].map(c => ({
            id: c.id,
            x: x + (c.lx * cos - c.ly * sin),
            y: y + (c.lx * sin + c.ly * cos)
        }));

        for (const c of corners) {
            if (dist(gx, gy, c.x, c.y) < handleSize) {
                return c.id as HandleType;
            }
        }

        // Check Center/Body (for move)
        // Transform mouse point into local unrotated space to check against AABB
        // Inverse rotate: translate to origin, rotate by -angle
        const dx = gx - x;
        const dy = gy - y;
        const localX = dx * cos + dy * sin;
        const localY = -dx * sin + dy * cos;

        if (Math.abs(localX) < hw && Math.abs(localY) < hh) {
            return 'center';
        }

        return null;
    }

    private onPointerMove(e: FederatedPointerEvent) {
        if (this.isDragging || !this.selectedEntity) return;

        const clickPos = e.getLocalPosition(this.container); 
        const hit = this.getHitHandle(clickPos.x, clickPos.y);
        
        if (hit !== this.hoverHandle) {
            this.hoverHandle = hit;
            this.render();
            
            // Cursor Feedback
            const cursors: Record<string, string> = {
                'nw': 'nw-resize', 'ne': 'ne-resize',
                'sw': 'sw-resize', 'se': 'se-resize',
                'rotate': 'alias', // or grab
                'center': 'move'
            };
            
            const cursor = hit ? (cursors[hit] || 'default') : 'default';
            this.gizmoGraphics.cursor = cursor;
            engine.app.canvas.style.cursor = cursor;
        }
    }

    private onDragStart(e: FederatedPointerEvent) {
        if (!this.selectedEntity) return;

        const clickPos = e.getLocalPosition(this.container); 
        const handle = this.getHitHandle(clickPos.x, clickPos.y);

        if (handle) {
            this.isDragging = true;
            this.dragHandle = handle;
            this.dragStartPos.set(clickPos.x, clickPos.y);
            
            const t = this.selectedEntity.transform!;
            this.entityStart = { 
                x: t.x, 
                y: t.y, 
                scaleX: t.scale.x, 
                scaleY: t.scale.y, 
                rotation: t.rotation 
            };
            e.stopPropagation();
        }
    }

    private onDragMove(e: FederatedPointerEvent) {
       if (!this.isDragging || !this.selectedEntity) return;

       const currentPos = e.getLocalPosition(this.container);
       
       if (this.dragHandle === 'center') {
           // Translation
           const dx = currentPos.x - this.dragStartPos.x;
           const dy = currentPos.y - this.dragStartPos.y;
           
           let newX = this.entityStart.x + dx;
           let newY = this.entityStart.y + dy;
           
           if (this.snapToGrid) {
                const layerId = this.selectedEntity.layer || 'Base Layer';
                // Use Sync Callback
                const grid = this.getGridSizeCallback?.(layerId);
                const gx = grid?.x || 32;
                const gy = grid?.y || 32;

                newX = Math.round(newX / gx) * gx;
                newY = Math.round(newY / gy) * gy;
           }
           
           this.selectedEntity.transform!.x = newX;
           this.selectedEntity.transform!.y = newY;
       
       } else if (this.dragHandle === 'rotate') {
           // Rotation
           // Calculate angle from entity center to mouse
           const center = new Point(this.selectedEntity.transform!.x, this.selectedEntity.transform!.y);
           const startAngle = Math.atan2(this.dragStartPos.y - center.y, this.dragStartPos.x - center.x);
           const currentAngle = Math.atan2(currentPos.y - center.y, currentPos.x - center.x);
           
           let deltaRotation = currentAngle - startAngle;

           // Snap to 5 degrees if Ctrl is held
           if (e.ctrlKey) {
                const snapRad = 5 * (Math.PI / 180);
                const currentRot = this.entityStart.rotation + deltaRotation;
                const snappedRot = Math.round(currentRot / snapRad) * snapRad;
                this.selectedEntity.transform!.rotation = snappedRot;
                this.selectedEntity!.transform!.rotation = snappedRot;
           } else {
                this.selectedEntity!.transform!.rotation = this.entityStart.rotation + deltaRotation;
           }
           
       } else if (this.dragHandle) {
           // Scaling
           // We need base width/height to know ratio
           // Use initial sprite size?
           let baseW = 100;
           let baseH = 100;
            if (this.selectedEntity!.boxCollider) {
                 baseW = this.selectedEntity!.boxCollider.width;
                 baseH = this.selectedEntity!.boxCollider.height;
            } else if (this.selectedEntity!.sprite && this.selectedEntity!.sprite.width) {
                 baseW = this.selectedEntity!.sprite.width;
                 baseH = this.selectedEntity!.sprite.height || 100;
            } else if (this.selectedEntity!.nineSliceSprite && this.selectedEntity!.nineSliceSprite.width) {
                 baseW = this.selectedEntity!.nineSliceSprite.width;
                 baseH = this.selectedEntity!.nineSliceSprite.height || 100;
            } else if (this.selectedEntity!.bitmapText && this.selectedEntity!.bitmapText.width) {
                 baseW = this.selectedEntity!.bitmapText.width;
                 baseH = this.selectedEntity!.bitmapText.height || 32;
            } else if (this.selectedEntity!.label && this.selectedEntity!.label.width) {
                 baseW = this.selectedEntity!.label.width;
                 baseH = this.selectedEntity!.label.height || 24;
            }
           // Use collider as fallback
           
           // Project mouse onto axes? 
           // Simplified: Just use distance from center?
           // Better: Calculate 'dx' in local rotated space from corner.
           
           // Simple approach:
           // If 'ne' (Right-Top), we want to extend in local X and Y.
           
           const cos = Math.cos(this.entityStart.rotation);
           const sin = Math.sin(this.entityStart.rotation);
           
           const dx = currentPos.x - this.dragStartPos.x;
           const dy = currentPos.y - this.dragStartPos.y;
           
           // Rotate delta into local alignment
           const localDx = dx * cos + dy * sin;
           const localDy = -dx * sin + dy * cos; // Y is scale Y
           
           // Determine direction multiplier based on handle
           let mx = 0; 
           let my = 0;
           
           if (this.dragHandle.includes('e')) mx = 1;
           if (this.dragHandle.includes('w')) mx = -1;
           if (this.dragHandle.includes('s')) my = 1;
           if (this.dragHandle.includes('n')) my = -1;
           
           // SPECIAL HANDLING FOR NINE SLICE: RESIZE DIMENSIONS NOT SCALE
           if (this.selectedEntity.nineSliceSprite) {
               // We want to change WIDTH/HEIGHT, not Scale.
               // Current Size = BaseW * ScaleX
               // New Size = Current Size + (LocalDelta * mx * 0.5? No, edges move fully)
               // If dragging 'east' (right edge), we add delta to width.
               // But Gizmo calculates center-based resizing usually?
               // Our Gizmo logic above: center stays put? 
               // Currently Logic: "newScaleX = ..." this implies scaling from center if we don't move position.
               // To keep it simple: We will just change dimensions and assume center scaling for now (NineSlice handles anchors).
               
               // Account for current scale to convert screen pixel delta to local unit delta
                const currentScaleX = this.selectedEntity!.transform!.scale.x;
                const currentScaleY = this.selectedEntity!.transform!.scale.y;

               // Avoid div by zero
               const sX = Math.abs(currentScaleX) > 0.01 ? currentScaleX : 1;
               const sY = Math.abs(currentScaleY) > 0.01 ? currentScaleY : 1;

               // The Gizmo handle moves by localDx.
               // Since handles are at edges (width/2), moving handle by 10px means width increases by 20px (if symmetric).
               const deltaW = (localDx * mx * 2) / sX; 
               const deltaH = (localDy * my * 2) / sY;

               const startW = this.selectedEntity.nineSliceSprite.width;
               const startH = this.selectedEntity.nineSliceSprite.height;

               // Update ECS Data directly
               const ns = this.selectedEntity.nineSliceSprite;
               if (mx !== 0) ns.width = Math.max(startW + deltaW, ns.left + ns.right); // Clamp to margins
               if (my !== 0) ns.height = Math.max(startH + deltaH, ns.top + ns.bottom);

               // Do NOT touch transform.scale
           } else {
               // NORMAL SCALING LOGIC
               // New Scale = StartScale + (Delta / BaseSize) * Multiplier * 2 (since w is full width, center to edge is half)
               // Actually, dragging edge by D increases width by D? 
               // If scaling from center, dragging corner out by 10px adds 20px to width (10 on each side).
               
               let newScaleX = this.entityStart.scaleX + (localDx / (baseW/2)) * mx * 0.5; 
               let newScaleY = this.entityStart.scaleY + (localDy / (baseH/2)) * my * 0.5;
               
               if (e.ctrlKey) {
                   // Proportional Scale Logic
                   const ratioX = newScaleX / this.entityStart.scaleX;
                   const ratioY = newScaleY / this.entityStart.scaleY;
                   
                   // Use the larger scale factor to drive both
                   // Handle potential division by zero if startScale is 0 (unlikely but safe)
                   const startX = Math.abs(this.entityStart.scaleX) > 0.001 ? this.entityStart.scaleX : 1;
                   const startY = Math.abs(this.entityStart.scaleY) > 0.001 ? this.entityStart.scaleY : 1;

                   // Determine dominant ratio change
                   const deltaRatioX = Math.abs(ratioX - 1);
                   const deltaRatioY = Math.abs(ratioY - 1);
                   
                   const factor = deltaRatioX > deltaRatioY ? ratioX : ratioY;
                   
                   newScaleX = startX * factor;
                   newScaleY = startY * factor;
               }

               this.selectedEntity.transform!.scale.x = newScaleX;
               this.selectedEntity.transform!.scale.y = newScaleY;
           }
       }

       eventBus.emit('entity-updated', this.selectedEntity.id);
    }

    private onDragEnd() {
        if (this.isDragging) {
             this.isDragging = false;
             this.dragHandle = null;
             if (this.selectedEntity) {
                 eventBus.emit('entity-updated', this.selectedEntity.id);
             }
        }
    }
}
