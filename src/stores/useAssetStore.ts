import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
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
    const currentPath = ref<string>('assets'); 
    const zoomLevel = ref<number>(1); 
    const searchQuery = ref<string>('');
    const sortOrder = ref<'asc' | 'desc'>('asc');
    const expandedFolders = ref<Set<string>>(new Set());

    // --- Actions ---

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
                // Root Level: Expect 'assets' BUT HIDE IT if the user wants Master Folder behavior?
                // Actually, if we are at Root level (currentPath=''), we normally see 'assets'.
                // If we force currentPath='assets', we see children of assets.
                // The issue: "visibleFiles" implementation shows children of currentPath.
                // If currentPath is 'assets', we see arrows, board, etc. 
                // BUT we don't want to see 'assets' ITSELF inside 'assets' (which is impossible unless recursive).
                // If currentPath is empty, we see 'assets'.
                // If the user starts at 'assets', they see children.
                // WE JUST NEED TO ENSURE default 'currentPath' IS 'assets'.
                
                // However, just in case "assets" folder node leaked into the children list (self-reference?), prevent it.
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
    };

    const goUp = () => {
        if (!currentPath.value) return;
        const parts = normalizePath(currentPath.value).split('/');
        parts.pop();
        currentPath.value = parts.join('/');
        searchQuery.value = ''; 
    };

    return {
        files,
        currentPath,
        visibleFiles,
        zoomLevel,
        searchQuery,
        sortOrder,
        expandedFolders,
        refreshFromDatabase,
        loadAssets, // Deprecated stub
        changeDirectory,
        goUp,
        setZoom,
        toggleFolder
    };
});
