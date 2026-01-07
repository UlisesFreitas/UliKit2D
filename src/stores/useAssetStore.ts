
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
                
                await fs.watchProject(newPath as any, (event: FileChangeEvent) => {
                    // Handle bulk updates (initial or manual re-scan)
                    if ((event.event === 'initial' || event.event === 'change') && event.files) {
                        console.log('AssetStore: Received bulk update', event.files.length, 'files');
                        files.value = event.files.map(f => ({
                            name: f.name,
                            path: f.path,
                            fullPath: f.path, // In web, path IS the relative path we use
                            type: f.type
                        }));
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
            // Ideally we insert into a proper tree. For now just push to list.
            // Check existence
            if (!files.value.find(f => f.path === relativePath)) {
                files.value.push(node);
            }
        } else if (event === 'unlink' || event === 'unlinkDir') {
            files.value = files.value.filter(f => f.path !== relativePath);
        }
    };

    const currentPath = ref<string>('');

    // Computed: visibleFiles
    // We filter `files` to show only those in `currentPath`
    // We assume paths use '/' or '\' separators. We normalize to '/'.
    const visibleFiles = computed(() => {
        const normCurrent = normalizePath(currentPath.value);
        
        return files.value.filter(file => {
            const normPath = normalizePath(file.path);
            
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

            return true;
        });
    });

    const normalizePath = (p: string) => p.replace(/\\/g, '/');

    const changeDirectory = (path: string) => {
        currentPath.value = path;
    };

    const goUp = () => {
        if (!currentPath.value) return;
        const parts = normalizePath(currentPath.value).split('/');
        parts.pop();
        currentPath.value = parts.join('/');
    };

    return {
        files,
        currentPath,
        visibleFiles,
        initWatcher,
        changeDirectory,
        goUp
    };
});
