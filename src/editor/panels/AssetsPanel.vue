<template>
  <div class="assets-panel w-full h-full bg-bg-base text-text-primary flex flex-col" @dragover.prevent @drop.prevent="onDrop">
    <!-- Header / Navigation -->
    <div class="header flex items-center space-x-2 px-2 py-1 bg-bg-panel border-b border-border">
        <button 
            @click="assetStore.goUp()" 
            :disabled="!assetStore.currentPath"
            class="disabled:opacity-30 hover:text-accent-color"
            title="Go Parent"
        >
            ⬆
        </button>
        <div class="text-xs text-text-secondary flex-1 ml-2 truncate">
            {{ assetStore.currentPath || 'Root' }}
        </div>
        <button 
             @click="openInExplorer"
             class="hover:text-accent-color text-xs px-2 py-1 bg-bg-input rounded"
             title="Open Folder"
        >
            📂
        </button>
    </div>

    <!-- File Grid -->
    <div class="file-grid flex-1 overflow-y-auto p-2 align-content-start">
        <div 
            v-for="file in assetStore.visibleFiles" 
            :key="file.path" 
            class="file-item"
            :class="{'is-folder': file.type === 'directory'}"
            draggable="true"
            @dragstart="onDragStart($event, file)"
            @dblclick="onDoubleClick(file)"
        >
            <div class="icon text-3xl mb-1">
                {{ file.type === 'directory' ? '📁' : file.name.endsWith('.png') ? '🖼️' : '📄' }}
            </div>
            <div class="name leading-tight">{{ file.name }}</div>
        </div>
        
        <!-- Empty State -->
        <div v-if="assetStore.visibleFiles.length === 0" class="w-full text-center text-text-secondary mt-10">
            Empty Folder
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAssetStore } from '../../stores/useAssetStore';
import { projectState } from '../managers/ProjectManager';
import { getFileSystem } from '../../api/FileSystem';

const assetStore = useAssetStore();

onMounted(() => {
    assetStore.initWatcher();
});

const onDragStart = (e: DragEvent, file: any) => {
    if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', file.path);
        e.dataTransfer.effectAllowed = 'copy';
    }
};

const openInExplorer = async () => {
    const fs = getFileSystem();
    if (assetStore.currentPath) {
        if (projectState.currentProjectPath) {
             const fullPath = `${projectState.currentProjectPath}/${assetStore.currentPath}`;
             await fs.showItemInFolder(fullPath);
        }
    } else if (projectState.currentProjectPath) {
         await fs.showItemInFolder(projectState.currentProjectPath as any);
    }
};

const onDoubleClick = (file: any) => {
    if (file.type === 'directory') {
        assetStore.changeDirectory(file.path);
    } else {
        console.log('Open File:', file.path);
    }
};

const onDrop = async (e: DragEvent) => {
    console.log('Drop event triggered');
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    if (!projectState.currentProjectPath) return;

    const fs = getFileSystem();
    const currentRelPath = assetStore.currentPath || '';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const destPath = currentRelPath ? `${currentRelPath}/${file.name}` : file.name;
        
        if (fs.isElectron) {
            const sourcePath = fs.getPathForFile(file);
            if (sourcePath) {
                // In Electron, we use the optimized importFile (copies via shell)
                // We need the full destination folder path
                const destFolder = projectState.currentProjectPath as string;
                const finalDestFolder = currentRelPath ? `${destFolder}/${currentRelPath}` : destFolder;
                await fs.importFile(sourcePath, finalDestFolder);
            }
        } else {
            // In Web, we just write the Blob content
            await fs.writeFile(destPath, file);
        }
    }
};
</script>

<style scoped>
.assets-panel {
  width: 100%;
  height: 100%;
  background-color: var(--bg-base);
  overflow-y: auto;
  color: var(--text-primary);
}
.header {
    padding: 5px 10px;
    background: var(--bg-panel);
    font-weight: bold;
    border-bottom: 1px solid var(--border-color);
}
.file-grid {
    display: flex;
    flex-wrap: wrap;
    padding: 10px;
    gap: 10px;
}
.file-item {
    width: 90px;
    height: 90px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 8px;
    cursor: pointer;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-primary);
}
.file-item:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-color);
}
.file-item.is-folder {
    color: var(--accent-color); /* Use accent for folders */
}
.file-item.is-folder .name {
    color: var(--text-primary);
}
.name {
    font-size: 11px;
    text-align: center;
    word-break: break-all;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>
