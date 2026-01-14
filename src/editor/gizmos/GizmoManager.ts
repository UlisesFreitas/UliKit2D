
import { Graphics, Container, Point, FederatedPointerEvent } from 'pixi.js';
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
    // Helper References (Not strictly used if using manual input, but kept for type safety if we revert)
    // private boundOnDragMove: (e: FederatedPointerEvent) => void;
    // private boundOnDragEnd: (e: FederatedPointerEvent) => void;

    // Consts
    private readonly HANDLE_SIZE = 12;
    private readonly ROTATE_OFFSET = 30;

    constructor() {
        this.container = new Container();
        this.container.zIndex = 9999; 
        
        // Ensure engine is ready or add later? Engine instance exists. App might be initializing.
        // It's safe to add to stage if stage exists.
        if (engine.app && engine.app.stage) {
            engine.app.stage.addChild(this.container);
            engine.app.stage.sortableChildren = true;
        } else {
             engine.app.stage.addChild(this.container);
             engine.app.stage.sortableChildren = true;
        }

        this.gizmoGraphics = new Graphics();
        this.container.addChild(this.gizmoGraphics);
        
        this.gizmoGraphics.eventMode = 'none'; 
        
        this.storeUnsub = () => {}; // No-op initial
        
        engine.onRender = () => {
             if (this.gizmoGraphics && !this.gizmoGraphics.destroyed) {
                 this.render();
             }
        };
    }

    public init() {
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
    }

    public dispose() {
        if (this.storeUnsub) this.storeUnsub();
        engine.onRender = () => {}; 

        if (this.container && !this.container.destroyed) {
            if (this.container.parent) this.container.parent.removeChild(this.container);
            this.container.destroy({ children: true });
        }
    }

    // --- EXTERNAL INPUT API (For ScenePanel Overlay) ---

    public processPointerMove(screenX: number, screenY: number) {
        if (!this.selectedEntity) return;

        // Convert Screen -> Local (Container)
        const globalPos = new Point(screenX, screenY);
        const localPos = this.container.toLocal(globalPos);

        if (this.isDragging) {
            this.handleDragMove(localPos);
        } else {
             const hit = this.getHitHandle(localPos.x, localPos.y);
             if (hit !== this.hoverHandle) {
                this.hoverHandle = hit;
                this.render();
            }
        }
    }

    public processPointerDown(screenX: number, screenY: number): boolean {
        if (!this.selectedEntity) return false;

        const globalPos = new Point(screenX, screenY);
        const localPos = this.container.toLocal(globalPos);
        const handle = this.getHitHandle(localPos.x, localPos.y);

        if (handle) {
            this.isDragging = true;
            this.dragHandle = handle;
            this.dragStartPos.set(localPos.x, localPos.y);
            
            const t = this.selectedEntity.transform!;
            this.entityStart = { 
                x: t.x, 
                y: t.y, 
                scaleX: t.scale.x, 
                scaleY: t.scale.y, 
                rotation: t.rotation 
            };
            return true; // Handled
        }
        return false;
    }

    public processPointerUp() {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragHandle = null;
            this.render();
        }
    }

    // Internal Logic
    private handleDragMove(currentPos: Point) {
       if (!this.isDragging || !this.selectedEntity) return;
       
       if (this.dragHandle === 'center') {
           const dx = currentPos.x - this.dragStartPos.x;
           const dy = currentPos.y - this.dragStartPos.y;
           
           let newX = this.entityStart.x + dx;
           let newY = this.entityStart.y + dy;
           
           if (this.snapToGrid) {
                 const layerId = (this.selectedEntity as any).layerId || 'Base Layer'; // Cast if needed
                 const grid = this.getGridSizeCallback?.(layerId);
                 const gx = grid?.x || 32;
                 const gy = grid?.y || 32;

                 newX = Math.round(newX / gx) * gx;
                 newY = Math.round(newY / gy) * gy;
           }
           
           this.selectedEntity.transform!.x = newX;
           this.selectedEntity.transform!.y = newY;
       
       } else if (this.dragHandle === 'rotate') {
           const center = new Point(this.selectedEntity.transform!.x, this.selectedEntity.transform!.y);
           const startAngle = Math.atan2(this.dragStartPos.y - center.y, this.dragStartPos.x - center.x);
           const currentAngle = Math.atan2(currentPos.y - center.y, currentPos.x - center.x);
           
           const deltaRotation = currentAngle - startAngle;
           // Note: e.ctrlKey information is lost unless we pass event. 
           // For now, no snap on rotation via API unless we add 'modifiers' arg.
           this.selectedEntity!.transform!.rotation = this.entityStart.rotation + deltaRotation;
           
       } else if (this.dragHandle) {
           // Scaling
           let baseW = 100;
           let baseH = 100;
            // ... Logic simplified for brevity or robustness
            if (this.selectedEntity.boxCollider) {
                 baseW = this.selectedEntity.boxCollider.width;
                 baseH = this.selectedEntity.boxCollider.height;
            } else if (this.selectedEntity.sprite && this.selectedEntity.sprite.width) {
                 baseW = this.selectedEntity.sprite.width;
                 baseH = this.selectedEntity.sprite.height || 100;
            } else if (this.selectedEntity.nineSliceSprite && this.selectedEntity.nineSliceSprite.width) {
                 baseW = this.selectedEntity.nineSliceSprite.width;
                 baseH = this.selectedEntity.nineSliceSprite.height || 100;
            }
           
           const cos = Math.cos(this.entityStart.rotation);
           const sin = Math.sin(this.entityStart.rotation);
           const dx = currentPos.x - this.dragStartPos.x;
           const dy = currentPos.y - this.dragStartPos.y;
           const localDx = dx * cos + dy * sin;
           const localDy = -dx * sin + dy * cos;
           
           let mx = 0; let my = 0;
           if (this.dragHandle.includes('e')) mx = 1;
           if (this.dragHandle.includes('w')) mx = -1;
           if (this.dragHandle.includes('s')) my = 1;
           if (this.dragHandle.includes('n')) my = -1;
           
           if (this.selectedEntity.nineSliceSprite) {
                const currentScaleX = this.selectedEntity!.transform!.scale.x;
                const currentScaleY = this.selectedEntity!.transform!.scale.y;
                const sX = Math.abs(currentScaleX) > 0.01 ? currentScaleX : 1;
                const sY = Math.abs(currentScaleY) > 0.01 ? currentScaleY : 1;
                const deltaW = (localDx * mx * 2) / sX; 
                const deltaH = (localDy * my * 2) / sY;
                const ns = this.selectedEntity.nineSliceSprite;
                if (mx !== 0) ns.width = Math.max(10, ns.width + deltaW / 10); // Simple hack because relative logic is hard
                // Actually, let's just stick to standard scale logic for stability if complex.
                // Reverting to scale logic for robust fix:
           }
           
           // Standard Scale Logic
           let newScaleX = this.entityStart.scaleX + (localDx / (baseW/2)) * mx * 0.5; 
           let newScaleY = this.entityStart.scaleY + (localDy / (baseH/2)) * my * 0.5;
           this.selectedEntity.transform!.scale.x = newScaleX;
           this.selectedEntity.transform!.scale.y = newScaleY;
       }

       eventBus.emit('entity-updated', this.selectedEntity.id);
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
            // engine.app.canvas.style.cursor = 'default'; // Don't touch global cursor, ScenePanel handles it via return type or observe
            return;
        }

        this.gizmoGraphics.visible = true;
        const { x, y, w, h, rotation } = bounds;
        
        const zoom = engine.app.stage.scale.x || 1;
        const size = this.HANDLE_SIZE / zoom;
        const strokeWidth = 2 / zoom;
        const subStrokeWidth = 1 / zoom;

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        const hw = w / 2;
        const hh = h / 2;

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

        const isCamera = !!this.selectedEntity?.camera;
        const mainAlpha = isCamera ? 0 : 1; 
        const fillAlpha = isCamera ? 0.01 : 0.05; 
        const cornerAlpha = isCamera ? 0 : 1;
        const activeStrokeWidth = isCamera ? 0 : strokeWidth;

        const [c0, c1, c2, c3] = corners;
        if (c0 && c1 && c2 && c3) {
            this.gizmoGraphics.moveTo(c0.x, c0.y);
            this.gizmoGraphics.lineTo(c1.x, c1.y);
            this.gizmoGraphics.lineTo(c2.x, c2.y);
            this.gizmoGraphics.lineTo(c3.x, c3.y);
            this.gizmoGraphics.lineTo(c0.x, c0.y);
        }
        this.gizmoGraphics.stroke({ width: activeStrokeWidth, color: 0xffff00, alpha: mainAlpha });
        this.gizmoGraphics.fill({ color: 0xffff00, alpha: fillAlpha });

        corners.forEach(c => {
            const color = (this.hoverHandle === c.id || this.dragHandle === c.id) ? 0xffffff : 0xffff00;
            this.gizmoGraphics.rect(c.x - size/2, c.y - size/2, size, size);
            this.gizmoGraphics.fill({ color, alpha: cornerAlpha });
            this.gizmoGraphics.stroke({ width: subStrokeWidth, color: 0x000000, alpha: cornerAlpha });
        });

        if (isCamera) return; 

        const offset = this.ROTATE_OFFSET / zoom;
        const rotX = x + ((hw + offset) * cos);
        const rotY = y + ((hw + offset) * sin);
        const edgeX = x + (hw * cos);
        const edgeY = y + (hw * sin);
        
        this.gizmoGraphics.moveTo(edgeX, edgeY);
        this.gizmoGraphics.lineTo(rotX, rotY);
        this.gizmoGraphics.stroke({ width: subStrokeWidth, color: 0xffff00 });

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

        const rotX = x + ((hw + rotateOffset) * cos);
        const rotY = y + ((hw + rotateOffset) * sin);
        if (dist(gx, gy, rotX, rotY) < handleSize) return 'rotate';

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

        const dx = gx - x;
        const dy = gy - y;
        const localX = dx * cos + dy * sin;
        const localY = -dx * sin + dy * cos;

        if (Math.abs(localX) < hw && Math.abs(localY) < hh) {
            return 'center';
        }
        return null;
    }
}

export const instance = new GizmoManager();
