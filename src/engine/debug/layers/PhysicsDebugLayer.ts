import { Graphics } from 'pixi.js';
import { world } from '../../ecs/ECS';
import type { DebugLayer } from '../DebugLayer';
import Matter from 'matter-js';

export class PhysicsDebugLayer implements DebugLayer {
    public name = 'Physics';
    public enabled = true;

    public update(g: Graphics) {
        if (!this.enabled) return;

        // 1. Draw Physical Bodies (Matter.js)
        this.drawPhysicsBodies(g);

        // 2. Draw Colliders (Editor Gizmos)
        this.drawColliderGizmos(g);
    }

    private drawPhysicsBodies(g: Graphics) {
        // zoom is unused for now, kept logic simple
        const lineWidth = 2;

        const entities = world.with('physicsBody');
        for (const entity of entities) {
            const body = entity.physicsBody as Matter.Body;
            if (!body) continue;

            const vertices = body.vertices;
            if (vertices && vertices.length > 0) {
                 g.beginPath();
                 const first = vertices[0];
                 if (first) {
                    g.moveTo(first.x, first.y);
                    for (let i = 1; i < vertices.length; i++) {
                        const v = vertices[i];
                        if (v) {
                            g.lineTo(v.x, v.y);
                        }
                    }
                    g.lineTo(first.x, first.y);
                    g.stroke({ width: lineWidth, color: 0x00FF00, alpha: 0.8 }); // Green
                 }
            }
        }
    }

    private drawColliderGizmos(g: Graphics) {
        const entities = world.with('transform');
        const lineWidth = 2; // Fixed width

        for (const entity of entities) {
            
            if (entity.physicsBody) continue; 

            const t = entity.transform;

            // BoxCollider
            if (entity.boxCollider && (entity.boxCollider.show !== false)) {
                this.drawBox(g, entity, t, lineWidth);
            }

            // CircleCollider
            if (entity.circleCollider && (entity.circleCollider.show !== false)) {
                this.drawCircle(g, entity, t, lineWidth);
            }

            // PolygonCollider
            if (entity.polygonCollider && entity.polygonCollider.show) {
                this.drawPolygon(g, entity, t, lineWidth);
            }
        }
    }

    private drawBox(g: Graphics, entity: any, t: any, lineWidth: number) {
        const w = entity.boxCollider.width * t.scale.x;
        const h = entity.boxCollider.height * t.scale.y;
        
        const offset = this.getBodyOffset(entity, w, h, t.rotation);
        
        const cx = t.x + offset.x;
        const cy = t.y + offset.y;
        const cos = Math.cos(t.rotation);
        const sin = Math.sin(t.rotation);

        const corners = [
            { x: -w/2, y: -h/2 },
            { x: w/2, y: -h/2 },
            { x: w/2, y: h/2 },
            { x: -w/2, y: h/2 }
        ];

        
        const first = corners[0];
        if (!first) return;

        const p0 = {
            x: (first.x * cos - first.y * sin) + cx,
            y: (first.x * sin + first.y * cos) + cy
        };

        g.beginPath();
        g.moveTo(p0.x, p0.y);

        for (let i = 1; i < corners.length; i++) {
            const p = corners[i];
            if (p) {
                const px = (p.x * cos - p.y * sin) + cx;
                const py = (p.x * sin + p.y * cos) + cy;
                g.lineTo(px, py);
            }
        }
        g.lineTo(p0.x, p0.y);
        g.stroke({ width: lineWidth, color: 0xFF00FF, alpha: 0.8 }); // Magenta
    }

    private drawCircle(g: Graphics, entity: any, t: any, lineWidth: number) {
        const r = entity.circleCollider.radius * Math.max(t.scale.x, t.scale.y); // Approx scale
        const w = r * 2;
        const offset = this.getBodyOffset(entity, w, w, t.rotation);

        const cx = t.x + offset.x;
        const cy = t.y + offset.y;

        g.beginPath();
        g.circle(cx, cy, r);
        g.stroke({ width: lineWidth, color: 0xFF00FF, alpha: 0.8 });
    }

    private drawPolygon(g: Graphics, entity: any, t: any, lineWidth: number) {
        let vertices = entity.polygonCollider.vertices;
        
        // Animation Frame Logic
        if (entity.animator && entity.animator.isPlaying && entity.animator.currentAnim) {
            const animName = entity.animator.currentAnim;
            const animData = entity.animator.animations[animName];
            if (animData && animData.frames.length > 0) {
                 const frameDuration = 1 / (animData.speed || 10);
                 const currentFrameIndex = Math.floor(entity.animator.elapsedTime / frameDuration) % animData.frames.length;
                 
                 if (entity.polygonCollider.frames?.[animName]?.[currentFrameIndex]) {
                     vertices = entity.polygonCollider.frames[animName][currentFrameIndex];
                 }
            }
        }

        if (vertices && vertices.length > 0) {
             const transformPoint = (p: {x: number, y: number}) => {
                 const sx = p.x * t.scale.x;
                 const sy = p.y * t.scale.y;
                 const cos = Math.cos(t.rotation);
                 const sin = Math.sin(t.rotation);
                 return {
                     x: (sx * cos - sy * sin) + t.x,
                     y: (sx * sin + sy * cos) + t.y
                 };
             };

            g.beginPath();
            const v0 = vertices[0];
            const p0 = transformPoint(v0);
            g.moveTo(p0.x, p0.y);

            for (let i = 1; i < vertices.length; i++) {
                const p = transformPoint(vertices[i]);
                g.lineTo(p.x, p.y);
            }
            g.lineTo(p0.x, p0.y);
            g.stroke({ width: lineWidth, color: 0xFF00FF, alpha: 0.8 }); // Purple
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
}
