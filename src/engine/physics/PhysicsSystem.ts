import Matter from 'matter-js';
import { world } from '../ecs/ECS';
import { SceneManager } from '../managers/SceneManager';

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

    private tileBodies: Map<string, Matter.Body> = new Map();

    public update(deltaTime: number) {
        Matter.Engine.update(this.engine, deltaTime);
        this.syncBodies();
        this.syncTilemapBodies();
    }

    private syncTilemapBodies() {
        // Find collision layers (Flexible Tag System)
        const collisionLayers = SceneManager.layers.filter(l => l.isCollision && l.visible !== false);
        
        // Track current valid keys to identify removals
        const validKeys = new Set<string>();

        for (const layer of collisionLayers) {
             if (!layer.tileData) continue;
             
             const gw = layer.gridSize?.x || 16;
             const gh = layer.gridSize?.y || 16;

             for (const posKey of Object.keys(layer.tileData)) {
                 const uniqueKey = `${layer.id}:${posKey}`;
                 validKeys.add(uniqueKey);

                 if (!this.tileBodies.has(uniqueKey)) {
                     // Create Body
                     const parts = posKey.split(',');
                     const gx = Number(parts[0]);
                     const gy = Number(parts[1]);
                     
                     // Matter.js body origin is center
                     const x = gx * gw + (gw / 2);
                     const y = gy * gh + (gh / 2);
                     
                     const body = Matter.Bodies.rectangle(x, y, gw, gh, {
                         isStatic: true,
                         label: 'TileWall'
                     });
                     
                     Matter.World.add(this.engine.world, body);
                     this.tileBodies.set(uniqueKey, body);
                 }
             }
        }

        // Cleanup removed tiles (only checking keys in our map)
        for (const [key, body] of this.tileBodies.entries()) {
            if (!validKeys.has(key)) {
                Matter.World.remove(this.engine.world, body);
                this.tileBodies.delete(key);
            }
        }
    }

    private syncBodies() {
        // ... (existing) ...
        // 1. Initialize bodies for new entities (Box or Circle)
        const entitiesWithBody = world.with('transform', 'rigidBody');
        
        for (const entity of entitiesWithBody) {
            if (!entity.physicsBody) {
                const { x, y, rotation } = entity.transform;
                const { isStatic, friction, restitution } = entity.rigidBody;
                
                let body: Matter.Body | null = null;

                if (entity.boxCollider) {
                    const { width, height } = entity.boxCollider;
                    body = Matter.Bodies.rectangle(x, y, width, height, {
                        isStatic,
                        angle: rotation,
                        friction,
                        restitution
                    });
                } else if (entity.circleCollider) {
                     const { radius } = entity.circleCollider;
                     body = Matter.Bodies.circle(x, y, radius, {
                        isStatic,
                        angle: rotation,
                        friction,
                        restitution
                    });
                }

                if (body) {
                    entity.physicsBody = body;
                    Matter.World.add(this.engine.world, body);
                }
            } else {
                // 2. Sync Physics -> ECS (for dynamic bodies)
                if (!entity.rigidBody.isStatic) {
                   entity.transform.x = entity.physicsBody.position.x;
                   entity.transform.y = entity.physicsBody.position.y;
                   entity.transform.rotation = entity.physicsBody.angle;
                } else {
                    // 3. Sync ECS -> Physics (for static bodies moved in editor)
                    Matter.Body.setPosition(entity.physicsBody, { x: entity.transform.x, y: entity.transform.y });
                    Matter.Body.setAngle(entity.physicsBody, entity.transform.rotation);
                }
            }
        }
    }
}
