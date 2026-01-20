<template>
    <div class="file-tree-item select-none">
        
        <!-- FOLDER ROW -->
        <div 
            class="flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-bg-hover rounded text-xs transition-colors"
            :class="{'bg-bg-selection text-accent-color': isSelected}"
            :style="{ paddingLeft: (depth * 12 + 8) + 'px' }"
            @click.stop="onSelect"
            @dragover.prevent
            @drop.prevent="onDrop"
        >
            <!-- EXPAND/COLLAPSE ICON -->
            <div 
                class="w-4 h-4 flex items-center justify-center hover:text-text-primary text-text-secondary"
                @click.stop="onToggle"
            >
                <!-- Arrow Right (Collapsed) -->
                <svg v-if="!isExpanded && hasChildren" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                <!-- Arrow Down (Expanded) -->
                <svg v-else-if="isExpanded && hasChildren" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>

            <!-- FOLDER ICON -->
            <span class="text-accent-color opacity-80">
                <svg v-if="isExpanded" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            </span>

            <!-- NAME -->
            <span class="truncate">{{ node.name }}</span>
        </div>

        <!-- CHILDREN -->
        <div v-if="isExpanded">
             <FileTreeItem 
                v-for="child in sortedChildren" 
                :key="child.path" 
                :node="child" 
                :depth="depth + 1" 
            />
        </div>

    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAssetStore, type FileNode } from '../../../stores/useAssetStore';

const props = defineProps<{
    node: FileNode;
    depth: number;
}>();

const assetStore = useAssetStore();

// Is this folder expanded in the store?
const isExpanded = computed(() => assetStore.expandedFolders.has(props.node.path));

// Is this the currently selected folder in the main view?
const isSelected = computed(() => {
    // Normalize paths to avoid slash issues
    const current = assetStore.currentPath.replace(/\\/g, '/');
    const myPath = props.node.path.replace(/\\/g, '/');
    return current === myPath;
});

const hasChildren = computed(() => {
    return props.node.children && props.node.children.length > 0;
});

const sortedChildren = computed(() => {
    if (!props.node.children) return [];
    return [...props.node.children].sort((a, b) => a.name.localeCompare(b.name));
});

const onToggle = () => {
    assetStore.toggleFolder(props.node.path);
};

const onSelect = () => {
    assetStore.changeDirectory(props.node.path);
};

const onDrop = async () => {
    // Basic drop handling to move files into folders using sidebar (Bonus feature)
    // For now, reuse the exact logic from AssetsPanel but targeting this folder path.
    // ... Implementation deferred for simplicity in this task, but placeholder exists.
};

</script>

<style scoped>
/* Highlight when dragging over a folder in tree? */
</style>
