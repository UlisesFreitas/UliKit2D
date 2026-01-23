import { reactive } from 'vue';
import { getFileSystem, type FileChangeEvent } from '../../api/FileSystem';
import { ProjectSettingsManager } from './ProjectSettingsManager';

export const projectState = reactive({
    currentProjectPath: null as string | FileSystemDirectoryHandle | null,
    isDirty: false,
    projectName: 'Untitled'
});

export class ProjectManager {
    
    static async createProject(customPath?: string) {
        console.log('ProjectManager: Creating new project...', customPath ? `(Path: ${customPath})` : '(Interactive)');
        const fs = getFileSystem();
        
        // Use provided path or ask user
        const pathOrHandle = customPath || await fs.selectFolder();
        
        if (pathOrHandle) {
            const result = await fs.createProject(pathOrHandle as any);
            if (result.success) {
                 projectState.currentProjectPath = pathOrHandle;
                 console.log(`[ProjectManager] Set currentProjectPath to: ${projectState.currentProjectPath}`);
                 
                 if (typeof pathOrHandle === 'string') {
                    // Extract name from path
                    // Handle both / and \ 
                    projectState.projectName = pathOrHandle.replace(/[\\/]$/, '').split(/[/\\]/).pop() || 'New Project';
                 } else {
                    projectState.projectName = (pathOrHandle as FileSystemDirectoryHandle).name;
                 }
                 
                  // Watch Project
                 await fs.watchProject(pathOrHandle as any, (_event: FileChangeEvent) => {
                    // This will be handled by AssetStore usually
                 });
                 console.log('Project Created:', projectState.projectName);

                 // INITIALIZE SETTINGS
                 await ProjectSettingsManager.saveSettings(pathOrHandle);

                 // LOAD THE INITIAL SCENE
                 // Dynamic import to avoid circular dependency issues if any
                 const { SceneManager } = await import('../../engine/managers/SceneManager');
                 // Create default scene directly for new projects
                 SceneManager.createDefaultScene();
                 (SceneManager as any)._activeSceneName = 'NewScene';
                 
                 // Optional: Auto-save the initial scene?
                 // await ProjectManager.saveProject();
            } else {
                console.error('Failed to create project:', result.error);
                alert('Failed to create project: ' + result.error);
            }
        }
    }

    static closeProject() {
        projectState.currentProjectPath = null;
        projectState.projectName = 'Untitled';
        console.log('[ProjectManager] Project closed');
    }

    static async openProject() {
        console.log('ProjectManager: Opening project...');
        const fs = getFileSystem();
        const pathOrHandle = await fs.selectFolder();
        
        if (pathOrHandle) {
            projectState.currentProjectPath = pathOrHandle;
            
            if (typeof pathOrHandle === 'string') {
                projectState.projectName = pathOrHandle.split(/[/\\]/).pop() || 'Project';
             } else {
                projectState.projectName = (pathOrHandle as FileSystemDirectoryHandle).name;
             }
            
            // Watch Project
            await fs.watchProject(pathOrHandle as any, (_event: FileChangeEvent) => {});
            
            console.log('Project Opened:', projectState.projectName);

            // LOAD SETTINGS
            await ProjectSettingsManager.loadSettings(pathOrHandle);

            // Load Initial Scene
            const { SceneManager } = await import('../../engine/managers/SceneManager');
                // Check if NewScene.json exists to avoid 404/ENOENT errors
                try {
                    const sceneFiles = await fs.readdir('assets/scenes');
                    const hasDefaultScene = sceneFiles.some(f => f.name === 'NewScene.json');

                    if (hasDefaultScene) {
                        console.log('[ProjectManager] Loading initial scene: assets/scenes/NewScene.json');
                        await SceneManager.loadSceneFromFile('assets/scenes/NewScene.json');
                    } else if (sceneFiles.length > 0) {
                        // Fallback: Load first available scene logic
                        const firstScene = sceneFiles.find(f => f.name.endsWith('.json'));
                        if (firstScene) {
                             console.log(`[ProjectManager] NewScene.json not found. Loading ${firstScene.name}`);
                             await SceneManager.loadSceneFromFile(firstScene.path);
                        } else {
                             console.warn('[ProjectManager] No JSON scenes found. Creating default.');
                             SceneManager.createDefaultScene();
                        }
                    } else {
                        console.warn('[ProjectManager] NewScene.json not found. Creating default scene.');
                        SceneManager.createDefaultScene();
                    }
                } catch (e) {
                    // Start fresh if folder missing
                    console.warn('[ProjectManager] Could not read assets/scenes directory. Creating default scene.', e);
                    SceneManager.createDefaultScene();
                }
        }
    }

    static async saveProject() {
        console.log('ProjectManager: Saving project...');
        
        // Dynamic import to avoid circular dep if needed, though Manager -> Manager is usually fine if mindful
        const { SceneManager } = await import('../../engine/managers/SceneManager');
        const json = SceneManager.saveScene();
        const fs = getFileSystem();
        
        if (projectState.currentProjectPath) {
            // Ensure assets/scenes exists
             const scenesDir = 'assets/scenes';
             // We can't easily check dir existence with current API without erroring, but writeFile usually handles it if parent exists.
             // For now assuming assets/ exists.
             
             const filename = `${SceneManager.activeSceneName.replace(/\s+/g, '_')}.json`;
             const fullPath = `${scenesDir}/${filename}`;
             
             const success = await fs.writeFile(fullPath, json);
             if (success) {
                 console.log(`[ProjectManager] Saved scene to ${fullPath}`);
                 projectState.isDirty = false;
                 // Notify usage
                 alert(`Scene saved to ${fullPath}`);
             } else {
                 console.error('[ProjectManager] Save failed');
                 alert('Save failed: Unknown error');
             }
        } else {
            console.warn('[ProjectManager] No project open, cannot save.');
        }
    }
}
