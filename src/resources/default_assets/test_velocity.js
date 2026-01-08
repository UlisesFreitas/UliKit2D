
export function update(entity, dt) {
    if (entity.physicsBody) {
        // Apply a small force to move right
        // We can't import Matter here easily, so we modify properties directly if possible
        // or ensure 'Matter' is exposed? No, let's try force application via raw object manipulation if Matter allows it,
        // otherwise we might need to expose a helper.
        // Actually, let's try setting velocity directly which is often a property on the body.
        
        const current = entity.physicsBody.velocity;
        // Basic movement
        entity.physicsBody.velocity = { x: 2, y: current.y };
    }
}
