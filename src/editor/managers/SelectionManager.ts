import { world } from '../../engine/ecs/ECS';
import { instance as engine } from '../../engine/core/Engine';
import { CoordinateUtils } from '../../engine/utils/CoordinateUtils';
import { SceneManager } from '../../engine/managers/SceneManager';
import { Point } from 'pixi.js';

import { useEditorStore } from '../../stores/useEditorStore';

// Helper to access store lazily
let _store: any = null;
const getStore = () => {
    if (!_store) _store = useEditorStore();
    return _store;
};

export class SelectionManager {
    
    /**
     * Selects an entity by ID (or deselects if null).
     * Central point for all selection actions.
     */
    public static select(id: string | null) {
        getStore().selectEntity(id);
    }

    /**
     * Determines which entity is under the given GLOBAL point.
     * Respects: Visibility, Renderability, Layers, and Z-Index.
     */
    public static pickEntity(globalPoint: {x: number, y: number}): string | null {
        // Convert to Pixi Point
        const point = new Point(globalPoint.x, globalPoint.y);

        // 1. Get all candidate entities
        const candidates: any[] = [];
        const entities = world.with('transform');

        for (const entity of entities) {
            if (entity.visible === false) continue;
            
            // Get Display Object
            const displayObject = engine.renderSystem.getDisplayObject(entity.id!);
            if (!displayObject || !displayObject.visible || !displayObject.renderable) continue;

            // Hit Test
            if (CoordinateUtils.isPointInEntity(entity, displayObject, point)) {
                candidates.push(entity);
            }
        }

        if (candidates.length === 0) return null;

        // 2. Sort Candidates (Topmost first)
        // Order: Layer Index (Desc) > Z-Index (Desc)
        
        const layerOrder = new Map<string, number>();
        SceneManager.layers.forEach((l, i) => layerOrder.set(l.id, i));

        candidates.sort((a, b) => {
            const layerA = layerOrder.get(a.layer || 'Base Layer') ?? 0;
            const layerB = layerOrder.get(b.layer || 'Base Layer') ?? 0;
            
            if (layerA !== layerB) {
                return layerB - layerA; // Higher layer index = Top
            }

            const zA = a.transform.zIndex || 0;
            const zB = b.transform.zIndex || 0;
            
            return zB - zA; // Higher Z = Top
        });

        // 3. Return winner
        // return candidates[0].id!;
        return null; // Disabled by User Request
    }
}
