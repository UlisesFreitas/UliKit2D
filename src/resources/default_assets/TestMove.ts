
import type { Entity } from '../../engine/ecs/ECS';
import { Input } from '../../engine/input/InputManager';

export const properties = {
    speed: 200
};

export function update(entity: Entity, deltaTime: number, params: typeof properties) {
    if (!entity.transform) return;

    const speed = params.speed || 200;
    // deltaTime is in milliseconds
    const dtSeconds = deltaTime / 1000;
    const moveAmount = speed * dtSeconds;

    if (Input.isKeyDown('ArrowRight') || Input.isKeyDown('KeyD')) {
        entity.transform.x += moveAmount;
    }
    if (Input.isKeyDown('ArrowLeft') || Input.isKeyDown('KeyA')) {
        entity.transform.x -= moveAmount;
    }
    if (Input.isKeyDown('ArrowUp') || Input.isKeyDown('KeyW')) {
        entity.transform.y -= moveAmount;
    }
    if (Input.isKeyDown('ArrowDown') || Input.isKeyDown('KeyS')) {
        entity.transform.y += moveAmount;
    }
}
