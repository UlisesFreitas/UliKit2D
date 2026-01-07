import { Application, Sprite, Texture, Assets, Text } from 'pixi.js';
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

        // Preload Animators
        const animators = world.with('animator');
        for (const entity of animators) {
             if (entity.animator && entity.animator.animations) {
                 for (const animName in entity.animator.animations) {
                     const anim = entity.animator.animations[animName];
                     if (anim && anim.frames) {
                         for (const framePath of anim.frames) {
                             if (!this.resolvedPathCache.has(framePath) && !this.pendingLoads.has(framePath) && !this.textureCache.has(framePath)) {
                                 // Trigger load in background
                                 this.resolveAndLoad(framePath);
                             }
                         }
                     }
                 }
             }
        }

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
                    if (rawPath.startsWith('blob:') || rawPath.startsWith('data:')) {
                        // Direct usage
                        this.resolvedPathCache.set(cacheKey, rawPath);
                    } else if (!this.pendingPaths.has(cacheKey)) {
                        this.pendingPaths.add(cacheKey);
                        fs.getAssetURL(rawPath).then((url: string) => {
                            this.resolvedPathCache.set(cacheKey, url);
                            this.pendingPaths.delete(cacheKey);
                        });
                    }
                    if (!this.resolvedPathCache.has(cacheKey)) continue; // Skip until resolved
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
                    //console.log('[RenderSystem] Loading texture:', texturePath);
                    
                    this.loadTexture(texturePath).then((texture) => {
                        //console.log('[RenderSystem] Loaded texture:', texturePath);
                        if (!texture) throw new Error('Texture loaded as null');
                        
                        this.textureCache.set(texturePath, texture);
                        
                        // Update ECS with texture dimensions
                        if (entity.sprite) {
                            entity.sprite.width = texture.width;
                            entity.sprite.height = texture.height;
                        }

                        this.pendingLoads.delete(texturePath);
                    }).catch(e => {
                        //console.error('[RenderSystem] Failed to load texture:', texturePath, e);
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
                    if (rawPath.startsWith('blob:') || rawPath.startsWith('data:')) {
                         this.resolvedPathCache.set(cacheKey, rawPath);
                    } else if (!this.pendingPaths.has(cacheKey)) {
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
                        //console.log(`[RenderSystemDebug] Texture mismatch for entity ${entity.id}. Current: ${(sprite as any)._texturePath}, New: ${texturePath}`);
                        
                        if (this.textureCache.has(texturePath)) {
                            // console.log(`[RenderSystemDebug] Applying cached texture: ${texturePath}`);
                            sprite.texture = this.textureCache.get(texturePath)!;
                            (sprite as any)._texturePath = texturePath;
                        } else if (!this.pendingLoads.has(texturePath) && !this.failedLoads.has(texturePath)) {
                            // console.log(`[RenderSystemDebug] Texture not cached, triggering load: ${texturePath}`);
                            this.pendingLoads.add(texturePath);
                            
                            this.loadTexture(texturePath).then((texture) => {
                                if (!texture) return;
                                this.textureCache.set(texturePath, texture);
                                if (this.spriteCache.get(entity.id!) === sprite) {
                                    // console.log(`[RenderSystemDebug] Late apply texture: ${texturePath}`);
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
                        } else {
                            //console.log(`[RenderSystemDebug] Texture pending or failed: ${texturePath}`);
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
        // console.log('[RenderSystem] loadTexture called for:', url);
        try {
            if (url.startsWith('blob:') || url.startsWith('data:')) {
                // Use HTML Image for 100% robust blob loading
                const img = new Image();
                img.src = url;
                await img.decode(); // Wait for decode
                const tex = Texture.from(img);
                // console.log(`[RenderSystemDebug] Loaded blob texture via Image: ${tex.width}x${tex.height}`);
                return tex;
            }
            return await Assets.load(url);
        } catch (e) {
            //console.error('[RenderSystem] loadTexture Error:', e);
            return null;
        }
    }

    private resolveAndLoad(rawPath: string) {
        if (this.resolvedPathCache.has(rawPath)) {
            const resolved = this.resolvedPathCache.get(rawPath)!;
            if (!this.textureCache.has(resolved) && !this.pendingLoads.has(resolved)) {
                 this.pendingLoads.add(resolved);
                 this.loadTexture(resolved).then(tex => {
                     if (tex) this.textureCache.set(resolved, tex);
                     this.pendingLoads.delete(resolved);
                 });
            }
            return;
        }

        if (this.pendingPaths.has(rawPath)) return;
        
        if (rawPath.startsWith('blob:') || rawPath.startsWith('data:')) {
             this.resolvedPathCache.set(rawPath, rawPath);
             // Trigger load immediately
             if (!this.textureCache.has(rawPath) && !this.pendingLoads.has(rawPath)) {
                  this.pendingLoads.add(rawPath);
                  this.loadTexture(rawPath).then(tex => {
                      if (tex) this.textureCache.set(rawPath, tex);
                      this.pendingLoads.delete(rawPath);
                  });
             }
             return;
        }

        this.pendingPaths.add(rawPath);
        
        const fs = getFileSystem();
        fs.getAssetURL(rawPath).then(async (url: string) => {
            this.resolvedPathCache.set(rawPath, url);
            this.pendingPaths.delete(rawPath);
            
            // Trigger load immediately
            if (!this.textureCache.has(url) && !this.pendingLoads.has(url)) {
                 this.pendingLoads.add(url);
                 const tex = await this.loadTexture(url);
                 if (tex) this.textureCache.set(url, tex);
                 this.pendingLoads.delete(url);
            }
        });
    }
}
