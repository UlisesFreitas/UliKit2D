import { world } from '../../engine/ecs/ECS';
import { instance as engine } from '../../engine/core/Engine';
import { CoordinateUtils } from '../../engine/utils/CoordinateUtils';
import { SceneManager } from '../../engine/managers/SceneManager';
import { Point } from 'pixi.js';

export class SelectionManager {

    /**
     * Finds the best entity under the global point.
     * Prioritizes:
     * 1. Editor Overlay (Cameras)
     * 2. Top Layers (as per SceneManager order)
     * 3. Higher Z-Index within Layer
     */
    public static pickEntity(globalPoint: Point | {x: number, y: number}): string | null {
        // Convert to Pixi Point
        const point = new Point(globalPoint.x, globalPoint.y);

        // 1. Get all candidates
        const candidates = this.getCandidatesAt(point);

        if (candidates.length > 0) {
            // Return top-most
            return candidates[0].id!;
        }

        return null;
    }

    private static getCandidatesAt(point: Point): any[] {
        // Get all transform entities
        const entities = world.with('transform');
        const hits: any[] = [];

        for (const entity of entities) {
            // Visibility Check
            if (entity.visible === false) continue;

            const id = entity.id!;
            const displayObject = engine.renderSystem.getDisplayObject(id);

            // Hit Test
            const hit = CoordinateUtils.isPointInEntity(entity, displayObject, point);
            
            // DEBUG SELECTION
            // if (hit) console.log(`[SelectionManager] Hit: ${entity.name} (${entity.id})`);
            
            if (hit) {
                hits.push(entity);
            }
        }

        // Sort Hits
        // Priority:
        // 1. Camera (Overlay, Z=9999 effectively)
        // 2. Layer Index (Higher is on top)
        // 3. Z-Index (Higher is on top)
        
        // Cache layer indices for speed
        const layerOrder = new Map<string, number>();
        SceneManager.layers.forEach((l, i) => layerOrder.set(l.id, i));

        return hits.sort((a, b) => {
            // A. Check Camera (Always Top)
            const aIsCam = !!a.camera;
            const bIsCam = !!b.camera;
            if (aIsCam && !bIsCam) return -1;
            if (!aIsCam && bIsCam) return 1;

            // B. Layer Priority
            const layerA = layerOrder.get(a.layer || 'Base Layer') ?? 0;
            const layerB = layerOrder.get(b.layer || 'Base Layer') ?? 0;
            
            if (layerA !== layerB) {
                return layerB - layerA; // Descending (Higher layer first)
            }

            // C. Z-Index Priority
            const zA = a.transform.zIndex || 0;
            const zB = b.transform.zIndex || 0;
            
            return zB - zA; // Descending
        });
    }

    public static getEntitiesAt(globalPoint: {x: number, y: number}) {
        return this.getCandidatesAt(new Point(globalPoint.x, globalPoint.y));
    }
}
