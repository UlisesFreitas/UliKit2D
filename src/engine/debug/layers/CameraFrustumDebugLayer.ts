import { Application, Graphics } from 'pixi.js';
import { world } from '../../ecs/ECS';
import type { DebugLayer } from '../DebugLayer';

export class CameraFrustumDebugLayer implements DebugLayer {
    public name = 'Camera Frustum';
    public enabled = true;
    private app: Application;

    constructor(app: Application) {
        this.app = app;
    }

    public update(g: Graphics) {
        if (!this.enabled) return;

        const entities = world.with('camera', 'transform');
        const lineWidth = 2; // Fixed screen width line

        for (const entity of entities) {
            const t = entity.transform;
            const cam = entity.camera;
            
            // Calculate Frustum Size based on Game Resolution and Camera Zoom
            // In UliKit2D, the "Game Resolution" is currently the Canvas Size (Immortal Canvas).
            // This might be dynamic if the window resizes. 
            // Ideally, we should use a "Target Resolution" from settings if it exists, 
            // but for now, app.screen is the best proxy for "What is being rendered".
            
            const zoom = cam.zoom || 1;
            const w = this.app.screen.width / zoom;
            const h = this.app.screen.height / zoom;

            // Offset Geometry
            const corners = [
                { x: -w/2, y: -h/2 },
                { x: w/2, y: -h/2 },
                { x: w/2, y: h/2 },
                { x: -w/2, y: h/2 }
            ];

            const cos = Math.cos(t.rotation);
            const sin = Math.sin(t.rotation);
            
            const first = corners[0];
            if (!first) continue;

            const transform = (p: {x: number, y: number}) => ({
                x: (p.x * cos - p.y * sin) + t.x,
                y: (p.x * sin + p.y * cos) + t.y
            });

            const p0 = transform(first);

            g.beginPath();
            g.moveTo(p0.x, p0.y);

            for (let i = 1; i < corners.length; i++) {
                const p = corners[i];
                if (p) {
                    const transformed = transform(p);
                    g.lineTo(transformed.x, transformed.y);
                }
            }
            g.lineTo(p0.x, p0.y);
            g.stroke({ width: lineWidth, color: 0xFFFF00, alpha: 0.8 }); // Yellow
        }
    }
}
