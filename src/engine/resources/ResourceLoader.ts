import { Texture, Assets } from 'pixi.js';
import { getFileSystem } from '../../api/FileSystem';
import { useProjectSettingsStore } from '../../stores/useProjectSettingsStore';

export class ResourceLoader {
    
    /**
     * Resolves a virtual path to a loadable URL (blob: or http:)
     */
    public async loadUrl(virtualPath: string): Promise<string> {
        if (!virtualPath) throw new Error('Empty path');
        
        if (virtualPath.startsWith('blob:') || virtualPath.startsWith('data:') || virtualPath.startsWith('/src/')) {
            return virtualPath;
        }

        const fs = getFileSystem();
        return await fs.getAssetURL(virtualPath);
    }

    /**
     * Loads a PIXI Texture from a resolved URL
     */
    public async loadTexture(url: string): Promise<Texture> {
        let texture: Texture;

        if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('file:') || url.startsWith('/src/')) {

            try {
                const img = new Image();
                img.crossOrigin = 'anonymous'; // Important for texture safety
                img.src = url;
                await img.decode();
                
                // VALIDATION: Reject empty images
                if (img.width === 0 || img.height === 0) {
                    throw new Error('Image has 0 dimensions');
                }

                texture = Texture.from(img);

            } catch (e) {
                console.error(`[ResourceLoader] Error loading Image path: ${url}`, e);
                // Fallback to Assets.load just in case?
                // texture = await Assets.load(url);
                // Actually, if Image failed, Assets.load likely will too or return something weird.
                // Better to return Texture.EMPTY and let RenderSystem handle it?
                // Or let RenderSystem see the error?
                // Let's return Texture.EMPTY but with a size?
                // No, RenderSystem checks texture.source.
                // Let's throw or return EMPTY.
                texture = Texture.EMPTY; 
            }
        } else {

            texture = await Assets.load(url);
        }

        // Enforce Project Settings (Pixel Art Mode)
        try {
             // Access store lazily to avoid circular dependency issues during init
             const settings = useProjectSettingsStore().settings;
             if (settings && settings.display) {
                 const mode = settings.display.pixelArt ? 'nearest' : 'linear';
                 // PixiJS v8: TextureSource handles filtering
                 if (texture.source) {
                     texture.source.scaleMode = mode;
                 }
             }
        } catch (e) {
            // Store might not be initialized or other error, fallback to defaults
        }

        return texture;
    }

    /**
     * Loads text content from a URL
     */
    public async loadText(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load text from ${url}: ${response.statusText}`);
        return await response.text();
    }
}
