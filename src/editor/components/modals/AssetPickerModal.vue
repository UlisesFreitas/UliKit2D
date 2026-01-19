<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAssetStore } from '../../../stores/useAssetStore';
import { getFileSystem } from '../../../api/FileSystem';
import { projectState } from '../../managers/ProjectManager';

const props = defineProps<{
    isOpen: boolean;
    type: 'image' | 'script' | 'font' | 'audio' | 'all';
    multiSelect?: boolean;
    onSelect: (path: string | string[]) => void;
    onClose: () => void;
}>();

const assetStore = useAssetStore();
const searchQuery = ref('');
const thumbnails = ref<Record<string, string>>({});
const selectedAssets = ref<Set<string>>(new Set());

// Reset selection when modal opens
watch(() => props.isOpen, (val) => {
    if (val) {
        selectedAssets.value.clear();
    }
});

const filteredAssets = computed(() => {
    // 1. Filter by Type
    let result = assetStore.files.filter(f => f.type === 'file');

    if (props.type === 'image') {
        const imageExts = ['.png', '.jpg', '.jpeg', '.svg', '.gif'];
        result = result.filter(f => imageExts.some(ext => f.name.toLowerCase().endsWith(ext)));
    } else if (props.type === 'script') {
        const scriptExts = ['.js', '.ts'];
        result = result.filter(f => scriptExts.some(ext => f.name.toLowerCase().endsWith(ext)));
    } else if (props.type === 'font') {
        const fontExts = ['.fnt', '.xml'];
        result = result.filter(f => fontExts.some(ext => f.name.toLowerCase().endsWith(ext)));
    } else if (props.type === 'audio') {
        const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
        result = result.filter(f => audioExts.some(ext => f.name.toLowerCase().endsWith(ext)));
    }

    // 2. Filter by Search
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
    }

    return result;
});

const loadThumbnails = async () => {
    const fs = getFileSystem();
    const assets = filteredAssets.value;
    
    for (const asset of assets) {
        if (asset.type === 'file' && 
           (asset.name.endsWith('.png') || asset.name.endsWith('.jpg') || asset.name.endsWith('.jpeg') || asset.name.endsWith('.svg'))) {
            
            // Only load if not already loaded to prevent flickering/perf issues
            if (!thumbnails.value[asset.path]) {
                try {
                    thumbnails.value[asset.path] = await fs.getAssetURL(asset.path);
                } catch (err) {
                    console.error('Failed to load thumbnail for', asset.path, err);
                }
            }
        }
    }
};

watch(filteredAssets, () => {
    loadThumbnails();
}, { immediate: true });

const selectAsset = (asset: any) => {
    if (props.multiSelect) {
        if (selectedAssets.value.has(asset.path)) {
            selectedAssets.value.delete(asset.path);
        } else {
            selectedAssets.value.add(asset.path);
        }
    } else {
        props.onSelect(asset.path);
        props.onClose();
    }
};

const confirmSelection = () => {
    props.onSelect(Array.from(selectedAssets.value));
    props.onClose();
};

const importAssets = async () => {
    console.log('[AssetPicker] Import blocked? Checking project state...');
    if (!projectState.currentProjectPath) {
        console.error('[AssetPicker] No project path found!');
        // alert("No project open. Please open a project first.");
        // Use unified Toast
        const { useUIStore } = await import('../../../stores/useUIStore'); // Lazy import to avoid circ dep if any (though store is safe)
        const ui = useUIStore();
        ui.showToast({
            title: 'Error',
            description: 'No project open. Please open a project first.',
            type: 'error'
        });
        return;
    }

    const fs = getFileSystem();
    const destDir = `${projectState.currentProjectPath}/assets`;
    console.log('[AssetPicker] Importing to:', destDir);
    
    // We assume 'assets' exists. If not, writeFile/importFile usually handles it or we fail gracefully.

    if (fs.isElectron) {
        console.log('[AssetPicker] Running in Electron mode');
        const result = await (window as any).electronAPI.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'] },
                { name: 'Scripts', extensions: ['js', 'ts'] },
                { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            for (const filePath of result.filePaths) {
                // ElectronFileSystem's importFile handles copying
                await fs.importFile(filePath, destDir);
            }
            // Watcher should trigger update automatically
        }
    } else {
        console.log('[AssetPicker] Running in Web mode');
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.png,.jpg,.jpeg,.webp,.svg,.gif,.js,.ts,.mp3,.wav,.ogg,.m4a,.aac,.flac';
        
        input.onchange = async (e: any) => {
            const files = e.target.files;
            console.log('[AssetPicker] Files selected:', files);
            if (files && files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    // On Web, destDir is effectively 'MyWebProject/assets'
                    // writeFile expects relative path from root? 
                    // FileSystem.ts: Path: Absolute path or relative path from project root
                    // WebFileSystem.writeFile implementation: `/${this.currentProject}/${path}`
                    // So we should pass 'assets/filename.png'
                    
                    const fileName = file.name;
                    const relativePath = `assets/${fileName}`;
                    console.log('[AssetPicker] Writing to relative path:', relativePath);
                    await fs.writeFile(relativePath, file);
                }
                // Watcher should trigger
            }
        };
        input.click();
    }
};

</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-70" @click.self="onClose">
      <div class="bg-bg-panel border border-border rounded-lg shadow-2xl w-[600px] h-[500px] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="p-3 border-b border-border bg-bg-header flex justify-between items-center">
              <span class="font-bold text-text-primary">Select Asset</span>
              <button @click="onClose" class="text-text-secondary hover:text-red-500">✕</button>
          </div>

          <!-- Toolbar -->
          <div class="p-2 border-b border-border flex gap-2">
              <input 
                  v-model="searchQuery" 
                  class="u-input flex-1" 
                  placeholder="Search assets..." 
                  autofocus
              />
              <button 
                  @click="importAssets" 
                  class="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-text-accent text-xs rounded hover:bg-primary-hover flex items-center gap-1"
                  title="Import external files to assets folder"
              >
                Import
              </button>
          </div>

          <!-- Grid -->
          <div class="flex-1 overflow-y-auto p-2 bg-bg-base">
              <div v-if="filteredAssets.length === 0" class="text-center text-text-secondary mt-10 italic">
                  No assets found.
              </div>
              <div class="grid grid-cols-4 gap-2">
                  <div 
                      v-for="asset in filteredAssets" 
                      :key="asset.path"
                      @click="selectAsset(asset)"
                      class="group cursor-pointer flex flex-col items-center p-2 rounded hover:bg-bg-selection border transition-all"
                      :class="selectedAssets.has(asset.path) ? 'border-accent-color bg-bg-selection' : 'border-transparent'"
                  >
                      <!-- Thumbnail -->
                      <div class="w-16 h-16 bg-checkerboard rounded overflow-hidden flex items-center justify-center mb-1 bg-bg-input relative">
                          <img 
                              v-if="type === 'image' || asset.name.endsWith('.png') || asset.name.endsWith('.jpg')"
                              :src="thumbnails[asset.path]" 
                              class="w-full h-full object-contain"
                              style="image-rendering: pixelated"
                          />
                           <span v-else-if="asset.name.endsWith('.mp3') || asset.name.endsWith('.wav') || asset.name.endsWith('.ogg')" class="text-2xl opacity-80">🎵</span>
                           <span v-else class="text-2xl opacity-50">📄</span>
                           
                           <!-- Checkmark overlay -->
                           <div v-if="selectedAssets.has(asset.path)" class="absolute inset-0 bg-accent-color/30 flex items-center justify-center">
                                <span class="text-xl font-bold text-text-accent drop-shadow-md">✓</span>
                           </div>
                      </div>
                      <span class="text-xs text-text-primary text-center truncate w-full px-1 group-hover:text-text-accent">{{ asset.name }}</span>
                  </div>
              </div>
          </div>
          
           <!-- Footer -->
          <div class="p-2 border-t border-border bg-bg-header flex justify-between items-center text-xs text-text-secondary">
              <span>{{ filteredAssets.length }} assets</span>
              <div class="flex items-center gap-2">
                 <span v-if="multiSelect && selectedAssets.size > 0" class="text-accent-color font-bold">{{ selectedAssets.size }} selected</span>
                 <button 
                    v-if="multiSelect" 
                    @click="confirmSelection"
                    class="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-text-accent rounded hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="selectedAssets.size === 0"
                 >
                    Confirm
                 </button>
              </div>
          </div>
      </div>
  </div>
</template>

<style scoped>
.bg-checkerboard {
    background-image:
      linear-gradient(45deg, #1e1e1e 25%, transparent 25%),
      linear-gradient(-45deg, #1e1e1e 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #1e1e1e 75%),
      linear-gradient(-45deg, transparent 75%, #1e1e1e 75%);
    background-size: 10px 10px;
    background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
    background-color: #252526;
}
</style>
