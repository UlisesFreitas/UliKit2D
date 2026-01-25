import { ResourceLoader } from './ResourceLoader';
import { ResourceCache } from './ResourceCache';
import { PixiImageManager } from './PixiImageManager';
import { PixiBitmapFontManager } from './PixiBitmapFontManager';
import { Texture } from 'pixi.js';

export class ResourceManager {
    private static instance: ResourceManager;
    
    // Core Components
    private loader: ResourceLoader;
    private cache: ResourceCache;

    // Specific Managers
    private imageManager: PixiImageManager;
    private bitmapFontManager: PixiBitmapFontManager;

    private constructor() {
        this.loader = new ResourceLoader();
        this.cache = new ResourceCache();
        
        // Initialize Managers
        this.imageManager = new PixiImageManager(this.loader, this.cache);
        this.bitmapFontManager = new PixiBitmapFontManager(this.loader, this.imageManager, this.cache);
    }

    public static getInstance(): ResourceManager {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager();
        }
        return ResourceManager.instance;
    }

    // --- Loading Facade ---

    /**
     * Loads a texture from the given path
     */
    public async loadTexture(path: string): Promise<Texture | null> {
        return this.imageManager.loadTexture(path);
    }

    /**
     * Loads a BitmapFont.
     * Returns the REGISTERED FONT NAME (unique) to be used in BitmapText.fontName
     */
    public async loadBitmapFont(path: string, texturePathOverride?: string): Promise<string | null> {
        return this.bitmapFontManager.loadBitmapFont(path, texturePathOverride);
    }

    public async loadJSON(path: string): Promise<any | null> {
        try {
            const url = await this.loader.loadUrl(path);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch JSON: ${response.statusText}`);
            return await response.json();
        } catch (e) {
            console.error('ResourceManager: JSON Load Error', e);
            return null;
        }
    }

    // --- Utilities & Cache Access ---

    public getTexture(key: string): Texture | undefined {
        return this.cache.getTexture(key);
    }

    /**
     * Get the resolved, unique font name for a given file path
     * (e.g. "assets/font.fnt" -> "Arial_hash")
     */
    public getFontName(path: string, texturePathOverride?: string): string | undefined {
        return this.cache.getFont(path + (texturePathOverride || ''));
    }

    public async getUrl(path: string): Promise<string> {
        return this.loader.loadUrl(path);
    }

    /**
     * Invalidate cache for a specific asset.
     */
    public notifyAssetChanged(path: string) {
        // For now, only textures are cached by path in a way we want to invalidate
        this.imageManager.invalidateTexture(path);
    }

    /**
     * Updates references in the Cache and potentially in the Active World (Entities).
     */
    public async notifyAssetRenamed(oldPath: string, newPath: string): Promise<number> {
        // 1. Invalidate Cache for old path
        this.imageManager.invalidateTexture(oldPath);
        
        // 2. Update all active entities in the world that use this texture
        // This is a "Tactical Fix" until we switch to GUIDs.
        const { world } = await import('../ecs/ECS');
        let count = 0;
        // Iterate all entities with 'sprite' component
        for (const entity of world.with('sprite')) {
            if (entity.sprite && entity.sprite.texture === oldPath) {
                entity.sprite.texture = newPath;
                count++;
            }
        }
        
        // Iterate all entities with 'animator' component
        for (const entity of world.with('animator')) {
            if (entity.animator && entity.animator.animations) {
                for (const animName in entity.animator.animations) {
                    const anim = entity.animator.animations[animName];
                    if (anim && anim.frames) {
                        for (let i = 0; i < anim.frames.length; i++) {
                            if (anim.frames[i] === oldPath) {
                                anim.frames[i] = newPath;
                                count++;
                            }
                        }
                    }
                }
            }
        }
        if (count > 0) {
            console.log(`[ResourceManager] Updated ${count} entities from '${oldPath}' to '${newPath}'`);
            
            // Notify Editor of entity updates
            import('../core/EventBus').then(({ eventBus }) => {
                eventBus.emit('entities-updated'); 
            });
        }
        return count;
    }

    /**
     * Preload assets.
     * Stub for now to maintain compatibility with RenderSystem.
     */
    public async preload(_assets: string[]): Promise<void> {
        // Optional: Implement preloading logic if needed
        // For now, just resolve immediately
        return Promise.resolve();
    }
}

export const resourceManager = ResourceManager.getInstance();
