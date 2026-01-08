import { Texture } from 'pixi.js';
import { ResourceLoader } from './ResourceLoader';
import { ResourceCache } from './ResourceCache';

export class PixiImageManager {
    private loader: ResourceLoader;
    private cache: ResourceCache;
    private invalidTexture: Texture;

    constructor(loader: ResourceLoader, cache: ResourceCache) {
        this.loader = loader;
        this.cache = cache;
        this.invalidTexture = Texture.WHITE; // Placeholder
    }

    public async loadTexture(path: string): Promise<Texture | null> {
        if (!path) return null;

        // Check Cache
        if (this.cache.hasTexture(path)) {
            return this.cache.getTexture(path)!;
        }

        try {
            // Load via ResourceLoader
            // Note: ResourceLoader currently handles the Blob vs Assets logic
            const texture = await this.loader.loadTexture(await this.loader.loadUrl(path));
            
            if (texture) {
                this.cache.setTexture(path, texture);
                return texture;
            }
        } catch (e) {
            console.error(`[PixiImageManager] Failed to load texture ${path}:`, e);
            return this.invalidTexture;
        }
        
        return null;
    }

    public invalidateTexture(path: string) {
        if (this.cache.hasTexture(path)) {
             this.cache.removeTexture(path);
        }
    }
}
