
import Matter from 'matter-js';
import { world } from '../ecs/ECS';

export class PhysicsSystem {
    public engine: Matter.Engine;
    constructor() {
        this.engine = Matter.Engine.create();
        this.engine.gravity.y = 1; // Default gravity

        // Cleanup when entity is destroyed
        world.onEntityRemoved.subscribe((entity) => {
            if (entity.physicsBody) {
                Matter.World.remove(this.engine.world, entity.physicsBody);
                entity.physicsBody = undefined;
            }
        });
    }

    public update(deltaTime: number) {
        // Matter.js uses a fixed timestep usually, but for now we can update it with delta
        // Note: Matter.Runner.tick or Engine.update can be used.
        // We use Engine.update with a correction for different framerates if needed.
        Matter.Engine.update(this.engine, deltaTime);

        this.syncBodies();
    }

    private syncBodies() {
        // 1. Initialize bodies for new entities
        const entitiesWithBody = world.with('transform', 'rigidBody', 'boxCollider');
        
        for (const entity of entitiesWithBody) {
            if (!entity.physicsBody) {
                const { x, y, rotation } = entity.transform;
                const { width, height } = entity.boxCollider;
                const { isStatic, friction, restitution } = entity.rigidBody;

                const body = Matter.Bodies.rectangle(x, y, width, height, {
                    isStatic,
                    angle: rotation,
                    friction,
                    restitution
                });

                entity.physicsBody = body;
                Matter.World.add(this.engine.world, body);
            } else {
                // 2. Sync Physics -> ECS (for dynamic bodies)
                if (!entity.rigidBody.isStatic) {
                   entity.transform.x = entity.physicsBody.position.x;
                   entity.transform.y = entity.physicsBody.position.y;
                   entity.transform.rotation = entity.physicsBody.angle;
                } else {
                    // 3. Sync ECS -> Physics (for static bodies moved in editor)
                    // Note: In a real engine, we might want a flag to know if transform transformed
                    Matter.Body.setPosition(entity.physicsBody, { x: entity.transform.x, y: entity.transform.y });
                    Matter.Body.setAngle(entity.physicsBody, entity.transform.rotation);
                }
            }
        }
    }
}
