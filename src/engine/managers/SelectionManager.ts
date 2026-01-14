import { world } from '../ecs/ECS';
import { instance as engine } from '../core/Engine';
import { SceneManager } from './SceneManager';
import { Point } from 'pixi.js';

export class SelectionManager {

    /**
     * Performs a hit test at the given GLOBAL (Screen) coordinates.
     * Returns the Entity ID of the top-most visible entity.
     */
    static hitTest(screenX: number, screenY: number): string | null {
        if (!engine.renderSystem) return null;

        const globalPoint = new Point(screenX, screenY);
        
        // 1. Get all entities with visuals
        // We iterate visually sorted layers from Top to Bottom
        // But Pixi 'stage' children are sorted by Z-index (Draw Order: Bottom to Top).
        // So we want to iterate reversed (Top to Bottom).
        
        // However, ECS 'world' query doesn't guarantee order.
        // Better to iterate SceneManager.layers (Top to Bottom?)
        // SceneManager.layers are usually order 0=Bottom.
        // So iterate layers reverse.
        
        const layers = [...SceneManager.layers].reverse();
        
        for (const layer of layers) {
            if (!layer.visible || layer.locked) continue;
            
            // Get IDs in this layer
            // The layer._entityIds set is a runtime cache
            // But we need to check Z-Index within the layer too?
            // Expensive to sort every click.
            // 
            // Alternative: Use RenderSystem's container for the layer and hit test valid children?
            // RenderSystem.layerContainers.get(layer.id) -> Container
            // Container.children -> DisplayObjects (Sprites)
            // Iterate children REVERSE (Top first).
            
            const container = engine.renderSystem['layerContainers'].get(layer.id);
            if (!container || !container.visible) continue;
            
            // Iterate children in reverse draw order (Front to Back)
            for (let i = container.children.length - 1; i >= 0; i--) {
                const child = container.children[i];
                // Check if child is interactive-like
                // We use our RenderSystem helper or child's own hit test
                
                // Note: RenderSystem parents Sprites to Containers.
                // We need to map DisplayObject back to Entity ID.
                // We can cache this in RenderSystem or attach ID to DisplayObject?
                // RenderSystem does `spriteCache.set(id, sprite)`.
                // It does NOT explicitly attach ID to sprite, but we can search or modify RenderSystem to attach it.
                // Modifying RenderSystem to attach `entityId` to sprite is best.
                
                if (child.containsPoint(globalPoint)) {
                     // Found a hit!
                     // Find Entity ID attached to this child
                     const entityId = (child as any)._entityId;
                     if (entityId) return entityId;
                }
            }
        }
        
        return null; // No hit
    }
}
