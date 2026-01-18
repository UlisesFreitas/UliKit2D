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
    <div class="file-grid flex-1 overflow-y-auto p-2 align-content-start" @click.self="closeContextMenu">
        <div 
            v-for="file in assetStore.visibleFiles" 
            :key="file.path" 
            class="file-item"
            :class="{'is-folder': file.type === 'directory'}"
            draggable="true"
            @dragstart="onDragStart($event, file)"
            @dblclick="onDoubleClick(file)"
            @contextmenu="showContextMenu($event, file)"
        >
            <div class="icon text-3xl mb-1 w-full h-10 flex items-center justify-center overflow-hidden">
                <img v-if="thumbnails[file.path]" :src="thumbnails[file.path]" class="w-full h-full object-contain" />
                <span v-else>{{ file.type === 'directory' ? '📁' : isImage(file.name) ? '🖼️' : '📄' }}</span>
            </div>
            <div class="name leading-tight">{{ file.name }}</div>
        </div>
        
        <!-- Empty State -->
        <div v-if="assetStore.visibleFiles.length === 0" class="w-full text-center text-text-secondary mt-10">
            Empty Folder
        </div>

        <!-- Custom Context Menu -->
        <div v-if="menuState.visible" 
             class="fixed bg-bg-panel border border-border shadow-lg rounded z-[9999] py-1 min-w-[140px]"
             :style="{ top: menuState.y + 'px', left: menuState.x + 'px' }">
             <div class="px-3 py-1 text-[10px] font-bold text-text-secondary truncate max-w-[200px]">{{ menuState.file?.name }}</div>
             <div class="h-[1px] bg-border my-1"></div>
            <button 
                v-if="menuState.file?.path !== 'assets'"
                @click="deleteAsset" 
                class="w-full text-left px-3 py-1.5 hover:bg-red-900 hover:text-white text-xs text-red-400"
            >
                Delete
            </button>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useAssetStore } from '../../stores/useAssetStore';
import { projectState } from '../managers/ProjectManager';
import { getFileSystem } from '../../api/FileSystem';
import { useUIStore } from '../../stores/useUIStore';

const assetStore = useAssetStore();
const ui = useUIStore();
const thumbnails = ref<Record<string, string>>({});

// Context Menu State
const menuState = ref({
    visible: false,
    x: 0,
    y: 0,
    file: null as any
});

onMounted(() => {
    assetStore.initWatcher();
    loadThumbnails();
    
    // Global click listener to close context menu
    window.addEventListener('click', closeContextMenu);
});

// Clean up listener
import { onUnmounted } from 'vue';
onUnmounted(() => {
    window.removeEventListener('click', closeContextMenu);
});

const closeContextMenu = () => {
    menuState.value.visible = false;
};

const showContextMenu = (e: MouseEvent, file: any) => {
    e.preventDefault(); // Prevent native browser menu
    menuState.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        file: file
    };
};

const deleteAsset = async () => {
    const file = menuState.value.file;
    if (!file) return;
    
    // Close menu
    closeContextMenu();

    // PROTECTED: Do not allow deleting the 'assets' folder
    if (file.name === 'assets' && file.path === 'assets') {
        ui.showToast({ title: 'Protected', description: 'The assets folder cannot be deleted.', type: 'warning' });
        return;
    }

    if (await ui.confirm({
        title: 'Delete Asset',
        message: `Are you sure you want to delete '${file.name}'? This cannot be undone.`,
        confirmText: 'Delete',
        isDanger: true
    })) {
        const fs = getFileSystem();
        const success = await fs.deleteFile(file.path);
        if (!success) {
            ui.showToast({ title: 'Error', description: 'Failed to delete file', type: 'error' });
        } else {
             ui.showToast({ title: 'Deleted', description: `Deleted ${file.name}`, type: 'success' });
        }
    }
};

// ... existing code ...

const isImage = (filename: string) => {
    return /\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(filename);
};

const loadThumbnails = async () => {
    const fs = getFileSystem();
    for (const file of assetStore.visibleFiles) {
        if (file.type === 'file' && isImage(file.name)) {
            // Check if we already have it to avoid flicker/re-fetch (though FS might cache)
            if (!thumbnails.value[file.path]) {
                const url = await fs.getAssetURL(file.path);
                thumbnails.value[file.path] = url;
            }
        }
    }
};

watch(() => assetStore.visibleFiles, () => {
    loadThumbnails();
}, { deep: true });

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
  position: relative; /* For context menu context */
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
    user-select: none;
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
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>
