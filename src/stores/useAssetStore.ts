
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { projectState } from '../editor/managers/ProjectManager';
import { getFileSystem, type FileChangeEvent } from '../api/FileSystem';

export interface FileNode {
    name: string;
    path: string; // Relative path
    fullPath: string; // Absolute path
    type: 'file' | 'directory';
    children?: FileNode[];
}

export const useAssetStore = defineStore('assets', () => {
    // Tree structure of files
    const files = ref<FileNode[]>([]);

    const initWatcher = async () => {
        const fs = getFileSystem();

        // Watch Project State
        watch(() => projectState.currentProjectPath, async (newPath) => {
            if (newPath) {
                console.log('AssetStore: Switching project to', newPath);
                files.value = []; // Clear current files
                currentPath.value = ''; // Reset navigation
                
                import('../editor/managers/AssetDatabase').then(({ AssetDatabase }) => {
                     // In 3.0, we just register files as they come in? or Refresh all?
                     // For 'initial' load, we can refresh.
                     AssetDatabase.instance.refreshDatabase(); // Initial Scan
                });

                await fs.watchProject(newPath as any, (event: FileChangeEvent) => {
                    // Notify Database
                    import('../editor/managers/AssetDatabase').then(({ AssetDatabase }) => {
                        if (event.event === 'add' || event.event === 'change') {
                             if (event.path && !event.path.endsWith('.meta')) {
                                 AssetDatabase.instance.registerAsset(event.path);
                             }
                        } else if (event.event === 'unlink') {
                             if (event.path) AssetDatabase.instance.deleteAsset(event.path);
                        }
                    });
                    // Notify Resource Manager of Content Changes
                    if (event.event === 'change' && event.path) {
                        // Normalize path to ensure it matches what RenderSystem uses (usually relative)
                        const normPath = event.path.replace(/\\/g, '/');
                        // If path is absolute (starts with project path), make it relative
                        // But wait, event.path from watcher might vary.
                        // Ideally ResourceManager handles path normalization/matching.
                        // For now, pass as is, let ResourceManager decide or verify.
                        // Actually, better to strip project path here if possible.
                        const projPath = (typeof projectState.currentProjectPath === 'string') 
                            ? projectState.currentProjectPath.replace(/\\/g, '/') 
                            : '';
                        let relPath = normPath;
                        if (projPath && normPath.startsWith(projPath)) {
                             relPath = normPath.slice(projPath.length + 1);
                        }
                        
                        // We use the Engine's ResourceManager singleton
                        import('../engine/resources/ResourceManager').then(({ resourceManager }) => {
                             resourceManager.notifyAssetChanged(relPath);
                        });
                    }

                    // Handle bulk updates (initial or manual re-scan)
                    if ((event.event === 'initial' || event.event === 'change') && event.files) {
                        console.log('AssetStore: Received bulk update', event.files.length, 'files');
                        files.value = event.files.map(f => ({
                            name: f.name,
                            path: f.path, // relative
                            fullPath: f.path, 
                            type: f.type
                        }));
                        
                        // 3.0: AssetDatabase handles initial scan and meta creation.
                    } else {
                        // Incremental updates (Electron usually)
                        handleFileEvent(event.event, event.path, event.fullPath || event.path);
                    }
                });
            }
        }, { immediate: true });
    };

    const handleFileEvent = (event: string, relativePath: string, fullPath: string) => {
        if (event === 'add' || event === 'addDir') {
            const node: FileNode = {
                name: relativePath.split(/[\\/]/).pop() || '',
                path: relativePath,
                fullPath: fullPath,
                type: event === 'addDir' ? 'directory' : 'file'
            };
            
            // Check existence
            if (!files.value.find(f => f.path === relativePath)) {
                files.value.push(node);
            }
            
            // 3.0: AssetDatabase handles Meta creation via registerAsset.
            // Removed legacy MetaManager call to prevent WRITE RACE CONDITION.

        } else if (event === 'unlink' || event === 'unlinkDir') {
            files.value = files.value.filter(f => f.path !== relativePath);
            
            // 3.0: AssetDatabase handles Meta deletion.
        }
    };



    const currentPath = ref<string>('');

    // State for View Options
    const zoomLevel = ref<number>(1); // 0=List, 1=Small, 2=Medium, 3=Large
    const searchQuery = ref<string>('');
    const sortOrder = ref<'asc' | 'desc'>('asc');
    const expandedFolders = ref<Set<string>>(new Set());

    const toggleFolder = (path: string) => {
        if (expandedFolders.value.has(path)) {
            expandedFolders.value.delete(path);
        } else {
            expandedFolders.value.add(path);
        }
    }

    const setZoom = (level: number) => {
        zoomLevel.value = Math.max(0, Math.min(3, level));
    }

    // Computed: visibleFiles
    // We filter `files` to show only those in `currentPath`
    // We assume paths use '/' or '\' separators. We normalize to '/'.
    const visibleFiles = computed(() => {
        const normCurrent = normalizePath(currentPath.value);
        const query = searchQuery.value.toLowerCase().trim();
        
        let result = files.value.filter(file => {
            const normPath = normalizePath(file.path);
            
            // SEARCH MODE
            if (query) {
                // In search mode, match filename against query regardless of folder
                return file.type === 'file' && file.name.toLowerCase().includes(query);
            }

            // NORMAL NAVIGATION MODE
            
            // Filter 1: Must start with current path (if current is not empty)
            if (normCurrent && !normPath.startsWith(normCurrent + '/')) {
                return false;
            }

            // Filter 2: Must not have further separators after the current path
            const relative = normCurrent ? normPath.slice(normCurrent.length + 1) : normPath;
            
            // If relative is empty, it IS the current directory itself (don't show self)
            if (!relative) return false;

            // Immediate children only (no slashes in relative part)
            if (relative.includes('/')) return false;

            // SPECIAL RULE: If at Root level, ONLY show 'assets' folder
            if (!normCurrent) {
               if (relative.toLowerCase() !== 'assets') {
                   return false;
               }
            }
            
            // CHANGE: Hide .meta files
            if (file.name.endsWith('.meta')) return false;

            return true;
        });

        // SORTING
        result.sort((a, b) => {
            // Folders always first
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            // Then Sort by Name
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            if (nameA < nameB) return sortOrder.value === 'asc' ? -1 : 1;
            if (nameA > nameB) return sortOrder.value === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    });

    const normalizePath = (p: string) => p.replace(/\\/g, '/');

    const changeDirectory = (path: string) => {
        currentPath.value = path;
        searchQuery.value = ''; // Clear search on navigation
        expandedFolders.value.add(path); // Auto-expand current
    };

    const goUp = () => {
        if (!currentPath.value) return;
        const parts = normalizePath(currentPath.value).split('/');
        parts.pop();
        currentPath.value = parts.join('/');
        searchQuery.value = ''; // Clear search on navigation
    };

    const renameAsset = async (oldPath: string, newName: string) => {
        const fs = getFileSystem();
        const parts = oldPath.split('/');
        parts.pop();
        const dir = parts.join('/');
        const newPath = dir ? `${dir}/${newName}` : newName;

        if (oldPath === newPath) return;

        // 1. Move Meta First (Preserve GUID via AssetDatabase)
        const { AssetDatabase } = await import('../editor/managers/AssetDatabase');
        await AssetDatabase.instance.moveAsset(oldPath, newPath);

        // 2. Rename File
        await fs.renameFile(oldPath, newPath);
        
        // 3. Notify Engine (Update Entities)
        const { resourceManager } = await import('../engine/resources/ResourceManager');
        const count = await resourceManager.notifyAssetRenamed(oldPath, newPath);

        // 4. If entities were updated, SAVE the scene to persist changes (avoid broken links on reload)
        if (count > 0) {
            const { SceneManager } = await import('../engine/managers/SceneManager');
            const sceneJson = SceneManager.saveScene();
            // Assuming current scene is "MainScene" or using activeSceneName?
            // SceneManager._activeSceneName might be "MainScene" (no ext) or "Untitled Scene"
            // We should ideally track the file path of the open scene.
            // For now, let's assume it lives in 'assets/scenes/{ActiveName}.json'
            
            let sceneName = SceneManager.activeSceneName;
            if (!sceneName.endsWith('.json')) sceneName += '.json';
             // If it's "Untitled Scene", we probably shouldn't auto-save to a file?
             // But if we are renaming assets, we are likely in a saved project state.
             
            if (sceneName !== 'Untitled Scene.json') {
                const scenePath = `assets/scenes/${sceneName}`;
                await fs.writeFile(scenePath, sceneJson);
                console.log(`[AssetStore] Auto-Saved scene '${scenePath}' after asset rename.`);
            }
        }
    };

    return {
        files,
        currentPath,
        visibleFiles,
        zoomLevel,
        searchQuery,
        sortOrder,
        expandedFolders,
        initWatcher,
        changeDirectory,
        goUp,
        setZoom,
        toggleFolder,
        renameAsset
    };
});
