import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useStorage } from '@vueuse/core';
import { AssetDatabase } from '../editor/managers/AssetDatabase';

export interface FileNode {
    name: string;
    path: string; // Relative path (e.g. assets/foo.png)
    fullPath: string; // Same as path for web, or absolute for local
    type: 'file' | 'directory';
    children?: FileNode[];
}

export const useAssetStore = defineStore('assets', () => {
    // Flat list of all known files/folders (Derived from DB + inferred folders)
    const files = ref<FileNode[]>([]);
    
    // Default to 'assets' folder so user starts inside the Master Folder
    // PERSISTED SETTINGS
    const currentPath = useStorage<string>('assets-current-path', 'assets'); 
    const zoomLevel = useStorage<number>('assets-zoom-level', 1); 
    const searchQuery = ref<string>('');
    const sortOrder = useStorage<'asc' | 'desc'>('assets-sort-order', 'asc');
    const expandedFolders = ref<Set<string>>(new Set());
    
    // Selection State
    const selectedPaths = ref<Set<string>>(new Set());
    const lastSelectedPath = ref<string | null>(null);

    // --- Actions ---

    const clearSelection = () => {
        selectedPaths.value.clear();
        lastSelectedPath.value = null;
    };

    const select = (path: string, exclusive = true) => {
        if (exclusive) selectedPaths.value.clear();
        selectedPaths.value.add(path);
        lastSelectedPath.value = path;
    };

    const toggleSelection = (path: string) => {
        if (selectedPaths.value.has(path)) {
            selectedPaths.value.delete(path);
            if (lastSelectedPath.value === path) lastSelectedPath.value = null;
        } else {
            selectedPaths.value.add(path);
            lastSelectedPath.value = path;
        }
    };

    const selectRange = (toPath: string) => {
        if (!lastSelectedPath.value) {
            select(toPath);
            return;
        }

        const startIdx = visibleFiles.value.findIndex(f => f.path === lastSelectedPath.value);
        const endIdx = visibleFiles.value.findIndex(f => f.path === toPath);

        if (startIdx === -1 || endIdx === -1) {
            select(toPath);
            return;
        }

        const min = Math.min(startIdx, endIdx);
        const max = Math.max(startIdx, endIdx);

        // Don't clear existing if ctrl is held? Usually Shift+Click clears others unless mixed.
        // Standard behavior: Shift+Click extends selection from Anchor to Target, clearing others usually.
        // We will assume standard exclusive range select for now.
        selectedPaths.value.clear();
        
        for (let i = min; i <= max; i++) {
            const file = visibleFiles.value[i];
            if (file) selectedPaths.value.add(file.path);
        }
    };

    /**
     * Rebuilds the File Tree from the AssetDatabase.
     * This is the "Source of Truth" sync.
     */
    const refreshFromDatabase = async () => {
        try {
            const db = AssetDatabase.instance;
            const registry = db.exportRegistry();
            
            const newFiles = new Map<string, FileNode>();
            
            // 1. Process Files
            for (const entry of registry) {
                if (!entry || !entry.path) continue;
                const p = entry.path as string;
                
                const node: FileNode = {
                    name: p.split(/[\\/]/).pop() || '',
                    path: p.replace(/\\/g, '/'),
                    fullPath: p,
                    type: entry.type === 'directory' ? 'directory' : 'file'
                };
                newFiles.set(node.path, node);
                
                // 2. Infer Directories
                const parts = node.path.split('/');
                let currentDir = '';
                
                for (let i = 0; i < parts.length - 1; i++) {
                    const segment = parts[i] || '';
                    if (!segment) continue;
                    const dirPath: string = currentDir ? `${currentDir}/${segment}` : segment;
                    
                    if (!newFiles.has(dirPath)) {
                        newFiles.set(dirPath, {
                            name: segment,
                            path: dirPath,
                            fullPath: dirPath,
                            type: 'directory'
                        });
                    }
                    currentDir = dirPath;
                }
            }
            
            // Ensure implicit 'assets' folder if empty?
            if (newFiles.size === 0 || !newFiles.has('assets')) {
                 newFiles.set('assets', { name: 'assets', path: 'assets', fullPath: 'assets', type: 'directory' });
            }

            files.value = Array.from(newFiles.values());
            console.log(`[AssetStore] Refreshed from DB. Total Nodes: ${files.value.length}`);
            
            // Validate Selection
            // Remove selected paths that no longer exist
            const validPaths = new Set<string>();
            for (const p of selectedPaths.value) {
                if (newFiles.has(p)) validPaths.add(p);
            }
            selectedPaths.value = validPaths;

        } catch (e) {
            console.error('[AssetStore] Failed to refresh from DB:', e);
        }
    };
    
    // Stub for compatibility if needed, but we try to use refreshFromDatabase directly.
    const loadAssets = async (_path: any) => {
         console.warn('[AssetStore] loadAssets is deprecated. Using refreshFromDatabase.');
         await refreshFromDatabase();
    };

    // --- View Logic (Unchanged mostly) ---

    const toggleFolder = (path: string) => {
        if (expandedFolders.value.has(path)) expandedFolders.value.delete(path);
        else expandedFolders.value.add(path);
    }

    const setZoom = (level: number) => {
        zoomLevel.value = Math.max(0, Math.min(3, level));
    }

    const normalizePath = (p: string) => p.replace(/\\/g, '/');

    const visibleFiles = computed(() => {
        const normCurrent = normalizePath(currentPath.value);
        const query = searchQuery.value.toLowerCase().trim();
        
        // Dynamically filter the FLat List 'files' to show children of currentPath
        let result = files.value.filter(file => {
            const normPath = normalizePath(file.path);
            
            if (query) {
                return file.type === 'file' && file.name.toLowerCase().includes(query);
            }

            // Must be direct child
            if (normCurrent) {
                // Must start with parent + /
                if (!normPath.startsWith(normCurrent + '/')) return false;
                // Cut off parent
                const relative = normPath.slice(normCurrent.length + 1);
                // Must not have more slashes (immediate child)
                return !relative.includes('/');
            } else {
                // Root Level
                if (normPath === 'assets' && normCurrent === 'assets') return false; 
                return !normPath.includes('/');
            }
        });

        // Sort
        result.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        return result;
    });

    const changeDirectory = (path: string) => {
        currentPath.value = path;
        searchQuery.value = '';
        expandedFolders.value.add(path);
        clearSelection(); // Clear selection on nav? Probably yes.
    };

    const goUp = () => {
        if (!currentPath.value) return;
        const parts = normalizePath(currentPath.value).split('/');
        parts.pop();
        currentPath.value = parts.join('/');
        searchQuery.value = ''; 
        clearSelection();
    };

    return {
        files,
        currentPath,
        visibleFiles,
        zoomLevel,
        searchQuery,
        sortOrder,
        expandedFolders,
        // Selection
        selectedPaths,
        lastSelectedPath,
        select,
        toggleSelection,
        clearSelection,
        selectRange,
        
        refreshFromDatabase,
        loadAssets, // Deprecated stub
        changeDirectory,
        goUp,
        setZoom,
        toggleFolder
    };
});
