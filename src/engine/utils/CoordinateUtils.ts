import type { Entity } from '../ecs/ECS';
import { Sprite, Container, Point } from 'pixi.js';

export class CoordinateUtils {
    
    /**
     * Converts a screen position (relative to the ScenePanel container) to World Coordinates.
     */
    public static screenToWorld(
        screenX: number, 
        screenY: number, 
        cameraX: number, 
        cameraY: number, 
        zoom: number
    ): { x: number, y: number } {
        return {
            x: (screenX - cameraX) / zoom,
            y: (screenY - cameraY) / zoom
        };
    }

    /**
     * Converts World Coordinates to Screen Position.
     */
    public static worldToScreen(
        worldX: number, 
        worldY: number, 
        cameraX: number, 
        cameraY: number, 
        zoom: number
    ): { x: number, y: number } {
        return {
            x: (worldX * zoom) + cameraX,
            y: (worldY * zoom) + cameraY
        };
    }

    /**
     * Checks if a World Point is strictly inside an Entity's visual bounds.
     * Supports Sprites (OBB), Circles, and generic boxes.
     * 
     * @param point World Space Point
     * @param entity The ECS Entity
     * @param displayObject Optional Pixi DisplayObject for precise bounds (preferred)
     */
    public static isPointInEntity(point: {x: number, y: number}, entity: Entity, displayObject?: Container, globalPoint?: {x: number, y: number}): boolean {
        if (!entity.transform) return false;

        // 1. Use Pixi's precise HitBox if available (Handles rotation/scale/anchor perfectly)
        if (displayObject) {
            // Use Global Point if available for perfect nesting support
            // Otherwise try to treat 'point' as Local to Parent (Riskier if nested)
            const localPoint = globalPoint 
                ? displayObject.toLocal(new Point(globalPoint.x, globalPoint.y))
                : displayObject.toLocal(new Point(point.x, point.y), displayObject.parent!);
            
            // Check based on Local Bounds of the object type
            if ((displayObject as Sprite).anchor || (displayObject as any)._anchor) {
                // It's a Sprite or Text with Anchor
                const sprite = displayObject as Sprite;
                // Local Dimensions (Visual Size / Scale)
                const w = sprite.width / sprite.scale.x; 
                const h = sprite.height / sprite.scale.y;
                
                const ax = sprite.anchor.x;
                const ay = sprite.anchor.y;
                
                // Use the calculated local dimensions, NOT the texture dimensions
                // (Fixes NineSlice where texture is small but visual is large)
                const localW = w; 
                const localH = h;
                
                const left = -ax * localW;
                const right = (1 - ax) * localW;
                const top = -ay * localH;
                const bottom = (1 - ay) * localH;
                
                return localPoint.x >= left && localPoint.x <= right && 
                       localPoint.y >= top && localPoint.y <= bottom;
            } else {
                // Container or NineSlice
                // ...
            }
            
            // Fallback: Pixi's own hitTest
            if (globalPoint) {
                 return displayObject.getBounds().containsPoint(globalPoint.x, globalPoint.y);
            }
            return displayObject.getBounds().containsPoint(point.x, point.y);
        }

        // 2. Fallback to Pure Math (ECS Data) if DisplayObject missing (e.g. Invisible or not rendered)
        // Simple AABB check (Rotation ignored for Fallback)
        const tx = entity.transform.x;
        const ty = entity.transform.y;
        
        if (entity.circleCollider) {
            const dx = point.x - tx;
            const dy = point.y - ty;
            return (dx*dx) + (dy*dy) <= (entity.circleCollider.radius * entity.circleCollider.radius);
        }
        
        // Default to a 32x32 box centered
        const w = 32; 
        const h = 32;
        return point.x >= tx - w/2 && point.x <= tx + w/2 &&
               point.y >= ty - h/2 && point.y <= ty + h/2;
    }
}
