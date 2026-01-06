
export const properties = {
    jumpForce: 12,
    interval: 6.0
};

let timer = 0;

export function update(entity, dt, params) {
    if (!entity.physicsBody) return;

    timer += dt;

    if (timer >= params.interval) {
        timer = 0;
        // Apply vertical impulse
        // Matter.js velocity setter logic simulation
        // Assumes we can modify velocity directly or PhysicsSystem handles it
        // A negative Y velocity makes it jump up in many 2D systems (if Y is down)
        
        const currentVel = entity.physicsBody.velocity;
        Matter.Body.setVelocity(entity.physicsBody, { x: currentVel.x, y: -params.jumpForce });
        
        console.log('[AutoJump] Jumping!');
    }
}
