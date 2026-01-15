
import { instance as engine } from '../../engine/core/Engine';
import { useEditorStore } from '../../stores/useEditorStore';
import { Container } from 'pixi.js';

/**
 * SelectionManager
 * Responsible for Hit Testing and updating Selection State.
 * Uses PixiJS Native Event System (v8).
 */
export class SelectionManager {
    
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

    public select(id: string | null) {
        const store = useEditorStore();
        store.selectEntity(id);
    }
}

export const instance = new SelectionManager();
