import { Application, Sprite, Texture, Text, BitmapText, NineSliceSprite, Container, Graphics, Rectangle, Assets } from 'pixi.js';

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
               this.cameraIconCache.get(id) ||
               this.emptyIconCache.get(id);
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
        this.app.stage.addChild(this.editorOverlay);
    }
    
    // Helper for Text Anchors
    private getAnchorX(align: string): number {
        if (align === 'left') return 0;
        if (align === 'right') return 1;
        return 0.5;
    }

    private resolveColor(color: string): string {
        if (color.startsWith('var(')) {
            const varName = color.match(/var\(([^)]+)\)/)?.[1];
            if (varName) {
                // We need to get the value from the root
                const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
                return val || '#000000';
            }
        }
        return color;
    }
    
    // Legacy Tile Rendering removed to support optimized EditorTilemapSystem chunks.
    // private tileSpriteCache ...
    // private layerTileContainers ...

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
                     const resolved = this.resolveColor(layer.color);
                     // Simple hex validation or fallback
                     if (resolved.startsWith('#') && resolved.length >= 4) {
                         bg.fill({ color: resolved });
                     }
                     bg.eventMode = 'none'; 
                     bg.zIndex = -1000;
                     container.addChildAt(bg, 0); 
                     this.layerBackgrounds.set(layer.id, bg);
                }

                // REMOVED: Legacy Tile Container creation
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
                     const resolved = this.resolveColor(layer.color);
                     if (resolved.startsWith('#') && resolved.length >= 4) {
                        bg.fill({ color: resolved });
                     }
                 }
             }

             // REMOVED: updateLayerTiles call
        }
        
        // Remove dead layers
        for (const [id, container] of this.layerContainers) {
            if (!layers.find(l => l.id === id)) {
                this.app.stage.removeChild(container);
                container.destroy({ children: true });
                this.layerContainers.delete(id);
                this.layerBackgrounds.delete(id);
                // REMOVED: tile container cleanup
            }
        }        
        // Sort Stage (Layers)
        this.app.stage.sortChildren();
    }

    // REMOVED: updateLayerTiles method

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
                this.removeEmpty(entity.id!);
            } else if (entity.label) {
                this.updateLabel(entity);
                this.removeBitmapText(entity.id!);
                this.removeSprite(entity.id!);
                this.removeNineSlice(entity.id!);
                this.removeEmpty(entity.id!);
            } else if (entity.nineSliceSprite) {
                this.updateNineSlice(entity);
                this.removeBitmapText(entity.id!);
                this.removeLabel(entity.id!);
                this.removeSprite(entity.id!);
                this.removeEmpty(entity.id!);
            } else if (entity.sprite) {
                this.updateSprite(entity);
                this.removeBitmapText(entity.id!);
                this.removeLabel(entity.id!);
                this.removeNineSlice(entity.id!);
                this.removeCameraIcon(entity.id!);
                this.removeEmpty(entity.id!);
            } else if (entity.camera) {
                 this.updateCamera(entity);
                 this.removeSprite(entity.id!);
                 this.removeLabel(entity.id!);
                 this.removeBitmapText(entity.id!);
                 this.removeNineSlice(entity.id!);
                 this.removeEmpty(entity.id!);
            } else {
                 // No Visual Components -> "Empty Entity" Visual
                 this.updateEmpty(entity);

                 // Cleanup others
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
        for (const id of this.emptyIconCache.keys()) {
            if (!activeIds.has(id)) this.removeEmpty(id);
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
        // NineSlice Logic:
        // We want the Gizmo (which changes Transform.Scale) to drive the visual size,
        // BUT we must apply it to the NineSlice 'width'/'height' properties to preserve the 9-slice corners.
        // We Force Scale to 1,1 so the container doesn't stretch.
        nSlice.scale.set(1, 1);
        
        // Dynamic Sizing: RenderSize = TextureSize * TransformScale
        // Ensure texture is valid to prevent collapsing to 0
        const isTextureValid = nSlice.texture && nSlice.texture !== Texture.EMPTY;
        const baseW = isTextureValid ? nSlice.texture.width : 100;
        const baseH = isTextureValid ? nSlice.texture.height : 100;
        
        nSlice.width = baseW * Math.abs(entity.transform.scale.x); // Use Abs to support negative scale flipping? 
        // Actually, Pixi NineSlice doesn't support negative width well usually (flip via scale).
        // If scale is negative, we might need to apply -1 to scale and pos width?
        // Let's stick to Abs width for now and assume standard sizing.
        nSlice.height = baseH * Math.abs(entity.transform.scale.y);

        // Handle flipping if scale is negative
        if (entity.transform.scale.x < 0) nSlice.scale.x = -1;
        if (entity.transform.scale.y < 0) nSlice.scale.y = -1;

        
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
                    const currentSprite = this.spriteCache.get(entity.id!);
                    if (!currentSprite) return;

                    // Verify race condition
                    if ((currentSprite as any)._currentPath !== texturePath) return;

                    // Validate Texture Source
                    if (texture && texture.source) {
                        currentSprite.texture = texture;
                        
                        // Auto-size if not manually overridden (logic could be refined)
                        if (entity.sprite) {
                            entity.sprite.width = texture.width;
                            entity.sprite.height = texture.height;
                        }
                    } else {
                        console.warn(`[RenderSystem] Invalid texture source for '${texturePath}'. Using fallback.`);
                        currentSprite.texture = Texture.WHITE; // Fallback
                        currentSprite.tint = 0xFF00FF; // Magenta to indicate error
                        
                        if (entity.sprite) {
                            entity.sprite.width = 64;
                            entity.sprite.height = 64;
                        }
                    }
                    
                    // Maintain Parent
                    const layerId = entity.layer || 'Base Layer';
                    const container = this.layerContainers.get(layerId);
                    if (container && currentSprite.parent !== container) {
                        container.addChild(currentSprite);
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
                     align: entity.label.align,
                     fontWeight: entity.label.fontWeight ?? 'normal',
                     fontStyle: entity.label.fontStyle ?? 'normal',
                     stroke: (entity.label.strokeThickness && entity.label.strokeThickness > 0) 
                         ? { color: entity.label.stroke || '#000000', width: entity.label.strokeThickness } 
                         : undefined
                 }
             });
             textFn.anchor.set(this.getAnchorX(entity.label.align), 0.5);
             
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
        if (textFn.style.align !== entity.label.align) {
            textFn.style.align = entity.label.align;
            textFn.anchor.x = this.getAnchorX(entity.label.align);
        }



        // Style Updates
        const fontWeight = entity.label.fontWeight || 'normal';
        if (textFn.style.fontWeight !== fontWeight) textFn.style.fontWeight = fontWeight;
        
        const fontStyle = entity.label.fontStyle || 'normal';
        if (textFn.style.fontStyle !== fontStyle) textFn.style.fontStyle = fontStyle;
        
        // Outline
        // PixiJS v8: prefer setting stroke as an object { color, width }
        // This ensures thickness is applied correctly.
        const strokeColor = entity.label.stroke || '#000000';
        const strokeThick = entity.label.strokeThickness || 0;
        
        // We create a new stroke object representation
        // If strokeThick is 0, we could set stroke to null/undefined or width 0. 
        // But the checkbox logic in UI handles 0.
        
        // Optimization: Check if we need to update to avoid object churn?
        // But style.stroke might be an object, so strict equality check fails.
        // Let's just set it. It's cleaner.
        if (strokeThick > 0) {
             (textFn.style as any).stroke = { color: strokeColor, width: strokeThick };
        } else {
             // Disable stroke
             (textFn.style as any).stroke = undefined; 
             // Or { width: 0 } ? undefined is safer to remove it.
        }

        // Shadow
        if (entity.label.dropShadow && entity.label.dropShadow.enabled) {
            const ds = entity.label.dropShadow;
            const newShadow = {
                color: ds.color,
                blur: ds.blur,
                distance: ds.distance,
                angle: (ds.angle || 0) * (Math.PI / 180),
                alpha: ds.alpha
            };
            // Deep compare or force update? Force update is safer for Object props
            (textFn.style as any).dropShadow = newShadow;
        } else {
             if ((textFn.style as any).dropShadow) (textFn.style as any).dropShadow = null;
        }

        // Bounded Text (Word Wrap)
        if (entity.label.width && entity.label.width > 0) {
            if (!textFn.style.wordWrap) textFn.style.wordWrap = true;
            if (textFn.style.wordWrapWidth !== entity.label.width) textFn.style.wordWrapWidth = entity.label.width;
            
            // Enable breaking words to match GDevelop behavior
             if (!(textFn.style as any).breakWords) (textFn.style as any).breakWords = true;
        } else {
            if (textFn.style.wordWrap) textFn.style.wordWrap = false;
        }

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
            // ONLY sync width if it's in 'Auto' mode (width is 0 or undefined)
            // If width is set (Bounded), we trust the ECS value as the container size.
            if (!entity.label.width || entity.label.width === 0) {
                 entity.label.width = textFn.width;
            }
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
            bText.anchor.set(this.getAnchorX(entity.bitmapText.align), 0.5);
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
            // Check if already available (e.g. preloaded default fonts)
            // PixiJS stores BitmapFonts with '-bitmap' suffix in cache
            if (Assets.cache.has(`${fontPath}-bitmap`)) {
                 bText.style.fontFamily = fontPath;
                 (bText as any)._loadedFontPath = requestedKey;
            } else {
                (bText as any)._loadedFontPath = requestedKey; // Mark as requested
                resourceManager.loadBitmapFont(fontPath, fontTexture).then(fontFace => {
                    if (fontFace && bText && (bText as any)._loadedFontPath === requestedKey) {
                        bText.style.fontFamily = fontFace;
                    }
                });
            }
        }

        // Sync Properties
        if (bText.text !== entity.bitmapText.text) bText.text = entity.bitmapText.text;
        if (bText.style.fontSize !== entity.bitmapText.fontSize) bText.style.fontSize = entity.bitmapText.fontSize;
        if (bText.style.align !== entity.bitmapText.align) {
            bText.style.align = entity.bitmapText.align;
            bText.anchor.x = this.getAnchorX(entity.bitmapText.align);
        }
        if (bText.tint !== entity.bitmapText.tint) bText.tint = entity.bitmapText.tint;
        
        // Bounded Text (Word Wrap)
        // PixiJS v8 BitmapText uses standard TextStyle properties for wrapping
        if (entity.bitmapText.width && entity.bitmapText.width > 0) {
             if (!(bText.style as any).wordWrap) (bText.style as any).wordWrap = true;
             if ((bText.style as any).wordWrapWidth !== entity.bitmapText.width) (bText.style as any).wordWrapWidth = entity.bitmapText.width;
        } else {
             if ((bText.style as any).wordWrap) (bText.style as any).wordWrap = false;
        }

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
             if (!entity.bitmapText.width || entity.bitmapText.width === 0) {
                entity.bitmapText.width = bText.width;
             }
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
        
        // Remove legacy graphics if any (Cyan box cleanup)
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

    private emptyIconCache: Map<string, Container> = new Map();

    private updateEmpty(entity: any) {
        let container = this.emptyIconCache.get(entity.id!);
        
        if (!container) {
             container = new Container();
             
             // 1. Hit Area (for selection)
             container.hitArea = new Rectangle(-16, -16, 32, 32);

             // 2. Icon Sprite
             const sprite = new Sprite(Texture.EMPTY);
             sprite.anchor.set(0.5);
             sprite.width = 24;
             sprite.height = 24;
             sprite.alpha = 0.5; // Semi-transparent for editor helper
             container.addChild(sprite);
             
             // Load Icon
             // We reuse defaultCameraIcon or specific 'defaultEmpty' if available. 
             // Using a embedded base64 or a known path would be optimal. 
             // Since we don't have 'defaultEmpty' imported here, let's use a simple Graphics fallback first, 
             // then try to load if we import it.
             // Actually, let's draw a Graphics cross/diamond.
             const g = new Graphics();
             // Initial draw will happen in update loop
             container.addChild(g);

             // Parent to Overlay (Editor Helpers should be on top?)
             // OR Base Layer to respect sorting? 
             // Empty Transformers usually sit in the layer but are invisible in-game.
             // Editor Overlay is safer to ensure visibility.
             this.editorOverlay.addChild(container);
             
             this.emptyIconCache.set(entity.id!, container);
             this.prepareVisual(container, entity.id!);
        } else {
             if (container.parent !== this.editorOverlay) {
                 this.editorOverlay.addChild(container);
             }
        }
        this.prepareVisual(container, entity.id!);

        // Sync Transform
        container.x = entity.transform.x;
        container.y = entity.transform.y;
        container.rotation = entity.transform.rotation;
        
        // DO NOT scale the visual container with the entity scale.
        // It's a helper handle (Diamond/Cross), it should remain visible at constant size (or respecting zoom)
        // Actually, handles usually scale with Zoom inverse to stay constant on screen, 
        // BUT for now, let's just make it independent of entity scale so 10x scale doesn't explode the line width.
        // We do respect negative scale for flipping if needed, but for a symmetrical diamond, it doesn't matter.
        container.scale.set(1, 1);
        
        container.visible = entity.visible !== false;

        // Redraw Geometry to maintain hairline width relative to Zoom
        const zoom = this.app.stage.scale.x;
        const g = container.children.find(c => c instanceof Graphics) as Graphics;
        if (g) {
             g.clear();
             const lw = 1 / zoom;
             // Diamond
             g.moveTo(-10, 0); g.lineTo(10, 0);
             g.moveTo(0, -10); g.lineTo(0, 10);
             g.stroke({ width: lw, color: 0xFFFFFF, alpha: 0.5 });
             g.circle(0,0, 4);
             g.stroke({ width: lw, color: 0xFFFFFF, alpha: 0.5});
        }
    }

    private removeEmpty(id: string) {
        if (this.emptyIconCache.has(id)) {
            const icon = this.emptyIconCache.get(id)!;
            if (icon.parent) icon.parent.removeChild(icon);
            icon.destroy({ children: true });
            this.emptyIconCache.delete(id);
        }
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
