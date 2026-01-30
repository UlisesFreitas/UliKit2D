import Matter from 'matter-js';
import { world } from '../ecs/ECS';
import { SceneManager } from '../managers/SceneManager';
import { eventBus } from '../core/EventBus';

export class PhysicsSystem {
    public engine: Matter.Engine;
    
    // private tileBodies: Map<string, Matter.Body> = new Map(); // REMOVED DUPLICATE

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

        // 1. Collision Events
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            for (const pair of event.pairs) {
                const entityA = (pair.bodyA as any)._entity;
                const entityB = (pair.bodyB as any)._entity;

                // Dispatch if at least one is a known Entity
                if (entityA || entityB) {
                    eventBus.emit('collision-start', { entityA, entityB, pair });
                }
            }
        });

        Matter.Events.on(this.engine, 'collisionEnd', (event) => {
             for (const pair of event.pairs) {
                const entityA = (pair.bodyA as any)._entity;
                const entityB = (pair.bodyB as any)._entity;

                if (entityA || entityB) {
                    eventBus.emit('collision-end', { entityA, entityB, pair });
                }
            }
        });

        // @ts-ignore
        if (typeof window !== 'undefined') {
            // @ts-ignore
            window.physicsSystem = this;

            // @ts-ignore
            window.Physics = {
                // Raycast API
                raycast: (origin: {x: number, y: number}, direction: {x: number, y: number}, length: number = 1000, layerMask: number = 0xFFFFFFFF) => {
                    return this.raycast(origin, direction, length, layerMask);
                }
            };
            
            // ... (Debug code omitted for brevity) ...
            // @ts-ignore
            window.UliDebug = {
                 diagnose: () => {
                     // ...
                     return "Diagnosis Complete";
                 }
            };
        }
    }
    
    public raycast(origin: {x: number, y: number}, direction: {x: number, y: number}, length: number = 1000, layerMask: number = 0xFFFFFFFF) {
        // Normalize direction
        const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        const dir = { x: direction.x / len, y: direction.y / len };
        
        const endPoint = {
            x: origin.x + dir.x * length,
            y: origin.y + dir.y * length
        };

        // Query Matter World
        const bodies = Matter.Composite.allBodies(this.engine.world);
        const rays = Matter.Query.ray(bodies, origin, endPoint);
        
        // Filter by Mask
        const hits = rays
            .filter(collision => {
                const body = collision.bodyA; // Matter.Query.ray collisions usually have the hit body as bodyA
                const category = body.collisionFilter.category || 0x0001;
                return (category & layerMask) !== 0;
            })
            .map(collision => {
                const body = collision.bodyA;
                const entity = (body as any)._entity;
                
                // Matter.Query.ray DOES NOT return intersection point in current types.
                // We crudely return body position or start point for now.
                // TODO: Implement precise ray-body intersection if needed.
                const point = { x: body.position.x, y: body.position.y }; 
                
                // Distance squared to body center (Approx)
                const dx = body.position.x - origin.x;
                const dy = body.position.y - origin.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                return {
                    entity,
                    body,
                    point,
                    normal: { x: 0, y: 0 }, // Not available in simple ray query
                    distance: dist
                };
            })
            .sort((a, b) => a.distance - b.distance); // Closest first

        return hits;
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

    private getBodyOffset(entity: any, w: number, h: number, rotation: number) {
        const anchor = entity.sprite?.anchor || { x: 0.5, y: 0.5 };
        const dx = (0.5 - anchor.x) * w;
        const dy = (0.5 - anchor.y) * h;
        
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        return {
            x: dx * cos - dy * sin,
            y: dx * sin + dy * cos
        };
    }

    private layerCollisionMatrix: Record<number, number> = {};

    public updateCollisionConfig(_layers: string[], matrix: Record<number, number>) {
        // Store the matrix (Index -> Mask) directly
        this.layerCollisionMatrix = matrix || {};
        // console.log('[PhysicsSystem] Updated Collision Matrix:', JSON.parse(JSON.stringify(this.layerCollisionMatrix)));

        // Update Existing Bodies
        const entitiesWithBody = world.with('physicsBody');
        for (const entity of entitiesWithBody) {
             const body = entity.physicsBody as Matter.Body;
             this.updateBodyCollisionFilter(entity, body);
        }
        
        // Update Tile Bodies
        for (const [key, body] of this.tileBodies) {
             const parts = key.split(':');
             // LayerID is roughly meaningless for lookup now, we need index.
             // TileBodies need a way to know their LayerIndex.
             // For now, we look up by Name/ID -> Index
             const layerId = parts[0] || '';
             const layer = SceneManager.getLayerById(layerId);
             const layerName = layer ? layer.name : 'Default';
             const layerIndex = SceneManager.getLayerIndex(layerName);
             
             const category = 1 << layerIndex;
             const mask = this.layerCollisionMatrix[layerIndex] ?? 0xFFFFFFFF;
             
             if (body.collisionFilter.category !== category || body.collisionFilter.mask !== mask) {
                 Matter.Body.set(body, 'collisionFilter', { category, mask, group: 0 });
             }
        }
    }

    private updateBodyCollisionFilter(entity: any, body: Matter.Body) {
        if (typeof (entity as any).layerIndex !== 'number') {
            const rawLayer = entity.layer || 'Default';
            const layerName = SceneManager.getLayerById(rawLayer)?.name || rawLayer;
            (entity as any).layerIndex = SceneManager.getLayerIndex(layerName);
            // If still -1, default to 0 (Default Layer)
            if ((entity as any).layerIndex === -1) (entity as any).layerIndex = 0; 
        }

        const index = entity.layerIndex;
        const category = 1 << index;
        const mask = this.layerCollisionMatrix[index] ?? 0xFFFFFFFF; // Default = Collide All

        if (body.collisionFilter.category !== category || body.collisionFilter.mask !== mask) {
             Matter.Body.set(body, 'collisionFilter', { category, mask, group: 0 });
        }
    }

    private syncBodies() {
        // 1. Initialize bodies for new entities
        const entitiesWithBody = world.with('transform', 'rigidBody');
        
        for (const entity of entitiesWithBody) {
            let w = 0, h = 0;
            if (entity.boxCollider) { 
                w = entity.boxCollider.width; 
                h = entity.boxCollider.height; 
            } else if (entity.circleCollider) { 
                w = entity.circleCollider.radius * 2; 
                h = w; 
            }

            const sx = Math.abs(entity.transform.scale.x) || 0.001;
            const sy = Math.abs(entity.transform.scale.y) || 0.001;

            if (!entity.physicsBody) {
                const { x, y, rotation } = entity.transform;
                const { isStatic, friction, restitution } = entity.rigidBody;
                
                // Determine Collision Filter
                // Ensure index is resolved
                if (typeof (entity as any).layerIndex !== 'number') {
                    const rawLayer = entity.layer || 'Default';
                    const layerName = SceneManager.getLayerById(rawLayer)?.name || rawLayer;
                    (entity as any).layerIndex = SceneManager.getLayerIndex(layerName);
                    if ((entity as any).layerIndex === -1) (entity as any).layerIndex = 0;
                }
                
                const index = (entity as any).layerIndex;
                const category = 1 << index;
                const mask = this.layerCollisionMatrix[index] ?? 0xFFFFFFFF;
                
                // console.log(`[PhysicsDebug] '${entity.name}' | Index: ${index} | Cat: ${category} | Mask: ${mask}`);

                const collisionFilter = { category, mask };

                let body: Matter.Body | null = null;

                if (entity.boxCollider) {
                    const scaledW = w * sx;
                    const scaledH = h * sy;
                    const offset = this.getBodyOffset(entity, scaledW, scaledH, rotation);
                    
                    body = Matter.Bodies.rectangle(x + offset.x, y + offset.y, scaledW, scaledH, {
                        isStatic, angle: rotation, friction, restitution, collisionFilter
                    });
                } else if (entity.circleCollider) {
                     const radius = (entity.circleCollider.radius) * Math.max(sx, sy);
                     const offset = this.getBodyOffset(entity, radius * 2, radius * 2, rotation); // Circle offset

                     body = Matter.Bodies.circle(x + offset.x, y + offset.y, radius, {
                        isStatic, angle: rotation, friction, restitution, collisionFilter
                    });
                } else if (entity.polygonCollider) {
                    let activeVertices = entity.polygonCollider.vertices;

                    // Frame-Specific Override
                    if (entity.animator && entity.animator.isPlaying && entity.animator.currentAnim) {
                        const animName = entity.animator.currentAnim;
                        const animData = entity.animator.animations[animName];
                        if (animData && animData.frames.length > 0) {
                            const frameDuration = 1 / (animData.speed || 10);
                            const currentFrameIndex = Math.floor(entity.animator.elapsedTime / frameDuration) % animData.frames.length;
                            if (entity.polygonCollider.frames?.[animName]?.[currentFrameIndex]) {
                                activeVertices = entity.polygonCollider.frames[animName][currentFrameIndex];
                            }
                        }
                    }

                    if (activeVertices.length >= 3) {
                         const cloneVerts = activeVertices.map(v => ({ x: v.x, y: v.y })); 
                         const scaledVerts = cloneVerts.map(v => ({ x: v.x * sx, y: v.y * sy }));

                         body = Matter.Bodies.fromVertices(x, y, [scaledVerts], {
                            isStatic, angle: rotation, friction, restitution, collisionFilter
                         }, true);

                         if (body) {
                            (body as any)._lastVertices = activeVertices; 
                         }
                    }
                }

                if (body) {
                    (body as any)._lastScale = { x: sx, y: sy };
                    (body as any)._lastDims = { w, h };
                    (body as any)._entity = entity; // O(1) Lookup for Events
                    
                    // CRITICAL: Use addComponent so Miniplex updates query buckets
                    world.addComponent(entity, 'physicsBody', body);
                    Matter.World.add(this.engine.world, body);
                }
            } else {
                const body = entity.physicsBody as Matter.Body;
                 // Ensure entity reference is kept sync (just in case)
                if ((body as any)._entity !== entity) (body as any)._entity = entity;

                // 2. Sync Physics -> ECS (Dynamic)
                if (!entity.rigidBody.isStatic) {
                   const rotation = body.angle;
                   
                   if (entity.boxCollider || entity.circleCollider) {
                       const currentSx = Math.abs(entity.transform.scale.x) || 0.001;
                       const currentSy = Math.abs(entity.transform.scale.y) || 0.001;
                       let curW = 0, curH = 0;
                       if (entity.boxCollider) { curW = entity.boxCollider.width * currentSx; curH = entity.boxCollider.height * currentSy; }
                       if (entity.circleCollider) { const r = entity.circleCollider.radius * Math.max(currentSx, currentSy); curW = r*2; curH = r*2; }
                       
                       const offset = this.getBodyOffset(entity, curW, curH, rotation);
                       entity.transform.x = body.position.x - offset.x;
                       entity.transform.y = body.position.y - offset.y;
                   } else {
                       entity.transform.x = body.position.x;
                       entity.transform.y = body.position.y;
                   }
                   entity.transform.rotation = rotation;

                } else {
                    // 3. Sync ECS -> Physics (Static / Editor Updates)
                    const { x, y, rotation } = entity.transform;

                    if (entity.polygonCollider) {
                         let targetVertices = entity.polygonCollider.vertices;
                         
                         if (entity.animator && entity.animator.isPlaying && entity.animator.currentAnim) {
                            const animName = entity.animator.currentAnim;
                            const animData = entity.animator.animations[animName];
                            if (animData && animData.frames.length > 0) {
                                const frameDuration = 1 / (animData.speed || 10);
                                const currentFrameIndex = Math.floor(entity.animator.elapsedTime / frameDuration) % animData.frames.length;
                                
                                if (entity.polygonCollider.frames?.[animName]?.[currentFrameIndex]) {
                                    targetVertices = entity.polygonCollider.frames[animName][currentFrameIndex];
                                }
                            }
                         }

                         const lastVerts = (body as any)._lastVertices;
                         if (lastVerts !== targetVertices) {
                             const scaledVerts = targetVertices.map(v => ({ x: v.x * sx, y: v.y * sy }));
                             Matter.Body.setVertices(body, scaledVerts);
                             (body as any)._lastVertices = targetVertices;
                         }
                         
                         Matter.Body.setAngle(body, rotation);
                         Matter.Body.setPosition(body, { x: x, y: y });
                    }
                    
                    const lastScale = (body as any)._lastScale || { x: 1, y: 1 };
                    const lastDims = (body as any)._lastDims || { w, h };
                    
                    let reScaleX = 1;
                    let reScaleY = 1;
                    let needsRescale = false;

                    if (Math.abs(sx - lastScale.x) > 0.001 || Math.abs(sy - lastScale.y) > 0.001) {
                         reScaleX = sx / lastScale.x;
                         reScaleY = sy / lastScale.y;
                         needsRescale = true;
                    }

                    if (Math.abs(w - lastDims.w) > 0.001 || Math.abs(h - lastDims.h) > 0.001) {
                        const dimScaleX = w / lastDims.w;
                        const dimScaleY = h / lastDims.h;
                        reScaleX *= dimScaleX;
                        reScaleY *= dimScaleY;
                        needsRescale = true;
                    }

                    if (needsRescale) {
                        if (entity.circleCollider) {
                             const oldRadius = (lastDims.w / 2) * Math.max(lastScale.x, lastScale.y);
                             const newRadius = (w / 2) * Math.max(sx, sy);
                             const factor = newRadius / oldRadius;
                             Matter.Body.scale(body, factor, factor);
                        } else if (entity.boxCollider) {
                             Matter.Body.scale(body, reScaleX, reScaleY);
                        }

                        (body as any)._lastScale = { x: sx, y: sy };
                        (body as any)._lastDims = { w, h };
                    }

                    if (entity.boxCollider || entity.circleCollider) {
                         const scaledW = w * sx;
                         const scaledH = h * sy;
                         const offset = this.getBodyOffset(entity, scaledW, scaledH, rotation);
                         Matter.Body.setPosition(body, { x: x + offset.x, y: y + offset.y });
                         Matter.Body.setAngle(body, rotation);
                    }
                }
            }
        }
    }
}
