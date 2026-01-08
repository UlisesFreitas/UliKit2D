
// Access global Input provided by engine
const Input = window.Input;

export const properties = {
    speed: 200
};

export function update(entity, dt, params) {
    if (!entity.transform || !Input) return;

    const speed = params.speed || 200; 
    const dtSeconds = dt / 1000;
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
