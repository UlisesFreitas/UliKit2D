import type { ICommand } from './ICommand';

import { world } from '../../engine/ecs/ECS';
import { eventBus } from '../../engine/core/EventBus';

export interface TransformState {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
}

export class TransformCommand implements ICommand {
    public id: string;
    public timestamp: number;
    public description: string;

    private changes: {
        entityId: string;
        oldState: TransformState;
        newState: TransformState;
    }[];

    constructor(changes: { entityId: string, oldState: TransformState, newState: TransformState }[], description: string = 'Transform Change') {
        this.id = crypto.randomUUID();
        this.timestamp = Date.now();
        this.description = description;
        this.changes = changes.map(c => ({
            entityId: c.entityId,
            oldState: { ...c.oldState },
            newState: { ...c.newState }
        }));
    }

    execute(): void {
        this.changes.forEach(change => {
            this.applyState(change.entityId, change.newState);
        });
    }

    undo(): void {
        this.changes.forEach(change => {
            this.applyState(change.entityId, change.oldState);
        });
    }

    private applyState(entityId: string, state: TransformState) {
        // 1. Update ECS Component
        const entity = world.with('id', 'transform').where(e => e.id === entityId).first;
        if (!entity || !entity.transform) return;

        entity.transform.x = state.x;
        entity.transform.y = state.y;
        entity.transform.scale.x = state.scaleX;
        entity.transform.scale.y = state.scaleY;
        entity.transform.rotation = state.rotation;

        // 2. Notify System/EventBus
        eventBus.emit('entity-change', entityId);
    }
}
