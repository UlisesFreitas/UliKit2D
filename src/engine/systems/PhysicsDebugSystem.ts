import { Application, Container, Graphics } from 'pixi.js';
import { world } from '../ecs/ECS';
import Matter from 'matter-js';

export class PhysicsDebugSystem {
    private app: Application;
    private container: Container;
    private graphics: Graphics;

    constructor(app: Application) {
        this.app = app;
        this.container = new Container();
        this.container.label = 'PhysicsDebug';
        this.container.zIndex = 999; // Top most
        this.container.visible = true; // Default visible for now
        
        this.graphics = new Graphics();
        this.container.addChild(this.graphics);
        this.app.stage.addChild(this.container);
    }

    public update() {
        this.graphics.clear();
        
        // Draw Static/Dynamic Bodies from ECS
        const entities = world.with('physicsBody');
        
        for (const entity of entities) {
            const body = entity.physicsBody as Matter.Body;
            if (!body) continue;

            this.graphics.beginPath();
            
            // Draw Vertices
            const vertices = body.vertices;
            if (vertices && vertices.length > 0) {
                const first = vertices[0];
                if (first) this.graphics.moveTo(first.x, first.y);
                
                for (let i = 1; i < vertices.length; i++) {
                    const v = vertices[i];
                    if (v) this.graphics.lineTo(v.x, v.y);
                }
                
                if (first) this.graphics.lineTo(first.x, first.y);
            }

            // Stroke Style
            // Green for active, Gray for sleeping?
            this.graphics.stroke({ width: 2, color: 0x00FF00, alpha: 0.8 });
        }

        // Also Draw BoxCollider/CircleCollider Gizmos even if NO BODY (Editor Mode)
        // This helps user see where colliders ARE defined even if simulation is stopped.
        const nonBodyEntities = world.with('transform'); // We iterate all transform to check colliders
        
        // Use a different color for "Editor Definitions" (Cyan) vs "Live Physics" (Green)
        // But preventing overlapping mess...
        // Let's draw "Live Physics" (Green) if body exists.
        // And "Definition" (Cyan) if NO body exists.

        const editorEntities = world.with('transform');
        for (const entity of editorEntities) {
            if (entity.physicsBody) continue; // Already drawn by body loop

            const t = entity.transform;
            
            if (entity.boxCollider) {
                 const w = entity.boxCollider.width * t.scale.x;
                 const h = entity.boxCollider.height * t.scale.y; // Match Entity Scale!
                 
                 // Apply Rotation math if needed... simplified for AABB debug or rotate graphics?
                 // Pixi Graphics rotation is local.
                 // We can draw untransformed rect inside a transformed container? No, expensive.
                 // Calc vertices manually.
                 
                 const corners = [
                     { x: -w/2, y: -h/2 },
                     { x: w/2, y: -h/2 },
                     { x: w/2, y: h/2 },
                     { x: -w/2, y: h/2 }
                 ];

                 // Rotate and Translate
                 const cos = Math.cos(t.rotation);
                 const sin = Math.sin(t.rotation);
                 
                 const transformed = corners.map(p => ({
                     x: (p.x * cos - p.y * sin) + t.x,
                     y: (p.x * sin + p.y * cos) + t.y
                 }));

                 this.graphics.beginPath();
                 const p0 = transformed[0];
                 if (p0) this.graphics.moveTo(p0.x, p0.y);
                 
                 for (let i=1; i<transformed.length; i++) {
                     const p = transformed[i];
                     if (p) this.graphics.lineTo(p.x, p.y);
                 }
                 if (p0) this.graphics.lineTo(p0.x, p0.y);
                 
                 this.graphics.stroke({ width: 2, color: 0x00FFFF, alpha: 0.5 }); // Cyan for Definition
            }

            if (entity.circleCollider) {
                // Circle doesn't rotate (visually)
                // Radius scales with max scale?
                const r = entity.circleCollider.radius * Math.max(t.scale.x, t.scale.y);
                this.graphics.beginPath();
                this.graphics.circle(t.x, t.y, r);
                this.graphics.stroke({ width: 2, color: 0x00FFFF, alpha: 0.5 });
            }
        }
    }
}
