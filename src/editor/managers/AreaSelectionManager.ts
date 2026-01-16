
import { Graphics, Container, Point } from 'pixi.js';
import { instance as engine } from '../../engine/core/Engine';
import { instance as selectionManager } from './SelectionManager';
import { useEditorStore } from '../../stores/useEditorStore';

/**
 * AreaSelectionManager
 * Manages the visual "Drag Box" and triggers selection logic.
 */
export class AreaSelectionManager {
    private container: Container;
    private graphics: Graphics;
    
    private isDragging: boolean = false;
    private startPos: Point = new Point();
    private currentPos: Point = new Point();
    
    // Config
    private readonly FILL_COLOR = 0x00A3FF;
    private readonly FILL_ALPHA = 0.2;
    private readonly BORDER_COLOR = 0x00A3FF;
    private readonly BORDER_ALPHA = 0.8;

    constructor() {
        this.container = new Container();
        this.container.label = 'Selection Overlay';
        this.container.zIndex = 9000; // Below Gizmos (9999) but above Scene
        
        this.graphics = new Graphics();
        this.container.addChild(this.graphics);
        
        // Add to stage if engine ready
        if (engine.app && engine.app.stage) {
            engine.app.stage.addChild(this.container);
        }
    }

    public startDrag(screenX: number, screenY: number) {
        // Ensure added to stage
        if (engine.app && engine.app.stage && this.container.parent !== engine.app.stage) {
            engine.app.stage.addChild(this.container);
        }

        this.isDragging = true;
        this.startPos.set(screenX, screenY);
        this.currentPos.set(screenX, screenY);
        this.render();
    }

    public updateDrag(screenX: number, screenY: number) {
        if (!this.isDragging) return;
        this.currentPos.set(screenX, screenY);
        this.render();
    }

    public endDrag() {
        if (!this.isDragging) return;

        // Perform Selection
        const rect = this.getSelectionRect();
        
        // Only select if box has size > 2px
        if (rect.width > 2 && rect.height > 2) {
            const hits = selectionManager.hitTestRect(rect);
            const store = useEditorStore();
            
            if (hits.length > 0) {
                store.selectEntities(hits);
            } else {
                store.selectEntities([]);
            }
        }
        
        this.isDragging = false;
        this.graphics.clear();
    }

    private getSelectionRect() {
        const x = Math.min(this.startPos.x, this.currentPos.x);
        const y = Math.min(this.startPos.y, this.currentPos.y);
        const width = Math.abs(this.currentPos.x - this.startPos.x);
        const height = Math.abs(this.currentPos.y - this.startPos.y);
        return { x, y, width, height };
    }

    private render() {
        this.graphics.clear();
        if (!this.isDragging) return;

        // Convert Global (Screen) to Local (Container) for Drawing
        // This handles cases where the Container (Stage) is Zoomed/Panned
        const localStart = this.container.toLocal(this.startPos);
        const localCurrent = this.container.toLocal(this.currentPos);

        const x = Math.min(localStart.x, localCurrent.x);
        const y = Math.min(localStart.y, localCurrent.y);
        const width = Math.abs(localCurrent.x - localStart.x);
        const height = Math.abs(localCurrent.y - localStart.y);

        // Adjust stroke thickness to stay 1px on screen
        const zoom = Math.abs(this.container.parent?.scale.x || 1);
        const strokeWidth = 1 / zoom;

        // Draw Rect
        this.graphics.rect(x, y, width, height);
        this.graphics.fill({ color: this.FILL_COLOR, alpha: this.FILL_ALPHA });
        this.graphics.stroke({ width: strokeWidth, color: this.BORDER_COLOR, alpha: this.BORDER_ALPHA });
    }
}

export const instance = new AreaSelectionManager();
