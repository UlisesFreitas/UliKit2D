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

    private entityId: string;
    private oldState: TransformState;
    private newState: TransformState;

    constructor(entityId: string, oldState: TransformState, newState: TransformState, description: string = 'Transform Change') {
        this.id = crypto.randomUUID();
        this.timestamp = Date.now();
        this.description = description;
        this.entityId = entityId;
        this.oldState = { ...oldState };
        this.newState = { ...newState };
    }

    execute(): void {
        this.applyState(this.newState);
    }

    undo(): void {
        this.applyState(this.oldState);
    }

    private applyState(state: TransformState) {
        // 1. Update ECS Component
        const entity = world.with('id', 'transform').where(e => e.id === this.entityId).first;
        if (!entity || !entity.transform) return;

        entity.transform.x = state.x;
        entity.transform.y = state.y;
        entity.transform.scale.x = state.scaleX;
        entity.transform.scale.y = state.scaleY;
        entity.transform.rotation = state.rotation;

        // 2. Notify System/EventBus to update Render Object?
        // GizmoManager emits 'entity-change', but here we are bypassing GizmoManager.
        // We should emit the event so systems know.
        eventBus.emit('entity-change', this.entityId);
        
        // Also force update of the PIXI display object if needed? 
        // RenderSystem handles ECS -> Pixi sync mostly, but let's be safe.
        // If Logic updates ECS, RenderSystem update() loop should pick it up.
    }
}
