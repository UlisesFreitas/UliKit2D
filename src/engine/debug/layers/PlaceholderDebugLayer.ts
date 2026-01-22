import { Graphics } from 'pixi.js';
import { world } from '../../ecs/ECS';
import type { DebugLayer } from '../DebugLayer';

export class PlaceholderDebugLayer implements DebugLayer {
    public name = 'Placeholders';
    public enabled = true;

    // Cache to check which entities active. 
    // Ideally we redraw every frame for immediate transform updates, 
    // or use cached Graphics if performance is an issue.
    // The previous system used cached graphics PER entity. 
    // A single Graphics context is faster for batching if we clear() every frame.
    // Let's try single Graphics context first (immediate mode style).
    
    public update(g: Graphics) {
        if (!this.enabled) return;

        const entities = world.with('transform');

        for (const entity of entities) {
            // Logic from old EditorDebugSystem
            const hasVisibleSprite = entity.sprite && entity.sprite.texture && entity.sprite.texture.trim() !== '';
            const hasVisibleLabel = entity.label && entity.label.text && entity.label.text.trim() !== '';
            const hasVisibleBitmapText = entity.bitmapText && entity.bitmapText.text && entity.bitmapText.text.trim() !== '';
            const hasVisibleNineSlice = entity.nineSliceSprite && entity.nineSliceSprite.texture && entity.nineSliceSprite.texture.trim() !== '';
            
            // If it has NO visual representation (and not a camera), draw placeholder
            if (!hasVisibleSprite && !hasVisibleLabel && !hasVisibleBitmapText && !hasVisibleNineSlice && !entity.camera) {
                this.drawPlaceholder(g, entity);
            }
        }
    }

    private drawPlaceholder(g: Graphics, entity: any) {
        const { x, y, rotation } = entity.transform;
        const size = 60;
        
        // Save Context (Transform)
        // Graphics doesn't support push/pop matrix easily in this immediate mode 
        // without drawing separate graphics objects or manual vertex calc.
        // For simplicity in a single-draw-call system, manual transform is needed.
        // OR we use the previous approach of Map<ID, Graphics>.
        
        // DECISION: Map<ID, Graphics> is heavy. 
        // Manual vertex calc is fast.
        
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        const transform = (lx: number, ly: number) => ({
            x: x + (lx * cos - ly * sin),
            y: y + (lx * sin + ly * cos)
        });

        const p1 = transform(-size/2, -size/2);
        const p2 = transform(size/2, -size/2);
        const p3 = transform(size/2, size/2);
        const p4 = transform(-size/2, size/2);

        // Rect
        g.beginPath();
        g.moveTo(p1.x, p1.y);
        g.lineTo(p2.x, p2.y);
        g.lineTo(p3.x, p3.y);
        g.lineTo(p4.x, p4.y);
        g.lineTo(p1.x, p1.y); // Close
        
        g.stroke({ width: 4, color: 0x00FFFF, alpha: 0.5 }); // Cyan
        
        // Cross
        g.moveTo(p1.x, p1.y);
        g.lineTo(p3.x, p3.y);
        
        g.moveTo(p2.x, p2.y);
        g.lineTo(p4.x, p4.y);
        
        g.stroke({ width: 2, color: 0x00FFFF, alpha: 0.3 });
    }
}
