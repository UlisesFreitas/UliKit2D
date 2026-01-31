import { getFileSystem } from '../../api/FileSystem';
import { useUIStore } from '../../stores/useUIStore';

export class ProjectFactory {

    /**
     * Coordinator: Orchestrates the entire creation of a new project structure.
     * Assumes the parent folder has already been created (empty).
     * @param projectPath Absolute path to the new project root.
     * @param projectName Name of the project.
     */
    static async initializeNewProject(projectPath: string, projectName: string): Promise<boolean> {
        console.log(`[ProjectFactory] Initializing project "${projectName}" at ${projectPath}`);
        const ui = useUIStore();

        // @ts-ignore
        if (ui.setLoading) ui.setLoading(true, 'Initializing Project Structure...');

        try {
            // 1. Create Directory Structure
            await this.createDirectoryStructure(projectPath);

            // 2. Import Default Assets (Internal -> Project)
            await this.copyDefaultAssets(projectPath);

            // 3. Generate Initial Scene
            const scenePath = await this.generateDefaultScene(projectPath);

            // 4. Generate Project Manifest (project.json)
            await this.generateProjectManifest(projectPath, projectName, scenePath);

            // 5. Validation
            await this.validateProjectIntegrity(projectPath);

            console.log('[ProjectFactory] Project initialization successful.');
            return true;

        } catch (e: any) {
             console.error('[ProjectFactory] Initialization Failed:', e);
             ui.showToast({ title: 'Creation Failed', description: e.message, type: 'error' });
             
             // Optional: Cleanup if failed? For now, leave it for manual inspection.
             return false;
        } finally {
            // @ts-ignore
            if (ui.setLoading) ui.setLoading(false);
        }
    }

    private static async createDirectoryStructure(projectPath: string) {
        const fs = getFileSystem();
        try {
             await fs.createFolder(`${projectPath}/assets`);
             await fs.createFolder(`${projectPath}/assets/scenes`);
             await fs.createFolder(`${projectPath}/assets/imported`);
             // Add .gitkeep to ensure empty folders persist if using git? Not strict requirement but good practice.
        } catch (e) {
            throw new Error('Failed to create directory structure. Check permissions.');
        }
    }

    private static async copyDefaultAssets(projectPath: string) {
        const fs = getFileSystem();
        console.log('[ProjectFactory] Copying default assets...');
        
        // Use Glob to find internal resources
        // Note: This relies on Vite's import.meta.glob features for the Web/Electron build.
        const defaultAssets = import.meta.glob('../../resources/default_assets/**/*.*', { query: '?url', import: 'default', eager: true });

        for (const [key, url] of Object.entries(defaultAssets)) {
            // key is like "../../resources/default_assets/player/sprite.png"
            const relativePath = key.replace(/^\.\.\/\.\.\/resources\/default_assets\//, '');
            if (!relativePath) continue;

            try {
                // Fetch blob (works in both Web and Electron renderer)
                const response = await fetch(url as string);
                if (!response.ok) throw new Error(`Fetch failed ${response.status}`);
                const buffer = await response.arrayBuffer();
                
                // Destination
                const destPath = `${projectPath}/assets/${relativePath}`;
                
                // Ensure subdir exists
                const parts = relativePath.split('/');
                parts.pop();
                if (parts.length > 0) {
                     await fs.createFolder(`${projectPath}/assets/${parts.join('/')}`);
                }

                await fs.writeFile(destPath, new Uint8Array(buffer));
            } catch (e) {
                console.warn(`[ProjectFactory] Failed to copy asset ${relativePath}`, e);
                // Non-critical (?)
            }
        }
    }

    private static async generateDefaultScene(projectPath: string): Promise<string> {
        const fs = getFileSystem();
        const relativeScenePath = 'assets/scenes/NewScene.json';
        const fullScenePath = `${projectPath}/${relativeScenePath}`;

        const defaultScene = [
            {
                "id": "main-camera-id",
                "name": "Main Camera",
                "transform": { "x": 0, "y": 0, "rotation": 0, "scale": { "x": 1, "y": 1 } },
                "camera": { "zoom": 1, "isPrimary": true, "backgroundColor": "#333333" }
            }
        ];

        await fs.writeFile(fullScenePath, JSON.stringify(defaultScene, null, 2));
        return relativeScenePath;
    }

    private static async generateProjectManifest(projectPath: string, name: string, initialScenePath: string) {
        const fs = getFileSystem();
        const settingsStore = (await import('../../stores/useProjectSettingsStore')).useProjectSettingsStore();

        // RESET Store to Defaults first to ensure we aren't carrying over dirty state
        settingsStore.resetDefaults();
        
        // Get clean defaults
        const defaultLayers = [...settingsStore.settings.layers];

        const manifest = {
            name: name,
            version: '0.0.1',
            engineVersion: '1.0.0', // TODO: Get from constant AND version package.json
            created: Date.now(),
            lastModified: Date.now(),
            settings: {
                layers: defaultLayers, // Source of Truth from Store
                physics: { 
                    gravity: { x: 0, y: 9.8 },
                    // Collision Matrix default?
                },
                // Add other defaults as needed
            },
            scenes: [
                {
                    name: 'NewScene',
                    path: initialScenePath,
                    id: crypto.randomUUID(),
                    updated: Date.now()
                }
            ],
            resources: [
                initialScenePath 
            ] // Will be populated by Watcher/Scan, but we seed the critical scene first
        };

        await fs.writeFile(`${projectPath}/project.json`, JSON.stringify(manifest, null, 4));
    }

    private static async validateProjectIntegrity(projectPath: string) {
        const fs = getFileSystem();
        
        const manifestContent = await fs.readFile(`${projectPath}/project.json`);
        if (!manifestContent) throw new Error('Integrity Check Failed: project.json is missing or empty.');

        try {
            const json = JSON.parse(manifestContent);
            if (!json.settings || !json.settings.layers) throw new Error('Integrity Check Failed: project.json malformed.');
        } catch (e) {
            throw new Error('Integrity Check Failed: project.json invalid JSON.');
        }

        const sceneContent = await fs.readFile(`${projectPath}/assets/scenes/NewScene.json`);
        if (!sceneContent) throw new Error('Integrity Check Failed: Initial Scene missing.');
    }
}
