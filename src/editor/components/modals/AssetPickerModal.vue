<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAssetStore } from '../../../stores/useAssetStore';
import { getFileSystem } from '../../../api/FileSystem';

const props = defineProps<{
    isOpen: boolean;
    type: 'image' | 'script' | 'all';
    onSelect: (path: string) => void;
    onClose: () => void;
}>();

const assetStore = useAssetStore();
const searchQuery = ref('');
const thumbnails = ref<Record<string, string>>({});

const filteredAssets = computed(() => {
    // 1. Filter by Type
    let result = assetStore.files.filter(f => f.type === 'file');

    if (props.type === 'image') {
        const imageExts = ['.png', '.jpg', '.jpeg', '.svg', '.gif'];
        result = result.filter(f => imageExts.some(ext => f.name.toLowerCase().endsWith(ext)));
    } else if (props.type === 'script') {
        const scriptExts = ['.js', '.ts'];
        result = result.filter(f => scriptExts.some(ext => f.name.toLowerCase().endsWith(ext)));
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
    props.onSelect(asset.path);
    props.onClose();
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
                      class="group cursor-pointer flex flex-col items-center p-2 rounded hover:bg-bg-selection border border-transparent hover:border-accent-color transition-all"
                  >
                      <!-- Thumbnail -->
                      <div class="w-16 h-16 bg-checkerboard rounded overflow-hidden flex items-center justify-center mb-1 bg-gray-800">
                          <img 
                              v-if="type === 'image' || asset.name.endsWith('.png') || asset.name.endsWith('.jpg')"
                              :src="thumbnails[asset.path]" 
                              class="w-full h-full object-contain"
                          />
                           <span v-else class="text-2xl opacity-50">📄</span>
                      </div>
                      <span class="text-xs text-text-primary text-center truncate w-full px-1 group-hover:text-text-accent">{{ asset.name }}</span>
                  </div>
              </div>
          </div>
          
           <!-- Footer -->
          <div class="p-2 border-t border-border bg-bg-header flex justify-end text-xs text-text-secondary">
              {{ filteredAssets.length }} assets
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
