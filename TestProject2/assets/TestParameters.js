
/**
 * Test Script for Parameter Visualization
 * 
 * Attaching this script to an entity should render the following properties in the Inspector:
 * - speed (Number)
 * - isActive (Checkbox)
 * - message (Text)
 */

export const properties = {
    speed: 5.0,
    isActive: true,
    message: "Hello World",
    scaleFactor: 1.5
};

export const update = (dt, entity) => {
    // Simple rotation logic to demonstrate usage
    if (properties.isActive) {
        entity.transform.rotation += properties.speed * dt * 0.1;
        
        // Example of reading other props
        if (entity.transform.scale) {
             const s = 1 + Math.sin(Date.now() / 1000) * (properties.scaleFactor - 1) * 0.1;
             entity.transform.scale.x = s;
             entity.transform.scale.y = s;
        }
    }
};
