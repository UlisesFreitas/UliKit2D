import { Application, Sprite, Texture, Assets, Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/ECS';
import { getFileSystem } from '../../api/FileSystem';

export class RenderSystem {
    private app: Application;
    private spriteCache: Map<string, Sprite> = new Map();
    private textCache: Map<string, Text> = new Map();
    private textureCache: Map<string, Texture> = new Map();
    private pendingLoads: Set<string> = new Set();
    private failedLoads: Set<string> = new Set();
    private resolvedPathCache: Map<string, string> = new Map();
    private pendingPaths: Set<string> = new Set();
    
    public onEntityClicked: ((id: string) => void) | null = null;

    constructor(app: Application) {
        this.app = app;
        
        // Cleanup when entity is destroyed
        world.onEntityRemoved.subscribe((entity) => {
            if (entity.id && this.spriteCache.has(entity.id)) {
                const sprite = this.spriteCache.get(entity.id)!;
                this.app.stage.removeChild(sprite);
                sprite.destroy();
                this.spriteCache.delete(entity.id);
            }
            if (entity.id && this.textCache.has(entity.id)) {
                 const text = this.textCache.get(entity.id)!;
                 this.app.stage.removeChild(text);
                 text.destroy();
                 this.textCache.delete(entity.id);
            }
        });
    }

    public update() {
        const entities = world.with('transform', 'sprite');

        // Add/Update Sprites
        for (const entity of entities) {
            let sprite = this.spriteCache.get(entity.id!);

            if (!sprite) {
                const rawPath = entity.sprite.texture;
                if (!rawPath) continue;

                const fs = getFileSystem();
                const cacheKey = rawPath;
                
                // If we don't have a resolved URL yet, start resolving
                if (!this.resolvedPathCache.has(cacheKey)) {
                    if (!this.pendingPaths.has(cacheKey)) {
                        this.pendingPaths.add(cacheKey);
                        fs.getAssetURL(rawPath).then((url: string) => {
                            this.resolvedPathCache.set(cacheKey, url);
                            this.pendingPaths.delete(cacheKey);
                        });
                    }
                    continue; // Skip until resolved
                }

                const texturePath = this.resolvedPathCache.get(cacheKey)!;

                // Check cache
                if (this.textureCache.has(texturePath)) {
                    const texture = this.textureCache.get(texturePath)!;
                    sprite = new Sprite(texture);
                    sprite.anchor.set(0.5);
                    (sprite as any)._texturePath = texturePath;
                    
                    // Enable interaction
                    sprite.eventMode = 'static';
                    sprite.cursor = 'pointer';
                    sprite.on('pointerdown', (e) => {
                        e.stopPropagation();
                        if (this.onEntityClicked && entity.id) {
                            this.onEntityClicked(entity.id);
                        }
                    });

                    this.app.stage.addChild(sprite);
                    this.spriteCache.set(entity.id!, sprite);
                } else if (!this.pendingLoads.has(texturePath) && !this.failedLoads.has(texturePath)) {
                    // Start loading
                    this.pendingLoads.add(texturePath);
                    console.log('[RenderSystem] Loading texture:', texturePath);
                    
                    this.loadTexture(texturePath).then((texture) => {
                        console.log('[RenderSystem] Loaded texture:', texturePath);
                        if (!texture) throw new Error('Texture loaded as null');
                        
                        this.textureCache.set(texturePath, texture);
                        
                        // Update ECS with texture dimensions
                        if (entity.sprite) {
                            entity.sprite.width = texture.width;
                            entity.sprite.height = texture.height;
                        }

                        this.pendingLoads.delete(texturePath);
                    }).catch(e => {
                        console.error('[RenderSystem] Failed to load texture:', texturePath, e);
                        this.pendingLoads.delete(texturePath);
                        this.failedLoads.add(texturePath);
                    });
                }
                
                if (!sprite) continue;
            }

            // Sync Transform
            if (!sprite) continue; // Double check

            sprite.x = entity.transform.x;
            sprite.y = entity.transform.y;
            sprite.rotation = entity.transform.rotation;
            sprite.scale.set(entity.transform.scale.x, entity.transform.scale.y);

            // Sync Visibility
            sprite.visible = entity.visible !== false;

            // Check for Texture Change
            const rawPath = entity.sprite.texture;
            if (rawPath) {
                const fs = getFileSystem();
                const cacheKey = rawPath;

                if (!this.resolvedPathCache.has(cacheKey)) {
                    if (!this.pendingPaths.has(cacheKey)) {
                        this.pendingPaths.add(cacheKey);
                        fs.getAssetURL(rawPath).then((url: string) => {
                            this.resolvedPathCache.set(cacheKey, url);
                            this.pendingPaths.delete(cacheKey);
                        });
                    }
                } else {
                    const texturePath = this.resolvedPathCache.get(cacheKey)!;

                    if ((sprite as any)._texturePath !== texturePath) {
                        // Texture changed!
                        if (this.textureCache.has(texturePath)) {
                            sprite.texture = this.textureCache.get(texturePath)!;
                            (sprite as any)._texturePath = texturePath;
                        } else if (!this.pendingLoads.has(texturePath) && !this.failedLoads.has(texturePath)) {
                            this.pendingLoads.add(texturePath);
                            
                            this.loadTexture(texturePath).then((texture) => {
                                if (!texture) return;
                                this.textureCache.set(texturePath, texture);
                                if (this.spriteCache.get(entity.id!) === sprite) {
                                    sprite!.texture = texture;
                                    (sprite as any)._texturePath = texturePath;
                                    if (entity.sprite) {
                                        entity.sprite.width = texture.width;
                                        entity.sprite.height = texture.height;
                                    }
                                }
                                this.pendingLoads.delete(texturePath);
                            }).catch(() => {
                                 this.pendingLoads.delete(texturePath);
                                 this.failedLoads.add(texturePath);
                            });
                        }
                    }
                }
            }
        }
        
        // Add/Update Text Labels
        const labelEntities = world.with('transform', 'label');
        for (const entity of labelEntities) {
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
                 textFn.on('pointerdown', (e) => {
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
        }
    }

    private async loadTexture(url: string): Promise<Texture | null> {
        try {
            // Blob URL Handling for Web
            if (url.startsWith('blob:')) {
                // Return directly with hints
                return await Assets.load({
                    src: url,
                    alias: [url], // Ensure string lookup works
                    format: 'png', // Explicitly tell Pixi it's a PNG
                    loadParser: 'loadTextures' // Hint to Pixi
                });
            }
            return await Assets.load(url);
         } catch (e) {
             // Retry with explicit loadTextures detection if failed
             console.warn('Initial load failed, retrying with explicit image detection...', e);
             try {
                return await Assets.load({ src: url, format: 'png', loadParser: 'loadTextures' });
             } catch (e2) {
                 console.error('Retry failed', e2);
                 return null;
             }
         }
    }
}
