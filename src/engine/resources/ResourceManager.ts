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
     * Preload assets.
     * Stub for now to maintain compatibility with RenderSystem.
     */
    public async preload(assets: string[]): Promise<void> {
        // Optional: Implement preloading logic if needed
        // For now, just resolve immediately
        return Promise.resolve();
    }
}

export const resourceManager = ResourceManager.getInstance();
