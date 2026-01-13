import { Texture, Assets, TextureStyle } from 'pixi.js';
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

        if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('file:')) {
            // Robust loading for Blobs and Local Files (Electron) via Image tag
            // bypassing fetch restrictions
            const img = new Image();
            img.src = url;
            await img.decode();
            texture = Texture.from(img);
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
