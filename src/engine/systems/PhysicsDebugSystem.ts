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

    public update() {
        this.graphics.clear();
        
        const zoom = this.app.stage.scale.x || 1;
        const lineWidth = 2 / zoom;

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
            this.graphics.stroke({ width: lineWidth, color: 0x00FF00, alpha: 0.8 });
        }

        // Also Draw BoxCollider/CircleCollider Gizmos even if NO BODY (Editor Mode)
        const editorEntities = world.with('transform');
        for (const entity of editorEntities) {
            if (entity.physicsBody) continue; // Already drawn by body loop

            const t = entity.transform;
            
            if (entity.boxCollider) {
                 const w = entity.boxCollider.width * t.scale.x;
                 const h = entity.boxCollider.height * t.scale.y; 
                 
                 const offset = this.getBodyOffset(entity, w, h, t.rotation);
                 
                 const corners = [
                     { x: -w/2, y: -h/2 },
                     { x: w/2, y: -h/2 },
                     { x: w/2, y: h/2 },
                     { x: -w/2, y: h/2 }
                 ];

                 const cos = Math.cos(t.rotation);
                 const sin = Math.sin(t.rotation);
                 
                 const cx = t.x + offset.x;
                 const cy = t.y + offset.y;

                 const transformed = corners.map(p => ({
                     x: (p.x * cos - p.y * sin) + cx,
                     y: (p.x * sin + p.y * cos) + cy
                 }));

                 this.graphics.beginPath();
                 const p0 = transformed[0];
                 if (p0) this.graphics.moveTo(p0.x, p0.y);
                 
                 for (let i=1; i<transformed.length; i++) {
                     const p = transformed[i];
                     if (p) this.graphics.lineTo(p.x, p.y);
                 }
                 if (p0) this.graphics.lineTo(p0.x, p0.y);
                 
                 this.graphics.stroke({ width: lineWidth, color: 0x00FFFF, alpha: 0.5 });
            }

            if (entity.circleCollider) {
                const r = entity.circleCollider.radius * Math.max(t.scale.x, t.scale.y);
                
                const w = r * 2;
                const offset = this.getBodyOffset(entity, w, w, t.rotation);

                this.graphics.beginPath();
                this.graphics.circle(t.x + offset.x, t.y + offset.y, r);
                this.graphics.stroke({ width: lineWidth, color: 0x00FFFF, alpha: 0.5 });
            }
        }
    }
}
