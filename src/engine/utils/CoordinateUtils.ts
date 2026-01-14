import { instance as engine } from '../core/Engine';
import type { Entity } from '../ecs/ECS';
import { Container, Point } from 'pixi.js';

export class CoordinateUtils {
    
    /**
     * Converts a screen position (Global) to World Coordinates (Local to Stage).
     * Ignores manual camera params, trusts the Stage.
     */
    public static screenToWorld(screenX: number, screenY: number): { x: number, y: number } {
        // Create point if needed
        const globalPoint = new Point(screenX, screenY);
        // Stage IS the world container in our architecture
        return engine.app.stage.toLocal(globalPoint);
    }

    /**
     * Converts World Coordinates to Screen Position (Global).
     */
    public static worldToScreen(worldX: number, worldY: number): { x: number, y: number } {
        const localPoint = new Point(worldX, worldY);
        return engine.app.stage.toGlobal(localPoint);
    }

    /**
     * Checks if a point interacts with an entity.
     * Uses PixiJS Hit Testing.
     */
    public static isPointInEntity(
        entity: Entity, 
        displayObject: Container | undefined, 
        globalPoint: {x: number, y: number}
    ): boolean {
        if (!displayObject || !displayObject.visible || !displayObject.renderable) return false;

        // PixiJS v7/v8: Container has containsPoint?
        // Actually DisplayObject usually has it. 
        // Cast to any to be safe or check method existence.
        // Sprites definitely have it.
        
        const point = new Point(globalPoint.x, globalPoint.y); // Ensure Pixi Point
        
        // 1. Try Native Hit Test (Perfect Shape/Rotation support)
        if ('containsPoint' in displayObject && typeof (displayObject as any).containsPoint === 'function') {
             return (displayObject as any).containsPoint(point);
        }

        // 2. Fallback: Screen Bounds (AABB)
        // Good for generic containers without hitArea
        return displayObject.getBounds().containsPoint(point.x, point.y);
    }
}
