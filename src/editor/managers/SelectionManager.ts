
import { instance as engine } from '../../engine/core/Engine';
import { useEditorStore } from '../../stores/useEditorStore';
import { Container } from 'pixi.js';

/**
 * SelectionManager
 * Responsible for Hit Testing and updating Selection State.
 * Uses PixiJS Native Event System (v8).
 */
export class SelectionManager {
    public hoveredEntityId: string | null = null;
    
    /**
     * Performs a hit test at Global (Screen) Coordinates.
     * @param screenX Global X
     * @param screenY Global Y
     * @returns The Entity ID found, or null.
     */
    public hitTest(screenX: number, screenY: number): string | null {
        if (!engine.app || !engine.app.renderer) return null;

        // Use PixiJS Root Boundary for Hit Testing
        // This respects eventMode='passive' on containers and 'static' on sprites.
        const hitDisplayObject = engine.app.renderer.events.rootBoundary.hitTest(screenX, screenY);
        
        if (!hitDisplayObject) return null;

        // Traverse up to find the Entity Root
        // Our RenderSystem marks roots with `_entityId`
        let current: Container | null = hitDisplayObject as Container;
        
        // Safety Break after N levels
        let depth = 0;
        while (current && depth < 20) {
            // Check for our custom property
            if ((current as any)._entityId) {
                return (current as any)._entityId;
            }
            
            // Stop if we hit the Stage or a Layer Container (which shouldn't have ID, but just in case)
            if (current.parent === engine.app.stage) break;
            
            current = current.parent;
            depth++;
        }

        return null;
    }

    public updateHover(screenX: number, screenY: number) {
        this.hoveredEntityId = this.hitTest(screenX, screenY);
    }

    /**
     * Finds ALL Entity IDs within a screen-space rectangle.
     * @param rect {x, y, width, height} in Screen Coordinates
     */
    public hitTestRect(rect: {x: number, y: number, width: number, height: number}): string[] {
        if (!engine.app || !engine.app.stage) return [];

        const hits: string[] = [];

        // 1. Get all potential targets (Entities)
        // We can query the ECS or Iterate the Scene Graph.
        // Iterating Scene Graph ensures we respect current Rendering Order (z-index).
        
        // Helper to find entities recursively
        const candidates: Container[] = [];
        
        const traverse = (container: Container) => {
            if ((container as any)._entityId) {
                candidates.push(container);
                return; // Don't drill into entity children for selection purposes
            }
            container.children.forEach(child => traverse(child as Container));
        };
        
        engine.app.stage.children.forEach(child => {
            // Skip Gizmo Overlay if possible (check label?)
            if (child.label === 'Gizmo Overlay') return;
            traverse(child as Container);
        });

        // 2. Check Intersection (Global Bounds vs Rect)
        // Reverse candidates to check Top-Most first (Render Order)
        for (let i = candidates.length - 1; i >= 0; i--) {
            const container = candidates[i];
            if (!container) continue;
            const bounds = container.getBounds(); // Global Bounds
            
            // Simple AABB Intersection
            const intersects = (
                bounds.x < rect.x + rect.width &&
                bounds.x + bounds.width > rect.x &&
                bounds.y < rect.y + rect.height &&
                bounds.y + bounds.height > rect.y
            );

            if (intersects) {
                hits.push((container as any)._entityId);
            }
        }
        
        return hits;
    }

    public select(id: string | null) {
        const store = useEditorStore();
        store.selectEntity(id);
    }
}

export const instance = new SelectionManager();
