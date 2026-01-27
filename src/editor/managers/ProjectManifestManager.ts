import { getFileSystem } from '../../api/FileSystem';
import { type IProjectSettings, useProjectSettingsStore } from '../../stores/useProjectSettingsStore';
import { AssetDatabase } from '@/editor/managers/AssetDatabase';
import type { IResourceEntry, ISceneEntry } from '@/editor/managers/types';

export interface IProjectManifest {
    name: string;
    version: string;
    engineVersion: string;
    created: number;
    lastModified: number;
    
    settings: IProjectSettings;
    scenes: ISceneEntry[];
    resources: IResourceEntry[];
}

export class ProjectManifestManager {
    private static _manifest: IProjectManifest | null = null;


    static get manifest() { return this._manifest; }

    static createDefault(name: string): IProjectManifest {
        const settingsStore = useProjectSettingsStore();
        
        const manifest: IProjectManifest = {
            name: name,
            version: '0.0.1',
            engineVersion: '1.0.0',
            created: Date.now(),
            lastModified: Date.now(),
            settings: JSON.parse(JSON.stringify(settingsStore.settings)), // Copy current defaults
            scenes: [],
            resources: []
        };
        
        this._manifest = manifest;
        return manifest;
    }

    static async saveProject(path: string) {
        if (!this._manifest) return;
        this._manifest.lastModified = Date.now();
        
        // Sync latest settings from Store
        const settingsStore = useProjectSettingsStore();
        this._manifest.settings = settingsStore.settings;
        
        // Sync resources from AssetDatabase (if db has newer in-memory state)
        // For now, AssetDatabase updates Manifest directly? 
        // Or Manifest is Source of Truth?
        // Let's make Manifest Manger the serializer.
        const resources = AssetDatabase.instance.exportRegistry();
        this._manifest.resources = resources;

        const fs = getFileSystem();
        const jsonContent = JSON.stringify(this._manifest, null, 2);
        
        // Ensure path ends with project.json
        const fullPath = path.endsWith('project.json') ? path : `${path}/project.json`;
        await fs.writeFile(fullPath, jsonContent);
        console.log('[ProjectManifest] Saved to', fullPath);
    }

    static async loadProject(path: string): Promise<boolean> {
        const fs = getFileSystem();
        try {
            const fullPath = path.endsWith('project.json') ? path : `${path}/project.json`;
            const content = await fs.readFile(fullPath);
            const data = JSON.parse(content) as IProjectManifest;
            
            this._manifest = data;
            
            // 1. Hydrate Settings
            const settingsStore = useProjectSettingsStore();
            settingsStore.setSettings(data.settings);
            
            // 2. Hydrate AssetDatabase
            // We pass the RAW resource list. DB is passive now.
            AssetDatabase.instance.hydrate(data.resources || []);
            
            console.log(`[ProjectManifest] Loaded project "${data.name}" with ${(data.resources || []).length} resources.`);
            return true;
        } catch (e) {
            console.error('[ProjectManifest] Failed to load:', e);
            return false;
        }
    }
}
