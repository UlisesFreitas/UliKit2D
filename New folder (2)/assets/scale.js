export function update(entity, dt) {
    // Accumulate time on the entity to store state
    if (!entity.time) entity.time = 0;
    entity.time += dt;

    // Pulse every 2 seconds (PI * time)
    // Scale varies between 1 and 2
    const factor = (Math.sin(entity.time * Math.PI) + 1) / 2; // 0 to 1
    const scale = 1 + factor; // 1 to 2

    entity.transform.scale.x = scale;
    entity.transform.scale.y = scale;
}