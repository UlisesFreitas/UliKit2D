import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/ECS';

export class EditorDebugSystem {
    private app: Application;
    private container: Container;
    private debugGraphics: Map<string, Graphics> = new Map();
    private debugLabels: Map<string, Text> = new Map();

    constructor(app: Application) {
        this.app = app;
        this.container = new Container();
        this.container.zIndex = 999; // Below Gizmos (9999) but above content
        this.app.stage.addChild(this.container);
        this.app.stage.sortableChildren = true;
    }

    public update() {
        const entities = world.with('transform');

        // Identify active entities to keep
        const activeIds = new Set<string>();

        for (const entity of entities) {
            const id = entity.id as string;
            activeIds.add(id);

            // Check if entity needs a debug placeholder
            // Condition: No Sprite AND No Label AND NOT Camera
            // Cameras are handled by RenderSystem with an Icon.
            const hasVisibleSprite = entity.sprite && entity.sprite.texture && entity.sprite.texture.trim() !== '';
            const hasVisibleLabel = entity.label && entity.label.text && entity.label.text.trim() !== '';
            const hasVisibleBitmapText = entity.bitmapText && entity.bitmapText.text && entity.bitmapText.text.trim() !== '';
            const hasVisibleNineSlice = entity.nineSliceSprite && entity.nineSliceSprite.texture && entity.nineSliceSprite.texture.trim() !== '';
            
            // SKIP CAMERAS (RenderSystem handles them)
            if (!entity.camera && !hasVisibleSprite && !hasVisibleLabel && !hasVisibleBitmapText && !hasVisibleNineSlice) {
                let graphics = this.debugGraphics.get(id);
                if (!graphics) {
                    graphics = new Graphics();
                    this.container.addChild(graphics);
                    this.debugGraphics.set(id, graphics);
                }

                // Draw Placeholder (Hollow Box with Cross)
                this.drawPlaceholder(graphics, entity);
            } else {
                // If it HAS a sprite, remove debug graphics if exists
                this.removeGraphics(id);
            }

            // UPDATE DEBUG LABEL
            this.updateLabel(id, entity);
        }

        // Cleanup stale graphics
        for (const [id] of this.debugGraphics) {
            if (!activeIds.has(id)) {
                this.removeGraphics(id);
            }
        }
        
        // Cleanup stale labels
        for (const [id] of this.debugLabels) {
            if (!activeIds.has(id)) {
                this.removeLabel(id);
            }
        }
    }

    private updateLabel(id: string, entity: any) {
        let text = this.debugLabels.get(id);
        if (!text) {
            const style = new TextStyle({
                fontFamily: 'monospace',
                fontSize: 10,
                fill: '#ffffff',
                stroke: { color: '#000000', width: 3, join: 'round' },
                align: 'center',
                dropShadow: {
                    color: '#000000',
                    blur: 2,
                    distance: 1,
                    alpha: 1,
                    angle: Math.PI / 6
                },
            });
            text = new Text({ text: '', style });
            text.anchor.set(0.5, 1); // Bottom Center anchor (grows up)
            text.eventMode = 'none'; // Ensure clicks pass through to entity
            this.container.addChild(text);
            this.debugLabels.set(id, text);
        }
        
        const { x, y } = entity.transform;
        
        // Offset based on generic size assumption
        // Ideally we check bounds, but transform only has pos
        // Let's float it 40px above
        text.x = x;
        text.y = y - 40; 
        
        text.text = `${entity.name || 'Entity'}\nX: ${Math.round(x)} Y: ${Math.round(y)}\nL: ${entity.layer || 'Base'} Z: ${entity.transform.zIndex || 0}`;
        text.zIndex = 1000;
    }

    private removeLabel(id: string) {
        const text = this.debugLabels.get(id);
        if (text) {
            text.destroy();
            this.debugLabels.delete(id);
        }
    }

    public onEntityClicked: ((id: string) => void) | null = null;
    
    // ... rest of methods

    private drawPlaceholder(g: Graphics, entity: any) {
        g.clear();
        
        // Make interactive
        g.eventMode = 'static';
        g.cursor = 'pointer';
        g.on('pointerdown', (e) => {
            if (this.onEntityClicked) {
                 this.onEntityClicked(entity.id);
            }
            e.stopPropagation(); // Prevent scene drag start if possible
        });

        const { x, y, rotation } = entity.transform;
        
        // Apply Transform to Graphics Container
        g.position.set(x, y);
        g.rotation = rotation;
        // Optional: Apply scale if desired, but user only asked for rotation. 
        // Keeping size constant (60) makes it easier to find/grab, 
        // but rotating requires local coordinate space.
        
        const size = 60;
        
        // Draw in local space (centered)
        g.rect(-size/2, -size/2, size, size);
        g.fill({ color: 0x00FFFF, alpha: 0.2 }); // Cyan transparent fill
        g.stroke({ width: 4, color: 0x00FFFF, alpha: 0.8 }); // Thick border
        
        // Cross
        g.moveTo(-size/2, -size/2);
        g.lineTo(size/2, size/2);
        
        g.moveTo(size/2, -size/2);
        g.lineTo(-size/2, size/2);
        
        g.stroke({ width: 2, color: 0x00FFFF, alpha: 0.5 });
    }

    private removeGraphics(id: string) {
        const graphics = this.debugGraphics.get(id);
        if (graphics) {
            this.container.removeChild(graphics);
            graphics.destroy();
            this.debugGraphics.delete(id);
        }
    }

    public dispose() {
        this.app.stage.removeChild(this.container);
        this.container.destroy({ children: true });
    }
}
