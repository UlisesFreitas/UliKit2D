
export const properties = {
    speed: 10,
    isActive: true,
    label: "Test"
};

export function update(entity, dt, params) {
    if (params.isActive) {
        entity.transform.x += params.speed * dt;
    }
    // Expose for testing
    window.__LAST_PARAMS__ = params;
}
