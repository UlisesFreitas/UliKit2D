import { reactive } from 'vue';
import { getFileSystem } from '../../api/FileSystem';
import { useAssetStore } from '../../stores/useAssetStore';
import { useUIStore } from '../../stores/useUIStore';

export const projectState = reactive({
    currentProjectPath: null as string | FileSystemDirectoryHandle | null,
    isDirty: false,
    projectName: 'Untitled'
});

export class ProjectManager {
    
    static getRecents(): {name: string, path: string}[] {
        try {
            const stored = localStorage.getItem('ulikit_recents');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    static addToRecents(name: string) {
        const recents = this.getRecents();
        // Remove existing if present to move to top
        const filtered = recents.filter(r => r.name !== name);
        filtered.unshift({ name, path: name }); // path = name in Web/OPFS
        // Limit to 10
        if (filtered.length > 50) filtered.pop();
        
        localStorage.setItem('ulikit_recents', JSON.stringify(filtered));
    }

    static async createProject(customPath?: string) {
        const _pStart = performance.now();
        console.log('ProjectManager: Creating new project...', customPath ? `(Path: ${customPath})` : '(Interactive)');
        const fs = getFileSystem();
        const ui = useUIStore();
        
        // Use provided path or ask user
        const pathOrHandle = customPath || await fs.selectFolder();
        
        if (pathOrHandle) {
            // @ts-ignore
            if (ui.setLoading) ui.setLoading(true, 'Creating Project...'); 
            const result = await fs.createProject(pathOrHandle as any);
            
            if (result.success) {
                 projectState.currentProjectPath = pathOrHandle;
                 
                 if (typeof pathOrHandle === 'string') {
                    projectState.projectName = pathOrHandle.replace(/[\\/]$/, '').split(/[/\\]/).pop() || 'New Project';
                 } else {
                    projectState.projectName = (pathOrHandle as FileSystemDirectoryHandle).name;
                 }

                 // 1. Initialize Manifest (project.json)
                 const { ProjectManifestManager } = await import('./ProjectManifestManager');
                 ProjectManifestManager.createDefault(projectState.projectName);
                 
                 // 2. Save Manifest
                 // Ensure project.json is written
                 await ProjectManifestManager.saveProject('project.json');

                 // 3. Hydrate DB (Empty)
                 const { AssetDatabase } = await import('./AssetDatabase');
                 AssetDatabase.instance.hydrate([]);

                 // 4. Notify AssetStore
                 // @ts-ignore
                 await useAssetStore().refreshFromDatabase();

                 const _pEnd = performance.now();
                 console.log(`%c ⏱️ CREATION COMPLETE: ${(_pEnd - _pStart).toFixed(2)}ms `, 'background: #bada55; color: #222; font-size: 20px;');
                 console.log('Project Created:', projectState.projectName);

                 this.addToRecents(projectState.projectName);

                 // Load Default Scene
                 try {
                     const { SceneManager } = await import('../../engine/managers/SceneManager');
                     SceneManager.createDefaultScene();
                 } catch (e) {
                     console.error('[ProjectManager] Error initializing SceneManager:', e);
                 }
                 
                 // 5. Force View to 'assets'
                 // @ts-ignore
                 useAssetStore().changeDirectory('assets');
                 
                 // @ts-ignore
                 if (ui.setLoading) ui.setLoading(false);
            } else {
                console.error('Failed to create project:', result.error);
                // @ts-ignore
                if (ui.setLoading) ui.setLoading(false);
                alert('Failed to create project: ' + result.error);
            }
        }
    }

    static closeProject() {
        projectState.currentProjectPath = null;
        projectState.projectName = 'Untitled';
        console.log('[ProjectManager] Project closed');
    }

    static async openProject(customPath?: string) {
        const _pStart = performance.now();
        console.log('ProjectManager: Opening project...', customPath || '(Interactive)');
        const fs = getFileSystem();
        const ui = useUIStore();
        
        const pathOrHandle = customPath || await fs.selectFolder();
        
        if (pathOrHandle) {
            // @ts-ignore
            if (ui.setLoading) ui.setLoading(true, 'Opening Project...');
            try {
                projectState.currentProjectPath = pathOrHandle;
                
                if (typeof pathOrHandle === 'string') {
                    projectState.projectName = pathOrHandle.split(/[/\\]/).pop() || 'Project';
                 } else {
                    projectState.projectName = (pathOrHandle as FileSystemDirectoryHandle).name;
                 }
                
                // Initialize FileSystem Context
                // For WebFS, this sets currentProject so readFile works.
                await fs.openProject(projectState.projectName);

                // 1. Load Manifest
                const { ProjectManifestManager } = await import('./ProjectManifestManager');
                const success = await ProjectManifestManager.loadProject('project.json');

                if (!success) {
                    console.warn('[ProjectManager] project.json not found. Creating default empty.');
                    const { AssetDatabase } = await import('./AssetDatabase');
                    AssetDatabase.instance.hydrate([]);
                }
                
                // 2. Notify AssetStore
                // @ts-ignore
                await useAssetStore().refreshFromDatabase();
                
                const _pEnd = performance.now();
                console.log(`%c ⏱️ LOAD COMPLETE: ${(_pEnd - _pStart).toFixed(2)}ms `, 'background: #00ffff; color: #222; font-size: 20px;');
                
                this.addToRecents(projectState.projectName);

                // Load Initial Scene
                const { SceneManager } = await import('../../engine/managers/SceneManager');
                const { ProjectManifestManager: PM } = await import('./ProjectManifestManager');
                
                const manifest = PM.manifest;
                let sceneLoaded = false;
                
                if (manifest && manifest.scenes && manifest.scenes.length > 0) {
                     // Try loading first scene
                     if (manifest.scenes[0]) {
                        sceneLoaded = await SceneManager.loadSceneByPath(manifest.scenes[0].path);
                     }
                }
                
                if (!sceneLoaded) {
                    SceneManager.createDefaultScene();
                }

                // 3. Force View to 'assets' Master Folder
                // @ts-ignore
                useAssetStore().changeDirectory('assets');

            } finally {
                // @ts-ignore
                if (ui.setLoading) ui.setLoading(false);
            }
        }
    }

    static async saveProject() {
        console.log('ProjectManager: Saving project...');
        
        // 1. Save Active Scene
        const { SceneManager } = await import('../../engine/managers/SceneManager');
        const json = SceneManager.saveScene();
        const fs = getFileSystem();
        
        if (projectState.currentProjectPath) {
             const scenesDir = 'assets/scenes';
             const filename = `${SceneManager.activeSceneName.replace(/\s+/g, '_')}.json`;
             const fullPath = `${scenesDir}/${filename}`;
             
             await fs.writeFile(fullPath, json);
             console.log(`[ProjectManager] Saved scene to ${fullPath}`);

             // 2. Save Manifest (project.json)
             const { ProjectManifestManager } = await import('./ProjectManifestManager');
             // TODO: Add active scene to manifest if not present?
             await ProjectManifestManager.saveProject('project.json');
             
             projectState.isDirty = false;
             alert(`Project Saved.`);
        } else {
            console.warn('[ProjectManager] No project open, cannot save.');
        }
    }
    static async importAssets(inputs: (File | { file: File, path: string })[], targetFolderVal: string = '') {
        console.log('ProjectManager: Importing', inputs.length, 'items to', targetFolderVal);
        const fs = getFileSystem();
        const ui = useUIStore();
        
        // @ts-ignore
        if (ui.setLoading) ui.setLoading(true, `Importing ${inputs.length} files...`, 'determinate');

        try {
            const { AssetDatabase } = await import('./AssetDatabase');
            const { ProjectManifestManager } = await import('./ProjectManifestManager');
            
            let addedCount = 0;
            const total = inputs.length;
            
            for (let i = 0; i < total; i++) {
                const item = inputs[i];
                if (!item) continue;

                // Update Progress
                const percent = ((i) / total) * 100;
                // @ts-ignore
                if (ui.setProgress) ui.setProgress(percent, `Processing ${i+1}/${total}`);

                 // Determine File and Relative Path
                let file: File;
                let relPath: string;

                if ('file' in item && 'path' in item) {
                    file = item.file;
                    relPath = item.path;
                } else {
                    file = item as File;
                    relPath = file.name;
                }

                // Construct full Destination Path (Target Folder + Relative Path from Drop)
                // ENFORCE ASSETS FOLDER: All imports must go into 'assets/'
                let safeTargetFolder = targetFolderVal;
                
                // If target is empty or root, force 'assets'
                if (!safeTargetFolder || safeTargetFolder === '.' || safeTargetFolder === '/') {
                    safeTargetFolder = 'assets';
                }
                // If target doesn't start with assets, prepend it (unless it's empty which we handled)
                else if (!safeTargetFolder.startsWith('assets')) {
                     safeTargetFolder = `assets/${safeTargetFolder}`;
                }

                const fullDestPath = `${safeTargetFolder}/${relPath}`;
                
                // Extract Dir and Filename for importFile
                const lastSlash = fullDestPath.lastIndexOf('/');
                const targetDir = lastSlash > -1 ? fullDestPath.substring(0, lastSlash) : '';
                const fileName = lastSlash > -1 ? fullDestPath.substring(lastSlash + 1) : fullDestPath;

                let success = false;

                // 1. Write to Disk (using importFile to ensure directories are created)
                if (fs.getPathForFile && fs.importFile) {
                    const blobUrl = fs.getPathForFile(file);
                    const result = await fs.importFile(blobUrl, targetDir, fileName);
                    if (!result.success) {
                        console.error(`Failed to import ${fileName}:`, result.error);
                        // Optional: show toast for individual failure? Or checking summary at end?
                        // Just log for now.
                    } else {
                        success = true;
                    }
                } else {
                    success = await fs.writeFile(fullDestPath, file);
                }
                
                if (success) {
                    // 2. Register in Database
                    AssetDatabase.instance.registerAsset(fullDestPath);
                    addedCount++;
                } else {
                    console.warn(`Skipping registration for failed import: ${fullDestPath}`);
                }
            }
            
            // 3. Save Manifest
            if (addedCount > 0) {
                await ProjectManifestManager.saveProject('project.json');
                
                // 4. Update UI
                await useAssetStore().refreshFromDatabase();
                ui.showToast({ title: 'Import Complete', description: `Imported ${addedCount} files.`, type: 'success' });
            }

        } catch (e) {
            console.error('Import failed:', e);
            ui.showToast({ title: 'Import Failed', description: String(e), type: 'error' });
        } finally {
            // @ts-ignore
            if (ui.setLoading) ui.setLoading(false);
        }
    }

    static async deleteAsset(targetPath: string) {
        console.log('ProjectManager: Deleting', targetPath);
        const fs = getFileSystem();
        const ui = useUIStore();
        
        if (targetPath === 'assets') {
             ui.showToast({ title: 'Error', description: 'Cannot delete root assets folder.', type: 'error' });
             return;
        }

        // Blocking UI
        // @ts-ignore
        if (ui.setLoading) ui.setLoading(true, `Deleting ${targetPath}...`, 'indeterminate');

        try {
            const success = await fs.deleteFile(targetPath);
            if (success) {
                 const { AssetDatabase } = await import('./AssetDatabase');
                 const { ProjectManifestManager } = await import('./ProjectManifestManager');
                 
                 // Unregister exact match
                 AssetDatabase.instance.deleteAsset(targetPath);
                 // Cleanup if it was a folder (recursive removal from DB)
                 AssetDatabase.instance.cleanupFolder(targetPath);
    
                 // NEW: Deep Cleanup of Component References in the Active Scene
                 const { SceneManager } = await import('../../engine/managers/SceneManager');
                 SceneManager.removeAssetReferences(targetPath);
                 
                 await ProjectManifestManager.saveProject('project.json');
                 
                 // @ts-ignore
                 await useAssetStore().refreshFromDatabase();
                 ui.showToast({ title: 'Deleted', description: `Deleted ${targetPath}`, type: 'success' });
            } else {
                ui.showToast({ title: 'Error', description: 'Failed to delete file.', type: 'error' });
            }
        } catch (e) {
            console.error('Delete failed:', e);
             ui.showToast({ title: 'Error', description: 'Delete failed.', type: 'error' });
        } finally {
            // @ts-ignore
            if (ui.setLoading) ui.setLoading(false);
        }
    }
    static async createFolder(parentPath: string) {
        const ui = useUIStore();
        
        // Prompt for Name
        const name = await ui.prompt({
            title: 'New Folder',
            message: 'Enter folder name:',
            defaultValue: 'New Folder',
            confirmText: 'Create'
        });
        
        if (!name) return; // Cancelled
        
        // Validation
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) { // Simple validation
             // Maybe allow spaces? Let's allow spaces for now but generally stick to safe chars
        }
        
        // Construct Path
        // If parentPath is 'assets', new path is 'assets/name'
        // If parentPath is empty, force 'assets/name'
        let targetParent = parentPath;
        if (!targetParent || targetParent === '.') targetParent = 'assets';
        
        const fs = getFileSystem();
        const finalPath = `${targetParent}/${name}`;
        
        // Check for Duplicates
        try {
            // We check parent folder contents to avoid 404s/errors from stat'ing non-existent files if FS throws
            const entries = await fs.readdir(targetParent);
            const exists = entries.some(e => e.name === name); // Case sensitive? Win is insensitive.
            
            if (exists) {
                const confirmed = await ui.confirm({
                    title: 'Folder Exists',
                    message: `Folder "${name}" already exists. Do you want to use it?`,
                    confirmText: 'Use/Merge',
                    cancelText: 'Cancel'
                });
                if (!confirmed) return;
            }
        } catch (e) {
            // Parent might create issue, but if parent doesnt exist, we can't create child anyway usually.
            // Ignore error and try to create.
        }

        console.log(`[ProjectManager] Creating folder: ${finalPath}`);
        
        // @ts-ignore
        if (fs.createFolder) {
             // @ts-ignore
             const success = await fs.createFolder(finalPath);
             if (success) {
                 // Register in DB so it shows up even if empty
                 const { AssetDatabase } = await import('./AssetDatabase');
                 const { ProjectManifestManager } = await import('./ProjectManifestManager');
                 
                 AssetDatabase.instance.registerAsset(finalPath, 'directory');
                 await ProjectManifestManager.saveProject('project.json');
                 
                 ui.showToast({ title: 'Success', description: `Created ${name}`, type: 'success' });
                 
                 // Refresh
                 await useAssetStore().refreshFromDatabase();
             } else {
                 ui.showToast({ title: 'Error', description: 'Failed to create folder.', type: 'error' });
             }
        } else {
            console.error('fs.createFolder not implemented');
        }
    }
}
