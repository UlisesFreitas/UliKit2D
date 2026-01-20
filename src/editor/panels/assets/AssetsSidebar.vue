<template>
    <div class="assets-sidebar h-full overflow-y-auto bg-bg-panel border-r border-border min-w-[200px] w-[200px] flex flex-col">
        <!-- Tree Root -->
        <div class="p-1">
             <FileTreeItem 
                v-for="node in treeData" 
                :key="node.path" 
                :node="node" 
                :depth="0" 
            />
        </div>
    </div>
    
    <!-- Resize Handle (Optional later) -->
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAssetStore, type FileNode } from '../../../stores/useAssetStore';
import FileTreeItem from './FileTreeItem.vue';

const assetStore = useAssetStore();

// Build Tree from Flat List of DIRECTORIES
const treeData = computed(() => {
    const directories = assetStore.files.filter(f => f.type === 'directory');
    
    // Map path -> Node
    const nodeMap = new Map<string, FileNode>();
    const roots: FileNode[] = [];

    // 1. Create Nodes
    directories.forEach(dir => {
        // Clone to avoid mutating store state directly if it were deep
        const node: FileNode = { ...dir, children: [] };
        nodeMap.set(dir.path.replace(/\\/g, '/'), node);
    });

    // 2. Build Hierarchy
    directories.forEach(dir => {
        const path = dir.path.replace(/\\/g, '/');
        const node = nodeMap.get(path);
        if (!node) return;

        // Find parent path
        // assets/foo/bar -> parent: assets/foo
        const parts = path.split('/');
        if (parts.length > 1) {
            parts.pop(); // Remove self
            const parentPath = parts.join('/');
            
            // If parent exists in our directory list, add to it
            // If parent implies a folder that doesn't exist in 'files' (e.g. implicitly created?), we skip or auto-create? 
            // Chokidar should report all dirs.
            const parent = nodeMap.get(parentPath);
            if (parent) {
                if (!parent.children) parent.children = [];
                parent.children.push(node);
            } else {
                // Orphan or Root (relative to what we know)
                // If it starts with 'assets' and 'assets' isn't in the list? 
                // Usually 'assets' is the root folder.
                roots.push(node);
            }
        } else {
            // It's a top-level folder (e.g. 'assets')
            roots.push(node);
        }
    });

    // Sort Roots
    roots.sort((a, b) => a.name.localeCompare(b.name));
    return roots;
});

</script>

<style scoped>
/* Scrollbar styling could be added here if not global */
</style>
