import { Texture, Assets } from 'pixi.js';
import { getFileSystem } from '../../api/FileSystem';

export class ResourceLoader {
    
    /**
     * Resolves a virtual path to a loadable URL (blob: or http:)
     */
    public async loadUrl(virtualPath: string): Promise<string> {
        if (!virtualPath) throw new Error('Empty path');
        
        if (virtualPath.startsWith('blob:') || virtualPath.startsWith('data:')) {
            return virtualPath;
        }

        const fs = getFileSystem();
        return await fs.getAssetURL(virtualPath);
    }

    /**
     * Loads a PIXI Texture from a resolved URL
     */
    public async loadTexture(url: string): Promise<Texture> {
        if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('file:')) {
            // Robust loading for Blobs and Local Files (Electron) via Image tag
            // bypassing fetch restrictions
            const img = new Image();
            img.src = url;
            await img.decode();
            return Texture.from(img);
        } else {
            return await Assets.load(url);
        }
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
