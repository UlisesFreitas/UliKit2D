import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/ECS';
import { instance as selectionManager } from '../../editor/managers/SelectionManager';



export class EditorDebugSystem {
    private app: Application;
    private container: Container;
    private debugGraphics: Map<string, Graphics> = new Map();
    private debugLabels: Map<string, Text> = new Map();

    constructor(app: Application) {
        this.app = app;
        this.container = new Container();
        this.container.zIndex = 999999; // Ensure Above Everything
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
            
            // RenderSystem handles Sprites/Labels. DebugSystem handles the rest (Mockups, Invisible Entities, CAMERAS).
            // FIX: Explicitly exclude Camera entities, as they are rendered by RenderSystem (Icon)
            if (!hasVisibleSprite && !hasVisibleLabel && !hasVisibleBitmapText && !hasVisibleNineSlice && !entity.camera) {
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
        // VISIBILITY LOGIC:
        const isHovered = selectionManager.hoveredEntityId === id;
    
        if (!isHovered) {
            this.removeLabel(id);
            return;
        }

        // 1. Calculate Inverse Scale (Essential for Fixed Screen Size)
        let inverseScale = 1;
        if (this.container.parent && Math.abs(this.container.parent.scale.x) > 0.001) {
             inverseScale = 1 / Math.abs(this.container.parent.scale.x);
        }

        // 2. Manage Container (Stored in debugLabels, cast as any)
        let labelContainer = this.debugLabels.get(id) as any;
        
        // Ensure we have a proper Container (not just a Text or Graphics from previous iterations)
        if (!labelContainer || !labelContainer.addChild || !labelContainer.label) {
            if (labelContainer) (labelContainer as any).destroy();

            labelContainer = new Container();
            labelContainer.eventMode = 'none';
            labelContainer.label = 'DebugLabelContainer';

            // Background (Graphics)
            const bg = new Graphics();
            bg.label = 'bg';
            
            // Text
            const style = new TextStyle({
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fill: '#ffffff',
                align: 'left',
            });
            const text = new Text({ text: '', style });
            text.label = 'text';
            text.resolution = 2; // Sharpness
            
            labelContainer.addChild(bg);
            labelContainer.addChild(text);
            
            this.container.addChild(labelContainer);
            this.debugLabels.set(id, labelContainer);
        }

        // 3. Update Content & Layout
        const textObj = labelContainer.children.find((c: any) => c.label === 'text') as Text;
        const bgObj = labelContainer.children.find((c: any) => c.label === 'bg') as Graphics;

        if (!textObj || !bgObj) return;

        const layerName = entity.layer || 'Base Layer';
        const zIndex = entity.transform.zIndex || 0;
        const txtContent = `${entity.name || 'Entity'}\nX: ${Math.round(entity.transform.x)} Y: ${Math.round(entity.transform.y)}\nL: ${layerName} Z: ${zIndex}`;
        
        if (textObj.text !== txtContent) textObj.text = txtContent;

        // Resize Background to fit Text
        const padding = 6;
        const width = textObj.width + padding * 2;
        const height = textObj.height + padding * 2;
        
        bgObj.clear();
        bgObj.roundRect(0, 0, width, height, 4);
        bgObj.fill({ color: 0x000000, alpha: 0.75 });
        bgObj.stroke({ width: 1, color: 0x444444 });

        textObj.position.set(padding, padding);
        
        // 4. Transform & Positioning
        labelContainer.scale.set(inverseScale);
        
        // Pivot: Bottom-Center (so it floats ABOVE the anchor)
        labelContainer.pivot.set(width / 2, height + 10); 
        
        // Position: At Entity Center minus vertical offset for Icon Radius * Scale
        // 32px world offset * scale ensures it clears the Camera Icon
        const scaleY = entity.transform.scale ? Math.abs(entity.transform.scale.y) : 1;
        labelContainer.position.set(entity.transform.x, entity.transform.y - (20 * scaleY));
        
        // Ensure on top
        labelContainer.zIndex = 99999;
    }

    private removeLabel(id: string) {
        const text = this.debugLabels.get(id);
        if (text) {
            text.destroy();
            this.debugLabels.delete(id);
        }
    }

    public onEntityClicked: ((id: string) => void) | null = null;
    
    private drawPlaceholder(g: Graphics, entity: any) {
        g.clear();
        
        g.eventMode = 'none';
        g.cursor = 'default';

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
