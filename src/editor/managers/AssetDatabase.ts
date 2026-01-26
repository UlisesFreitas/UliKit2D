import type { IResourceEntry } from './types';

export type AssetType = 'texture' | 'audio' | 'script' | 'scene' | 'font' | 'directory' | 'unknown';

export interface AssetRecord {
    guid: string;
    path: string;       // Relative to Project Root
    type: AssetType;
    meta?: any;
    lastModified: number;
}

export class AssetDatabase {
    private static _instance: AssetDatabase;
    
    // Core Registry
    public assets = new Map<string, AssetRecord>(); // GUID -> Record
    public pathToGuid = new Map<string, string>();   // Path -> GUID
    
    public static get instance(): AssetDatabase {
        if (!this._instance) this._instance = new AssetDatabase();
        return this._instance;
    }

    private constructor() {}

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
     * Hydrates the database from the Project Manifest (project.json).
     * This is O(N) memory allocation, but O(0) Disk I/O.
     * Extremely fast.
     */
    public hydrate(entries: IResourceEntry[]) {
        console.time('AssetDatabase.hydrate');
        this.assets.clear();
        this.pathToGuid.clear();
        
        for (const entry of entries) {
            const record: AssetRecord = {
                guid: entry.guid,
                path: entry.path,
                type: entry.type as AssetType,
                meta: entry.meta || {},
                lastModified: Date.now()
            };
            this.assets.set(record.guid, record);
            this.pathToGuid.set(record.path, record.guid);
        }
        console.log(`[AssetDatabase] Hydrated ${entries.length} assets.`);
        console.timeEnd('AssetDatabase.hydrate');
    }

    /**
     * Registers a NEW asset (e.g. during Import).
     * Returns the new Record.
     * Caller must save Manifest to persist.
     */
    public registerAsset(path: string, type?: AssetType): AssetRecord {
        // Dedup
        const existingGuid = this.pathToGuid.get(path);
        if (existingGuid) return this.assets.get(existingGuid)!;

        // Auto-detect type if missing
        if (!type) {
            type = this.detectType(path);
        }

        const guid = crypto.randomUUID();
        const record: AssetRecord = {
            guid,
            path,
            type,
            meta: {},
            lastModified: Date.now()
        };

        this.assets.set(guid, record);
        this.pathToGuid.set(path, guid);

        console.log(`[AssetDatabase] Registered new asset: ${path} (${guid})`);
        return record;
    }
    
    // ...

    public deleteAsset(path: string) {
        const guid = this.pathToGuid.get(path);
        if (guid) {
            this.assets.delete(guid);
            this.pathToGuid.delete(path);
        }
    }

    public cleanupFolder(folderPath: string) {
        // Find all assets that start with folderPath + '/'
        const prefix = folderPath.endsWith('/') ? folderPath : folderPath + '/';
        const toRemove: string[] = [];
        
        for (const [path, guid] of this.pathToGuid) {
            if (path.startsWith(prefix)) {
                toRemove.push(guid);
            }
        }
        
        for (const guid of toRemove) {
            const record = this.assets.get(guid);
            if (record) {
                this.pathToGuid.delete(record.path);
                this.assets.delete(guid);
            }
        }
    }
    
    public moveAsset(oldPath: string, newPath: string) {
        const guid = this.pathToGuid.get(oldPath);
        if (!guid) return;
        
        const record = this.assets.get(guid)!;
        
        this.pathToGuid.delete(oldPath);
        this.pathToGuid.set(newPath, guid);
        record.path = newPath;
    }

    public exportRegistry(): IResourceEntry[] {
        return Array.from(this.assets.values()).map(r => ({
            guid: r.guid,
            path: r.path,
            type: r.type,
            meta: r.meta
        }));
    }

    private detectType(path: string): AssetType {
        const ext = path.split('.').pop()?.toLowerCase();
        if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext!)) return 'texture';
        if (['mp3', 'wav', 'ogg', 'caf'].includes(ext!)) return 'audio';
        if (['ts', 'js'].includes(ext!)) return 'script';
        if (['json'].includes(ext!)) {
            if (path.includes('scenes/')) return 'scene';
        }
        if (['ttf', 'otf', 'woff', 'fnt'].includes(ext!)) return 'font';
        return 'unknown';
    }
}
