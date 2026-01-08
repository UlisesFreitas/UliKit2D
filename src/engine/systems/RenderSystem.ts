import { Application, Sprite, Texture, Text, BitmapText, FederatedPointerEvent, NineSliceSprite } from 'pixi.js';
import { world } from '../ecs/ECS';
import { resourceManager } from '../resources/ResourceManager';


export class RenderSystem {
    private app: Application;
    private spriteCache: Map<string, Sprite> = new Map();
    private textCache: Map<string, Text> = new Map();
    private bitmapTextCache: Map<string, BitmapText> = new Map();
    private nineSliceCache: Map<string, NineSliceSprite> = new Map();

    // Track which entities need texture updates (due to invalidation)
    private pendingUpdates: Set<string> = new Set(); 
    
    public onEntityClicked: ((id: string) => void) | null = null;

    constructor(app: Application) {
        this.app = app;
    }

    public update() {
        const entities = world.with('transform');
        const activeIds = new Set<string>();

        // ... (Animators)

        for (const entity of entities) {
            if (entity.bitmapText) {
                this.updateBitmapText(entity);
                this.removeLabel(entity.id!);
                this.removeSprite(entity.id!);
                this.removeNineSlice(entity.id!);
            } else if (entity.label) {
                this.updateLabel(entity);
                this.removeBitmapText(entity.id!);
                this.removeSprite(entity.id!);
                this.removeNineSlice(entity.id!);
            } else if (entity.nineSliceSprite) {
                this.updateNineSlice(entity);
                this.removeBitmapText(entity.id!);
                this.removeLabel(entity.id!);
                this.removeSprite(entity.id!);
            } else if (entity.sprite) {
                this.updateSprite(entity);
                this.removeBitmapText(entity.id!);
                this.removeLabel(entity.id!);
                this.removeNineSlice(entity.id!);
            } else {
                 // Cleanup
                 this.removeBitmapText(entity.id!);
                 this.removeLabel(entity.id!);
                 this.removeSprite(entity.id!);
                 this.removeNineSlice(entity.id!);
            }
            activeIds.add(entity.id!);
        }
        
        // Cleanup Removed Entities (Zombies)
        this.cleanupZombies(activeIds);
    }

    private cleanupZombies(activeIds: Set<string>) {
        for (const id of this.spriteCache.keys()) {
            if (!activeIds.has(id)) this.removeSprite(id);
        }
        for (const id of this.textCache.keys()) {
            if (!activeIds.has(id)) this.removeLabel(id);
        }
        for (const id of this.bitmapTextCache.keys()) {
            if (!activeIds.has(id)) this.removeBitmapText(id);
        }
        for (const id of this.nineSliceCache.keys()) {
            if (!activeIds.has(id)) this.removeNineSlice(id);
        }

    }



    // ... (updateSprite, updateLabel, updateBitmapText)

    private updateNineSlice(entity: any) {
        let nSlice = this.nineSliceCache.get(entity.id!);
        const texturePath = entity.nineSliceSprite.texture;

        if (!nSlice) {
            if (!texturePath) return;

             // Create with placeholder, will update texture later
             nSlice = new NineSliceSprite({
                 texture: Texture.EMPTY,
                 leftWidth: entity.nineSliceSprite.left,
                 topHeight: entity.nineSliceSprite.top,
                 rightWidth: entity.nineSliceSprite.right,
                 bottomHeight: entity.nineSliceSprite.bottom,
             });
             nSlice.anchor.set(0.5);

             // Interaction
             nSlice.eventMode = 'static';
             nSlice.cursor = 'pointer';
             nSlice.on('pointerdown', (e: FederatedPointerEvent) => {
                 e.stopPropagation();
                 if (this.onEntityClicked && entity.id) {
                     this.onEntityClicked(entity.id);
                 }
             });

             this.app.stage.addChild(nSlice);
             this.nineSliceCache.set(entity.id!, nSlice);
             (nSlice as any)._currentPath = '';
        }

        // Sync Transform
        nSlice.x = entity.transform.x;
        nSlice.y = entity.transform.y;
        nSlice.rotation = entity.transform.rotation;
        // NineSlice usually IGNORES scale if width/height are set, BUT we can simply Apply Scale to the container? No, NineSliceSprite extends Container?
        // Actually, NineSlice width/height IS the size. 
        // If we want Transform.Scale to affect it:
        // Option A: Use scale as multiplier for width/height.
        // Option B: Set width/height strictly, and let Scale be 1.
        // Standard in Game Engines: NineSlice uses Width/Height property for sizing, Transform Scale applies on top.
        nSlice.scale.set(entity.transform.scale.x, entity.transform.scale.y); 

        // Sync Dimensions & Slices
        if (nSlice.width !== entity.nineSliceSprite.width) nSlice.width = entity.nineSliceSprite.width;
        if (nSlice.height !== entity.nineSliceSprite.height) nSlice.height = entity.nineSliceSprite.height;
        
        if (nSlice.leftWidth !== entity.nineSliceSprite.left) nSlice.leftWidth = entity.nineSliceSprite.left;
        if (nSlice.rightWidth !== entity.nineSliceSprite.right) nSlice.rightWidth = entity.nineSliceSprite.right;
        if (nSlice.topHeight !== entity.nineSliceSprite.top) nSlice.topHeight = entity.nineSliceSprite.top;
        if (nSlice.bottomHeight !== entity.nineSliceSprite.bottom) nSlice.bottomHeight = entity.nineSliceSprite.bottom;

        nSlice.visible = entity.visible !== false;

        // Sync Texture
         if (texturePath) {
            if ((nSlice as any)._currentPath !== texturePath || this.pendingUpdates.has(entity.id!)) {
                (nSlice as any)._currentPath = texturePath;
                this.pendingUpdates.delete(entity.id!); 

                resourceManager.loadTexture(texturePath).then((texture) => {
                    if (texture && nSlice && (nSlice as any)._currentPath === texturePath) {
                        nSlice.texture = texture;
                    }
                });
            }
        }
    }

    private removeNineSlice(id: string) {
        if (this.nineSliceCache.has(id)) {
            const ns = this.nineSliceCache.get(id)!;
            this.app.stage.removeChild(ns);
            ns.destroy();
            this.nineSliceCache.delete(id);
        }
    }

    private updateSprite(entity: any) {
        let sprite = this.spriteCache.get(entity.id!);
        const texturePath = entity.sprite.texture;

        // Creation
        if (!sprite) {
            if (!texturePath) return; // Don't create if no texture

            // Create placeholder or waiting sprite
            sprite = new Sprite(Texture.EMPTY); 
            sprite.anchor.set(0.5);
            
            // Enable interaction
            sprite.eventMode = 'static';
            sprite.cursor = 'pointer';
            sprite.on('pointerdown', (e: FederatedPointerEvent) => {
                e.stopPropagation();
                if (this.onEntityClicked && entity.id) {
                    this.onEntityClicked(entity.id);
                }
            });

            this.app.stage.addChild(sprite);
            this.spriteCache.set(entity.id!, sprite);
            (sprite as any)._currentPath = ''; // Init tracker
        }

        // Sync Transform
        sprite.x = entity.transform.x;
        sprite.y = entity.transform.y;
        sprite.rotation = entity.transform.rotation;
        sprite.scale.set(entity.transform.scale.x, entity.transform.scale.y);

        // Sync Visibility
        sprite.visible = entity.visible !== false;

        // Sync Texture
        if (texturePath) {
            // If path changed OR explicitly marked for update
            if ((sprite as any)._currentPath !== texturePath || this.pendingUpdates.has(entity.id!)) {
                (sprite as any)._currentPath = texturePath;
                this.pendingUpdates.delete(entity.id!); // Clear flag

                resourceManager.loadTexture(texturePath).then((texture) => {
                    if (texture && sprite) {
                        // Verify race condition: did path change while loading?
                        if ((sprite as any)._currentPath === texturePath) {
                            sprite.texture = texture;
                            // Update ECS dimensions if needed
                            if (entity.sprite) {
                                entity.sprite.width = texture.width;
                                entity.sprite.height = texture.height;
                            }
                        }
                    }
                });
            }
        } else {
             sprite.texture = Texture.EMPTY;
             (sprite as any)._currentPath = '';
        }
    }

    private updateLabel(entity: any) {
        let textFn = this.textCache.get(entity.id!);

        if (!textFn) {
             // Create new Text
             textFn = new Text({
                 text: entity.label.text,
                 style: {
                     fontSize: entity.label.fontSize,
                     fontFamily: entity.label.fontFamily,
                     fill: entity.label.color,
                     align: entity.label.align
                 }
             });
             textFn.anchor.set(0.5);
             
             // Interaction
             textFn.eventMode = 'static';
             textFn.cursor = 'pointer';
             textFn.on('pointerdown', (e: FederatedPointerEvent) => {
                    e.stopPropagation();
                    if (this.onEntityClicked && entity.id) {
                        this.onEntityClicked(entity.id);
                    }
             });

             this.app.stage.addChild(textFn);
             this.textCache.set(entity.id!, textFn);
        }

        // Sync Properties
        if (textFn.text !== entity.label.text) textFn.text = entity.label.text;
        
        // Sync Style
        if (textFn.style.fontSize !== entity.label.fontSize) textFn.style.fontSize = entity.label.fontSize;
        if (textFn.style.fontFamily !== entity.label.fontFamily) textFn.style.fontFamily = entity.label.fontFamily;
        if (textFn.style.fill !== entity.label.color) textFn.style.fill = entity.label.color;
        if (textFn.style.align !== entity.label.align) textFn.style.align = entity.label.align;

        // Sync Transform
        textFn.x = entity.transform.x;
        textFn.y = entity.transform.y;
        textFn.rotation = entity.transform.rotation;
        textFn.scale.set(entity.transform.scale.x, entity.transform.scale.y);
        
        textFn.visible = entity.visible !== false;

        // Sync dimensions back to ECS for Gizmos
        if (entity.label) {
            entity.label.width = textFn.width;
            entity.label.height = textFn.height;
        }
    }

    private updateBitmapText(entity: any) {
        let bText = this.bitmapTextCache.get(entity.id!);

        if (!bText) {
            bText = new BitmapText({
                text: entity.bitmapText.text,
                style: {
                    fontFamily: 'Arial', // Fallback until loaded
                    fontSize: entity.bitmapText.fontSize,
                    align: entity.bitmapText.align
                }
            });
            bText.anchor.set(0.5);
            bText.tint = entity.bitmapText.tint;
            
            // Interaction
            bText.eventMode = 'static';
            bText.cursor = 'pointer';
            bText.on('pointerdown', (e: FederatedPointerEvent) => {
                e.stopPropagation();
                if (this.onEntityClicked && entity.id) {
                    this.onEntityClicked(entity.id);
                }
            });

            this.app.stage.addChild(bText);
            this.bitmapTextCache.set(entity.id!, bText);
            (bText as any)._loadedFontPath = ''; 
        }

        // Load Font if needed
        const fontPath = entity.bitmapText.fontName;
        const fontTexture = entity.bitmapText.fontTexture;
        
        // Check if font OR texture override changed
        const loadedKey = (bText as any)._loadedFontPath;
        const requestedKey = fontTexture ? `${fontPath}|${fontTexture}` : fontPath;

        if (fontPath && loadedKey !== requestedKey) {
            (bText as any)._loadedFontPath = requestedKey; // Mark as requested
            resourceManager.loadBitmapFont(fontPath, fontTexture).then(fontFace => {
                if (fontFace && bText && (bText as any)._loadedFontPath === requestedKey) {
                    bText.style.fontFamily = fontFace;
                }
            });
        }

        // Sync Properties
        if (bText.text !== entity.bitmapText.text) bText.text = entity.bitmapText.text;
        if (bText.style.fontSize !== entity.bitmapText.fontSize) bText.style.fontSize = entity.bitmapText.fontSize;
        if (bText.style.align !== entity.bitmapText.align) bText.style.align = entity.bitmapText.align;
        if (bText.tint !== entity.bitmapText.tint) bText.tint = entity.bitmapText.tint;

        // Sync Transform
        bText.x = entity.transform.x;
        bText.y = entity.transform.y;
        bText.rotation = entity.transform.rotation;
        bText.scale.set(entity.transform.scale.x, entity.transform.scale.y);

        bText.visible = entity.visible !== false;

        // Sync dimensions back to ECS for Gizmos
        if (entity.bitmapText) {
            entity.bitmapText.width = bText.width;
            entity.bitmapText.height = bText.height;
        }
    }

    private removeSprite(id: string) {
        if (this.spriteCache.has(id)) {
            const sprite = this.spriteCache.get(id)!;
            this.app.stage.removeChild(sprite);
            sprite.destroy();
            this.spriteCache.delete(id);
        }
    }

    private removeLabel(id: string) {
        if (this.textCache.has(id)) {
            const text = this.textCache.get(id)!;
            this.app.stage.removeChild(text);
            text.destroy();
            this.textCache.delete(id);
        }
    }

    private removeBitmapText(id: string) {
        if (this.bitmapTextCache.has(id)) {
            const bText = this.bitmapTextCache.get(id)!;
            this.app.stage.removeChild(bText);
            bText.destroy();
            this.bitmapTextCache.delete(id);
        }
    }
}

