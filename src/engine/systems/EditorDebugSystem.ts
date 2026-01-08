import { Application, Container, Graphics } from 'pixi.js';
import { world } from '../ecs/ECS';

export class EditorDebugSystem {
    private app: Application;
    private container: Container;
    private debugGraphics: Map<string, Graphics> = new Map();

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
            // Condition: No Sprite AND No Label
            const hasVisibleSprite = entity.sprite && entity.sprite.texture && entity.sprite.texture.trim() !== '';
            const hasVisibleLabel = entity.label && entity.label.text && entity.label.text.trim() !== '';
            const hasVisibleBitmapText = entity.bitmapText && entity.bitmapText.text && entity.bitmapText.text.trim() !== '';
            const hasVisibleNineSlice = entity.nineSliceSprite && entity.nineSliceSprite.texture && entity.nineSliceSprite.texture.trim() !== '';
            if (!hasVisibleSprite && !hasVisibleLabel && !hasVisibleBitmapText && !hasVisibleNineSlice) {
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
        }

        // Cleanup stale graphics
        for (const [id] of this.debugGraphics) {
            if (!activeIds.has(id)) {
                this.removeGraphics(id);
            }
        }
    }

    public onEntityClicked: ((id: string) => void) | null = null;

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
