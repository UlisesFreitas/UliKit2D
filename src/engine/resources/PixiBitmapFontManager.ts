import { BitmapFont, type BitmapFontData, Assets } from 'pixi.js';
import { ResourceLoader } from './ResourceLoader';
import { PixiImageManager } from './PixiImageManager';
import { ResourceCache } from './ResourceCache';

export class PixiBitmapFontManager {
    private loader: ResourceLoader;
    private imageManager: PixiImageManager;
    private cache: ResourceCache;

    constructor(loader: ResourceLoader, imageManager: PixiImageManager, cache: ResourceCache) {
        this.loader = loader;
        this.imageManager = imageManager;
        this.cache = cache;
    }

    public async loadBitmapFont(path: string, texturePathOverride?: string): Promise<string | null> {
        // Return existing if cached
        const existingFontName = this.cache.getFont(path + (texturePathOverride || ''));
        if (existingFontName && (BitmapFont as any).available[existingFontName]) {
            return existingFontName;
        }

        try {
            // 1. Load XML content
            const xmlString = await this.loader.loadText(await this.loader.loadUrl(path));
            if (!xmlString) throw new Error('Empty XML');

            // 2. Parse XML to BitmapFontData
            const data = this.parseBitmapFontData(xmlString, path);
            
            // 3. Resolve Texture
            let texturePath = texturePathOverride;
            if (!texturePath) {
                // If path is a Blob URL, we cannot resolve relative paths automatically
                if (path.startsWith('blob:')) {
                    console.warn('[PixiBitmapFontManager] Cannot resolve relative texture from Blob URL. Please provide texture path override.');
                    throw new Error('Texture path override required for Blob URL fonts');
                }

                // Determine texture path from XML "pages"
                const firstPageFile = data.pages[0]?.file;
                 if (!firstPageFile && !texturePathOverride) {
                     throw new Error('No texture found in font XML and no override provided');
                 }
                
                // Resolve relative to font file (handling windows backslashes)
                const normalizedPath = path.replace(/\\/g, '/');
                const lastSlash = normalizedPath.lastIndexOf('/');
                const dir = lastSlash >= 0 ? normalizedPath.substring(0, lastSlash) : '';
                texturePath = dir ? `${dir}/${firstPageFile}` : firstPageFile;
            }

            // 4. Load Texture
            console.log(`[PixiBitmapFontManager] Loading texture for font: ${texturePath}`);
            const texture = await this.imageManager.loadTexture(texturePath!);
            if (!texture) throw new Error(`Failed to load texture: ${texturePath}`);

            // 5. Generate Unique Name
            // e.g. "Arial_hash" or just use path
            const uniqueName = `Font_${path}_${texturePathOverride || 'default'}`.replace(/[^a-zA-Z0-9_]/g, '_');
            
            // 6. Create and Register Font
            // Note: Pixi 7/8 BitmapFont constructor takes { data, textures }
            const font = new BitmapFont({
                data: data,
                textures: [texture]
            });
            
            // Register manually in PixiJS v8 Cache
            // Key format typically used by Pixi is `${name}-bitmap`
            console.log('Registering font to Assets cache', Assets);
            Assets.cache.set(`${uniqueName}-bitmap`, font);
            
            // Also register by Family Name (Friendly Name) if available
            if (data.fontFamily && data.fontFamily !== uniqueName) {
                console.log(`[PixiBitmapFontManager] Registering alias: ${data.fontFamily}`);
                Assets.cache.set(`${data.fontFamily}-bitmap`, font);
            }
            
            // Cache mapping
            this.cache.setFont(path + (texturePathOverride || ''), uniqueName);
            
            console.log(`[PixiBitmapFontManager] Successfully installed font: ${uniqueName}`);
            return uniqueName;

        } catch (e) {
            console.error(`[PixiBitmapFontManager] Failed to load ${path}:`, e);
            return null;
        }
    }

    private parseBitmapFontData(xml: string, _fontPath: string): BitmapFontData {
        // Simple XML Parser regex-based
        const data: BitmapFontData = {
            fontFamily: 'Unknown',
            fontSize: 0,
            lineHeight: 0,
            baseLineOffset: 0,
            chars: {},
            pages: []
        };

        // Info
        const infoMatch = /info.*face=["']([^"']+)["'].*size=["']?(\d+)["']?/.exec(xml);
        if (infoMatch) {
            data.fontFamily = infoMatch[1]!;
            data.fontSize = parseInt(infoMatch[2]!, 10);
        }

        // Common
        const commonMatch = /common.*lineHeight=["']?(\d+)["']?.*base=["']?(\d+)["']?/.exec(xml);
        if (commonMatch) {
            data.lineHeight = parseInt(commonMatch[1]!, 10);
            data.baseLineOffset = parseInt(commonMatch[2]!, 10);
        }

        // Pages
        const pageRegex = /page\s+id=["']?(\d+)["']?\s+file=["']?([^"']+)["']?/g;
        let pageMatch;
        while ((pageMatch = pageRegex.exec(xml)) !== null) {
            data.pages.push({
                id: parseInt(pageMatch[1]!, 10),
                file: pageMatch[2]!
            });
        }
        
        // Chars
        const charRegex = /char\s+id=["']?(\d+)["']?\s+x=["']?(\d+)["']?\s+y=["']?(\d+)["']?\s+width=["']?(\d+)["']?\s+height=["']?(\d+)["']?\s+xoffset=["']?([-\d]+)["']?\s+yoffset=["']?([-\d]+)["']?\s+xadvance=["']?(\d+)["']?/g;
        let charMatch;
        while ((charMatch = charRegex.exec(xml)) !== null) {
            const id = parseInt(charMatch[1]!, 10);
            const letter = String.fromCharCode(id);
            data.chars[letter] = {
                id: id,
                page: 0, // Assuming single page for now or need regex for page
                x: parseInt(charMatch[2]!, 10),
                y: parseInt(charMatch[3]!, 10),
                width: parseInt(charMatch[4]!, 10),
                height: parseInt(charMatch[5]!, 10),
                xOffset: parseInt(charMatch[6]!, 10),
                yOffset: parseInt(charMatch[7]!, 10),
                xAdvance: parseInt(charMatch[8]!, 10),
                letter: letter,
                kerning: {}
            };

            // FIX: Manual Offset for Pixel Art Fonts (e.g. Dogica, Retro Gaming)
            // Shift down by (fontSize - 1) to align with Gizmo/Grid
            // This assumes all bitmap fonts in this project follow this baseline convention
            const size = data.fontSize || 8; 
            data.chars[letter].yOffset -= (size - 1);
        }

        // Kernings (optional)
        const kerningRegex = /kerning\s+first=["']?(\d+)["']?\s+second=["']?(\d+)["']?\s+amount=["']?([-\d]+)["']?/g;
        let kerningMatch;
        while ((kerningMatch = kerningRegex.exec(xml)) !== null) {
            const first = parseInt(kerningMatch[1]!, 10);
            const second = parseInt(kerningMatch[2]!, 10);
            const amount = parseInt(kerningMatch[3]!, 10);
            
            const firstChar = String.fromCharCode(first);
            const secondChar = String.fromCharCode(second);

            const char = data.chars[firstChar];
            if (char) {
                char.kerning[secondChar] = amount;
            }
        }

        return data;
    }
}
