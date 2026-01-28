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
        // Ensure we have a manifest to save
        if (!this._manifest) {
            console.warn('[ProjectManifest] WARN: Manifest was null during save. Reconstructing from current memory state.');
            this.createDefault('Untitled Project');
        }
        
        const manifest = this._manifest!;

        manifest.lastModified = Date.now();
        
        // Sync latest settings from Store
        const settingsStore = useProjectSettingsStore();
        manifest.settings = settingsStore.settings;
        
        // Sync resources from AssetDatabase
        const resources = AssetDatabase.instance.exportRegistry();
        manifest.resources = resources;

        const fs = getFileSystem();
        const jsonContent = JSON.stringify(manifest, null, 2);
        
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
            await settingsStore.setSettings(data.settings);
            
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
    static addScene(name: string, path: string) {
        if (!this._manifest) return;
        // Avoid duplicates
        if (this._manifest.scenes.some(s => s.path === path || s.name === name)) {
            console.warn(`[ProjectManifest] Scene ${name} (${path}) already exists.`);
            return;
        }
        this._manifest.scenes.push({
            name,
            path,
            id: crypto.randomUUID(),
            updated: Date.now()
        });
        this._manifest.lastModified = Date.now();
    }

    static removeScene(path: string) {
        if (!this._manifest) return;
        const index = this._manifest.scenes.findIndex(s => s.path === path);
        if (index !== -1) {
            this._manifest.scenes.splice(index, 1);
            this._manifest.lastModified = Date.now();
        }
    }

    static renameScene(oldPath: string, newName: string, newPath: string) {
        if (!this._manifest) return;
        const scene = this._manifest.scenes.find(s => s.path === oldPath);
        if (scene) {
            scene.name = newName;
            scene.path = newPath;
            scene.updated = Date.now();
            this._manifest.lastModified = Date.now();
        }
    }
}
