import { Application, Sprite, Texture, Text, BitmapText, NineSliceSprite, Container, Graphics, Rectangle } from 'pixi.js';

import { world } from '../ecs/ECS';
import { resourceManager } from '../resources/ResourceManager';
import { SceneManager } from '../managers/SceneManager';
import defaultCameraIcon from '../../resources/internal_default_assets/default_camera.png';


export class RenderSystem {
    private app: Application;
    
    // Layers
    public readonly layerContainers: Map<string, Container> = new Map();
    private layerBackgrounds: Map<string, Graphics> = new Map(); // For Base Layer color

    // ECS Cache
    private spriteCache: Map<string, Sprite> = new Map();
    private textCache: Map<string, Text> = new Map();
    private bitmapTextCache: Map<string, BitmapText> = new Map();
    private nineSliceCache: Map<string, NineSliceSprite> = new Map();
    private cameraIconCache: Map<string, Container> = new Map();

    // Track which entities need texture updates (due to invalidation)
    private pendingUpdates: Set<string> = new Set(); 
    
    public onEntityClicked: ((id: string) => void) | null = null; // Deprecated, but keeping for compatibility if referenced elsewhere temporarily? 
    // Actually rework plan says REMOVE it.

    public getDisplayObject(id: string): Container | undefined {
        return this.spriteCache.get(id) || 
               this.textCache.get(id) || 
               this.nineSliceCache.get(id) || 
               this.bitmapTextCache.get(id) ||
               this.cameraIconCache.get(id);
    }

    /**
     * Returns the visual local AABB bounds of an entity in World Space.
     * Used for Selection Hit Testing.
     */
    public getVisualBounds(id: string) {
        // Try caches
        const displayObject = this.getDisplayObject(id);
        if (!displayObject) return null;

        // Return visual bounds (PixiJS Bounds)
        return displayObject.getBounds();    
    }

    private editorOverlay: Container; // For Helper Icons (Camera, audio, etc)

    constructor(app: Application) {

        this.app = app;
        this.app.stage.sortableChildren = true;
        
        // Editor Overlay - Always on Top
        this.editorOverlay = new Container();
        this.editorOverlay.label = 'Editor Overlay';
        this.editorOverlay.zIndex = 9999; 
        this.app.stage.addChild(this.editorOverlay);
    }
    
    private tileSpriteCache: Map<string, Map<string, Sprite>> = new Map(); // LayerID -> "x,y" -> Sprite
    private layerTileContainers: Map<string, Container> = new Map();

    // Helper to standardize visual object setup for interaction
    private prepareVisual(displayObject: Container, id: string) {
        displayObject.eventMode = 'static';
        displayObject.cursor = 'pointer';
        (displayObject as any)._entityId = id;
    }

    private updateLayers() {
        const layers = SceneManager.layers; // Access global state from Manager

        
        // 1. Sync Containers
        // Create missing containers
        for (const layer of layers) {
            let container = this.layerContainers.get(layer.id);
            if (!container) {
                container = new Container();
                container.label = layer.name;
                container.sortableChildren = true; // Enable zIndex sorting within layer
                container.eventMode = 'passive'; // Pass-through events to children
                // Add to stage
                this.app.stage.addChild(container);
                this.layerContainers.set(layer.id, container);
                
                // Add Background if needed
                if (layer.color) {
                     const bg = new Graphics();
                     bg.rect(-10000, -10000, 20000, 20000);
                     bg.fill({ color: layer.color });
                     bg.eventMode = 'none'; // Background should NOT block selection
                     container.addChildAt(bg, 0); // Always at bottom
                     this.layerBackgrounds.set(layer.id, bg);
                }

                // Create Tile Container (Child of Layer Container)
                const tileContainer = new Container();
                tileContainer.label = `${layer.name}_Tiles`;
                tileContainer.zIndex = -1; // Behind entities (Entities default to 0)
                tileContainer.eventMode = 'passive';
                container.addChild(tileContainer); // Add it
                this.layerTileContainers.set(layer.id, tileContainer);
            }
            
            // Sync Properties
            container.visible = layer.visible;
            container.zIndex = layers.indexOf(layer); // Pixi sortableChildren handles this
            
            // Update Background Color if changed
             if (layer.id === 'Base Layer' && layer.color) { 
                 const bg = this.layerBackgrounds.get(layer.id);
                 if (bg) {
                     bg.clear();
                     bg.rect(-10000, -10000, 20000, 20000);
                     bg.fill({ color: layer.color });
                 }
             }

             // Update Tiles
             const tileContainer = this.layerTileContainers.get(layer.id);
             if (tileContainer) {
                 this.updateLayerTiles(layer, tileContainer);
             }
        }
        
        // Remove dead layers
        for (const [id, container] of this.layerContainers) {
            if (!layers.find(l => l.id === id)) {
                this.app.stage.removeChild(container);
                container.destroy({ children: true });
                this.layerContainers.delete(id);
                this.layerBackgrounds.delete(id);
                this.layerTileContainers.delete(id);
                this.layerTileContainers.delete(id);
                this.tileSpriteCache.delete(id);
            }
        }
        
        // Remove dead camera icons
        // (Handled in cleanupZombies, but ensure layers don't strand them if layer deleted)
        // Camera icons live in layers too.
        
        // Sort Stage (Layers)
        this.app.stage.sortChildren();
    }

    private updateLayerTiles(layer: any, container: Container) {
        // If no tileset or data, clear and return
        if (!layer.tileset || !layer.tileData) return;

        // Ensure cache exists for this layer
        if (!this.tileSpriteCache.has(layer.id)) {
            this.tileSpriteCache.set(layer.id, new Map());
        }
        const layerCache = this.tileSpriteCache.get(layer.id)!;
        const activeCoords = new Set<string>();

        // Load Texture (Async)
        // Note: For now, we assume texture is loaded or will load. 
        // Real-time batching of texture frame updates is expensive if done every frame without check.
        // We'll trust resourceManager cache.
        resourceManager.loadTexture(layer.tileset).then(baseTexture => {
            if (!baseTexture) return;

            // Iterate Data
            for (const [coord, tileId] of Object.entries(layer.tileData)) {
                const parts = coord.split(',');
                const gx = Number(parts[0]);
                const gy = Number(parts[1]);
                const tileIndex = Number(tileId);

                activeCoords.add(coord);
                let sprite = layerCache.get(coord);

                // Calculate Texture Frame
                // Assuming standard tileset or similar... 
                // Wait, how do we know tileset layout? (Columns/Rows).
                // Usually Tileset Metadata is needed. 
                // For "Clean Slate", let's assume standard grid based on texture width and layer gridSize.
                
                const gridSize = layer.gridSize || { x: 32, y: 32 };
                const cols = Math.floor(baseTexture.width / gridSize.x);
                
                const tx = (tileIndex % cols) * gridSize.x;
                const ty = Math.floor(tileIndex / cols) * gridSize.y;

                if (!sprite) {
                    // Create Sprite
                    // We clone the texture with a specific frame
                     const tileTex = new Texture({
                         source: baseTexture.source,
                         frame: new Rectangle(tx, ty, gridSize.x, gridSize.y)
                     });
                     
                     sprite = new Sprite(tileTex);
                     sprite.x = gx * gridSize.x;
                     sprite.y = gy * gridSize.y;
                     
                     container.addChild(sprite);
                     layerCache.set(coord, sprite);
                     (sprite as any)._tileId = tileIndex;
                } else {
                    // Update if Changed
                    if ((sprite as any)._tileId !== tileIndex) {
                        sprite.texture = new Texture({
                            source: baseTexture.source,
                            frame: new Rectangle(tx, ty, gridSize.x, gridSize.y)
                        });
                        (sprite as any)._tileId = tileIndex;
                    }
                }
            }

            // Cleanup removed tiles
            for (const [coord, sprite] of layerCache.entries()) {
                if (!activeCoords.has(coord)) {
                    container.removeChild(sprite);
                    sprite.destroy();
                    layerCache.delete(coord);
                }
            }
        });
    }

    public update() {
 
        this.updateLayers(); // Sync Layers first

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
                this.removeCameraIcon(entity.id!);
            } else if (entity.camera) {
                 this.updateCamera(entity);
                 this.removeSprite(entity.id!);
                 this.removeLabel(entity.id!);
                 this.removeBitmapText(entity.id!);
                 this.removeNineSlice(entity.id!);
            } else {
                 // Cleanup
                 this.removeBitmapText(entity.id!);
                 this.removeLabel(entity.id!);
                 this.removeSprite(entity.id!);
                 this.removeNineSlice(entity.id!);
                 this.removeCameraIcon(entity.id!);
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
        for (const id of this.cameraIconCache.keys()) {
            if (!activeIds.has(id)) this.removeCameraIcon(id);
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
             nSlice.anchor.set(entity.nineSliceSprite.anchor?.x ?? 0.5, entity.nineSliceSprite.anchor?.y ?? 0.5);

             // Interaction removed

             // Layer Parenting
             const layerId = entity.layer || 'Base Layer';
             const parent = this.layerContainers.get(layerId) || this.app.stage; // Fallback
             parent.addChild(nSlice);
             
            this.nineSliceCache.set(entity.id!, nSlice);
             (nSlice as any)._currentPath = '';
             this.prepareVisual(nSlice, entity.id!);
        } else {
             // Handle Layer Change
             const layerId = entity.layer || 'Base Layer';
             const desiredParent = this.layerContainers.get(layerId) || this.app.stage;
             if (nSlice.parent !== desiredParent) {
                 desiredParent.addChild(nSlice); // Moves it
             }
        }
        this.prepareVisual(nSlice, entity.id!);

        // Sync Transform
        nSlice.x = entity.transform.x;
        nSlice.y = entity.transform.y;
        nSlice.rotation = entity.transform.rotation;
        if (nSlice.zIndex !== (entity.transform.zIndex || 0)) {
            nSlice.zIndex = entity.transform.zIndex || 0;
        }
        // NineSlice usually IGNORES scale if width/height are set, BUT we can simply Apply Scale to the container? No, NineSliceSprite extends Container?
        // Actually, NineSlice width/height IS the size. 
        // If we want Transform.Scale to affect it:
        // Option A: Use scale as multiplier for width/height.
        // Option B: Set width/height strictly, and let Scale be 1.
        // Standard in Game Engines: NineSlice uses Width/Height property for sizing, Transform Scale applies on top.
        nSlice.scale.set(entity.transform.scale.x, entity.transform.scale.y); 
        
        // Sync Anchor
        const ax = entity.nineSliceSprite.anchor?.x ?? 0.5;
        const ay = entity.nineSliceSprite.anchor?.y ?? 0.5;
        if (nSlice.anchor.x !== ax || nSlice.anchor.y !== ay) {
             nSlice.anchor.set(ax, ay);
        }

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
            if (ns.parent) ns.parent.removeChild(ns);
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
            sprite.hitArea = new Rectangle(-16, -16, 32, 32);
            sprite.anchor.set(entity.sprite.anchor?.x ?? 0.5, entity.sprite.anchor?.y ?? 0.5);
            
            // Interaction removed: Handled by ScenePanel Raycast


            // Layer Parenting
            const layerId = entity.layer || 'Base Layer';
            const parent = this.layerContainers.get(layerId) || this.app.stage;
            parent.addChild(sprite);
            
            this.spriteCache.set(entity.id!, sprite);
            (sprite as any)._currentPath = ''; // Init tracker
            this.prepareVisual(sprite, entity.id!);
        } else {
            // Check Layer Change
            const layerId = entity.layer || 'Base Layer';
            const parent = this.layerContainers.get(layerId);
            if (parent && sprite.parent !== parent) {
                parent.addChild(sprite);
            }
        }
        this.prepareVisual(sprite, entity.id!); // FORCE UPDATE

        // Sync Transform
        sprite.x = entity.transform.x;
        sprite.y = entity.transform.y;
        sprite.rotation = entity.transform.rotation;
        if (sprite.zIndex !== (entity.transform.zIndex || 0)) {
            sprite.zIndex = entity.transform.zIndex || 0;
        }
        const sx = entity.transform.scale?.x ?? 1;
        const sy = entity.transform.scale?.y ?? 1;
        sprite.scale.set(sx, sy);

        // Sync Anchor
        const ax = entity.sprite.anchor?.x ?? 0.5;
        const ay = entity.sprite.anchor?.y ?? 0.5;
        if (sprite.anchor.x !== ax || sprite.anchor.y !== ay) {
            sprite.anchor.set(ax, ay);
        }

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
                            
                            // Ensure parenting is correct/refreshed
                            const layerId = entity.layer || 'Base Layer';
                            const container = this.layerContainers.get(layerId);
                             if (container) {
                                if (sprite.parent !== container) {
                                    container.addChild(sprite);
                                }
                            }
                        }
                    }
                });
            }
        } else {
             sprite.texture = Texture.EMPTY;
             // Only set placeholder hitArea if empty
             sprite.hitArea = new Rectangle(-16, -16, 32, 32); 
             (sprite as any)._currentPath = '';
        }

        // Fix: If texture is present, clear the placeholder hitArea so the whole texture is clickable
        if (sprite.texture !== Texture.EMPTY) {
            sprite.hitArea = null;
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
             
             // Interaction removed

             const layerId = entity.layer || 'Base Layer';
             const parent = this.layerContainers.get(layerId) || this.app.stage;
             parent.addChild(textFn);
             
             this.textCache.set(entity.id!, textFn);
             this.prepareVisual(textFn, entity.id!);
        } else {
             const layerId = entity.layer || 'Base Layer';
             const parent = this.layerContainers.get(layerId);
             if (parent && textFn.parent !== parent) parent.addChild(textFn);
        }
        this.prepareVisual(textFn, entity.id!);

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
        if (textFn.zIndex !== (entity.transform.zIndex || 0)) {
            textFn.zIndex = entity.transform.zIndex || 0;
        }
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
            
            // Interaction removed

            const layerId = entity.layer || 'Base Layer';
            const parent = this.layerContainers.get(layerId) || this.app.stage;
            parent.addChild(bText);
            
            this.bitmapTextCache.set(entity.id!, bText);
            (bText as any)._loadedFontPath = ''; 
            this.prepareVisual(bText, entity.id!);
        } else {
             const layerId = entity.layer || 'Base Layer';
             const parent = this.layerContainers.get(layerId);
             if (parent && bText.parent !== parent) parent.addChild(bText);
        }
        this.prepareVisual(bText, entity.id!);

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
        if (bText.zIndex !== (entity.transform.zIndex || 0)) {
            bText.zIndex = entity.transform.zIndex || 0;
        }
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
            if (sprite.parent) sprite.parent.removeChild(sprite);
            sprite.destroy();
            this.spriteCache.delete(id);
        }
    }

    private removeLabel(id: string) {
        if (this.textCache.has(id)) {
            const text = this.textCache.get(id)!;
            if (text.parent) text.parent.removeChild(text);
            text.destroy();
            this.textCache.delete(id);
        }
    }

    private removeBitmapText(id: string) {
        if (this.bitmapTextCache.has(id)) {
            const bText = this.bitmapTextCache.get(id)!;
            if (bText.parent) bText.parent.removeChild(bText);
            bText.destroy();
            this.bitmapTextCache.delete(id);
        }
    }

    private removeCameraIcon(id: string) {
        if (this.cameraIconCache.has(id)) {
            const icon = this.cameraIconCache.get(id)!;
            if (icon.parent) icon.parent.removeChild(icon);
            icon.destroy({ children: true });
            this.cameraIconCache.delete(id);
        }
    }

    private updateCamera(entity: any) {
        let container = this.cameraIconCache.get(entity.id!);
        
        if (!container) {
             container = new Container();
             
             // 1. Hit Area (Invisible, Logic Only)
             container.hitArea = new Rectangle(-16, -16, 32, 32);

             // 2. Icon Sprite (Optional, loads async)
             const sprite = new Sprite(Texture.EMPTY);
             sprite.anchor.set(0.5);
             sprite.width = 24;
             sprite.height = 24;
             container.addChild(sprite);
             
             // Initial Load
             resourceManager.loadTexture(defaultCameraIcon).then(tex => {
                 if (tex && sprite && !sprite.destroyed) {
                     sprite.texture = tex;
                 }
             });

             // Parent to Overlay
             this.editorOverlay.addChild(container);
             
             this.cameraIconCache.set(entity.id!, container);
             this.prepareVisual(container, entity.id!);
        } else {
             if (container.parent !== this.editorOverlay) {
                 this.editorOverlay.addChild(container);
             }
        }
        this.prepareVisual(container, entity.id!);
        
        // FORCE CLEANUP: Remove any Graphics (Cyan Box) from previous versions
        // If user didn't reload, the old Graphics is still there.
        for (let i = container.children.length - 1; i >= 0; i--) {
            const child = container.children[i];
            if (child instanceof Graphics) {
                child.destroy();
            }
        }

        // Sync Transform
        container.x = entity.transform.x;
        container.y = entity.transform.y;
        container.rotation = entity.transform.rotation;
        
        container.scale.set(entity.transform.scale.x, entity.transform.scale.y);

        container.visible = entity.visible !== false;
    }

    /**
     * Checks if a Global Screen Point intersects with the entity's visual.
     */
    public hitTest(id: string, globalPoint: { x: number, y: number }): boolean {
        const obj = this.getDisplayObject(id);
        if (!obj) return false;
        // Suppress TS error: containsPoint exists in runtime (PixiJS)
        return (obj as any).containsPoint(globalPoint);
    }
}
