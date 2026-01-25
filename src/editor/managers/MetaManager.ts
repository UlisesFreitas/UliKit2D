import { getFileSystem } from '../../api/FileSystem';

export interface AssetMeta {
    guid: string;
    importer: string;
    version: number;
    options: Record<string, any>;
}

export class MetaManager {
    static metaMap = new Map<string, AssetMeta>(); // Path -> Meta
    static guidMap = new Map<string, string>(); // GUID -> Path

    private static generateGUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    static async loadProject() {
        console.log('[MetaManager] Scanning for meta files...');
        this.metaMap.clear();
        this.guidMap.clear();

        // Initial scan is handled by FileSystem recursive scan usually, 
        // but here we need to ensure we process them.
        // For now, we wait for AssetStore to populate or we scan ourselves?
        // Let's rely on AssetStore's file list or FileSystem API if available.
        // Actually, best to decouple. We scan directory.
        
        // TODO: Deep scan implementation
        // For iteration 1, we will expose keys to generate metas on demand or when AssetStore notifies us.
    }

    private static pendingPromises = new Map<string, Promise<AssetMeta>>();

    static async ensureMeta(relativePath: string): Promise<AssetMeta> {
        // Deduplicate requests
        if (this.pendingPromises.has(relativePath)) {
            return this.pendingPromises.get(relativePath)!;
        }

        const promise = (async () => {
            const fs = getFileSystem();
            const metaPath = `${relativePath}.meta`;
            
            try {
                // Try reading first
                const content = await fs.readFile(metaPath);
                const meta = JSON.parse(content) as AssetMeta;
                
                // Cache
                this.metaMap.set(relativePath, meta);
                this.guidMap.set(meta.guid, relativePath);
                
                return meta;
            } catch (e) {
                // Meta missing, create new
                // console.log(`[MetaManager] Creating meta for ${relativePath}`);
                
                const newMeta: AssetMeta = {
                    guid: this.generateGUID(),
                    importer: this.detectImporter(relativePath),
                    version: 1,
                    options: {}
                };
                
                // We use writeFile which overwrites by default in Node, but ZenFS might be stricter?
                // The error was "File exists" which implies exclusive creation or race.
                // Since we are now mutexed by pendingPromises, the race should be gone.
                await fs.writeFile(metaPath, JSON.stringify(newMeta, null, 2));
                
                this.metaMap.set(relativePath, newMeta);
                this.guidMap.set(newMeta.guid, relativePath);
                
                return newMeta;
            } finally {
                this.pendingPromises.delete(relativePath);
            }
        })();

        this.pendingPromises.set(relativePath, promise);
        return promise;
    }

    static async deleteMeta(relativePath: string) {
        if (!this.metaMap.has(relativePath)) return;
        
        const fs = getFileSystem();
        const metaPath = `${relativePath}.meta`;
        
        try {
            await fs.deleteFile(metaPath);
            const guid = this.metaMap.get(relativePath)?.guid;
            if (guid) this.guidMap.delete(guid);
            this.metaMap.delete(relativePath);
            console.log(`[MetaManager] Deleted meta for ${relativePath}`);
        } catch (e) {
            console.error(`[MetaManager] Failed to delete meta for ${relativePath}`, e);
        }
    }

    static async moveMeta(oldPath: string, newPath: string) {
        if (!this.metaMap.has(oldPath)) {
            // Maybe we haven't loaded it yet? Try ensure.
            await this.ensureMeta(oldPath);
        }

        const fs = getFileSystem();
        const oldMetaPath = `${oldPath}.meta`;
        const newMetaPath = `${newPath}.meta`;
        
        try {
            // Read old meta
            const content = await fs.readFile(oldMetaPath);
            // Write to new location
            await fs.writeFile(newMetaPath, content);
            // Delete old
            await fs.deleteFile(oldMetaPath);
            
            // Update Maps
            const meta = this.metaMap.get(oldPath);
            if (meta) {
                this.metaMap.delete(oldPath);
                this.metaMap.set(newPath, meta);
                this.guidMap.set(meta.guid, newPath);
            }
            
            console.log(`[MetaManager] Moved meta ${oldPath} -> ${newPath}`);
        } catch (e) {
            console.error(`[MetaManager] Failed to move meta ${oldPath} -> ${newPath}`, e);
            // Create new meta as fallback
            await this.ensureMeta(newPath);
        }
    }

    static detectImporter(path: string): string {
        if (path.endsWith('.png') || path.endsWith('.jpg')) return 'texture';
        if (path.endsWith('.mp3') || path.endsWith('.wav')) return 'audio';
        if (path.endsWith('.ts') || path.endsWith('.js')) return 'script';
        return 'default';
    }

    static getAssetGuid(path: string): string | undefined {
        return this.metaMap.get(path)?.guid;
    }

    static getAssetPath(guid: string): string | undefined {
        return this.guidMap.get(guid);
    }
}
