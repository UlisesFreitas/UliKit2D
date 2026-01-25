import { reactive } from 'vue';
import { getFileSystem } from '../../api/FileSystem';

export type AssetType = 'texture' | 'audio' | 'script' | 'scene' | 'font' | 'unknown';

export interface AssetMeta {
    guid: string;
    importer: string;
    version: number;
    options: Record<string, any>;
}

export interface AssetRecord {
    guid: string;
    path: string;       // Relative to Project Root (e.g. "assets/sprites/hero.png")
    type: AssetType;
    meta: AssetMeta;
    lastModified: number;
}

export class AssetDatabase {
    private static _instance: AssetDatabase;
    
    // Reactive state for UI binding if needed
    public assets = reactive<Map<string, AssetRecord>>(new Map()); // GUID -> Record
    public pathToGuid = reactive<Map<string, string>>(new Map());   // Path -> GUID
    
    // public pathToGuid = reactive<Map<string, string>>(new Map());   // Path -> GUID

    public static get instance(): AssetDatabase {
        if (!this._instance) this._instance = new AssetDatabase();
        return this._instance;
    }

    private constructor() {
        // Private
    }

    // --- Core API ---

    public getAssetPath(guid: string): string | undefined {
        return this.assets.get(guid)?.path;
    }

    public getAssetGuid(path: string): string | undefined {
        return this.pathToGuid.get(path);
    }
    
    public getAsset(guid: string): AssetRecord | undefined {
        return this.assets.get(guid);
    }

    /**
     * Scans the project and builds the index.
     * Should be called on project load.
     */
    public async refreshDatabase() {
        console.log('[AssetDatabase] Rebuilding index...');
        this.assets.clear();
        this.pathToGuid.clear();
        
        // Start scanning from root
        // We assume file system root is the project root in our ZenFS setup?
        // Actually FileSystem.readdir('') or '/' depends on implementation.
        // Let's assume relative paths from project root.
        await this.scanDirectory('.');
    }

    private async scanDirectory(dir: string) {
        const fs = getFileSystem();
        try {
            // readdir returns FileEntry[] objects, not just strings
            const entries = await fs.readdir(dir);
            
            for (const entry of entries) {
                // If dir is '.', we just want entry.name
                // If dir is 'assets', we want 'assets/foo.png'
                const fullRelPath = (dir === '.' || dir === '') ? entry.name : `${dir}/${entry.name}`;
                
                if (entry.type === 'directory') {
                    await this.scanDirectory(fullRelPath);
                } else {
                    if (!entry.name.endsWith('.meta')) {
                        await this.registerAsset(fullRelPath);
                    }
                }
            }
        } catch (e) {
            console.error(`[AssetDatabase] Failed to scan directory '${dir}':`, e);
        }
    }

    public async registerAsset(path: string) {
        // 1. Check if .meta exists
        const fs = getFileSystem();
        const metaPath = `${path}.meta`;
        
        let meta: AssetMeta;
        
        try {
            const content = await fs.readFile(metaPath);
            if (!content || content.length === 0) throw new Error('Empty Meta File');
            meta = JSON.parse(content);
        } catch (e) {
            // CORRUPTION / MISSING RECOVERY
            // console.warn(`[AssetDatabase] Meta missing or corrupt for ${path}, regenerating...`);
            meta = this.createDefaultMeta(path);
            await this.writeMeta(path, meta);
        }
        
        // 2. Index
        const type = this.detectType(path);
        
        const record: AssetRecord = {
            guid: meta.guid,
            path: path,
            type: type,
            meta: meta,
            lastModified: Date.now()
        };
        
        this.assets.set(meta.guid, record);
        this.pathToGuid.set(path, meta.guid);
        
        // console.log(`[AssetDatabase] Indexed: ${path} (${type}) -> ${meta.guid}`);
    }

    public async deleteAsset(path: string) {
        const guid = this.pathToGuid.get(path);
        if (guid) {
            this.assets.delete(guid);
            this.pathToGuid.delete(path);
            
            // Delete .meta file if it exists
            const fs = getFileSystem();
            try {
                await fs.deleteFile(`${path}.meta`);
            } catch (e: any) {
                // Ignore if already gone (common during rename/move)
                if (e.code !== 'ENOENT' && !e.message?.includes('No such file')) {
                    console.warn('[AssetDatabase] Failed to delete meta:', e);
                }
            }
        }
    }
    
    public async moveAsset(oldPath: string, newPath: string) {
        const guid = this.pathToGuid.get(oldPath);
        if (!guid) {
            // Not indexed? register new
            await this.registerAsset(newPath);
            return;
        }
        
        const record = this.assets.get(guid)!;
        
        // Update Index
        this.pathToGuid.delete(oldPath);
        this.pathToGuid.set(newPath, guid);
        
        record.path = newPath;
        
        // Move .meta file physically
        const fs = getFileSystem();
        try {
            const metaContent = JSON.stringify(record.meta, null, 2);
            await fs.writeFile(`${newPath}.meta`, metaContent);
            await fs.deleteFile(`${oldPath}.meta`);
        } catch (e) {
            console.error('[AssetDatabase] Failed to move meta:', e);
        }
    }

    // --- Helpers ---

    private createDefaultMeta(path: string): AssetMeta {
        return {
            guid: crypto.randomUUID(),
            importer: this.detectType(path),
            version: 1,
            options: {}
        };
    }

    private async writeMeta(path: string, meta: AssetMeta) {
        const fs = getFileSystem();
        const metaPath = `${path}.meta`;
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    }

    private detectType(path: string): AssetType {
        const ext = path.split('.').pop()?.toLowerCase();
        if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext!)) return 'texture';
        if (['mp3', 'wav', 'ogg', 'caf'].includes(ext!)) return 'audio';
        if (['ts', 'js'].includes(ext!)) return 'script';
        if (['json'].includes(ext!)) {
            // Check if scene? (Contextual, but for now generic)
            if (path.includes('scenes/')) return 'scene';
        }
        if (['ttf', 'otf', 'woff', 'fnt'].includes(ext!)) return 'font';
        return 'unknown';
    }
}
