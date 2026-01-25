import { Texture } from 'pixi.js';

export class ResourceCache {
    private textures: Map<string, Texture> = new Map();
    private json: Map<string, any> = new Map();
    private blobs: Map<string, string> = new Map(); // URLs
    private fonts: Map<string, string> = new Map(); // Path -> FontName

    public getTexture(key: string): Texture | undefined {
        return this.textures.get(key);
    }

    public setTexture(key: string, texture: Texture) {
        this.textures.set(key, texture);
    }

    public hasTexture(key: string): boolean {
        return this.textures.has(key);
    }

    public removeTexture(key: string) {
        const texture = this.textures.get(key);
        if (texture) {
            // FIX: Do NOT destroy texture immediately.
            // If this texture is currently being rendered by a Sprite, destroying it causes a crash.
            // We just remove it from the cache so future loads fetched the file again (or new cache entry).
            // texture.destroy(true); 
            this.textures.delete(key);
        }
    }

    public getUrl(key: string): string | undefined {
        return this.blobs.get(key);
    }

    public setUrl(key: string, url: string) {
        this.blobs.set(key, url);
    }

    public removeUrl(key: string) {
        this.blobs.delete(key);
        // Note: Revoke object URL?
    }

    public getFont(key: string): string | undefined {
        return this.fonts.get(key);
    }

    public setFont(key: string, fontName: string) {
        this.fonts.set(key, fontName);
    }

    public removeFont(key: string) {
        this.fonts.delete(key);
    }

    public clear() {
        console.warn('[ResourceCache] Clearing all textures!');
        this.textures.forEach(t => {
            // Only destroy if we are sure?
            // t.destroy(true); 
        });
        this.textures.clear();
        this.blobs.clear();
        this.json.clear();
        this.fonts.clear();
    }
}
