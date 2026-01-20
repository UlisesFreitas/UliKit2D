<template>
    <div class="assets-header flex items-center p-2 bg-bg-header border-b border-border gap-2 text-xs">
        
        <!-- HISTORY NAV (Back/Forward - Optional, for now just Up) -->
        <button 
            @click="assetStore.goUp()" 
            :disabled="!assetStore.currentPath"
            class="p-1 rounded hover:bg-bg-hover text-text-secondary disabled:opacity-30 disabled:hover:bg-transparent"
            title="Go Parent Folder"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>

        <!-- BREADCRUMBS -->
        <div class="flex-1 flex items-center mx-2 overflow-hidden items-center">
             <div 
                class="breadcrumb-item hover:bg-bg-hover px-1 rounded cursor-pointer flex items-center"
                @click="assetStore.changeDirectory('')"
             >
                <span class="text-accent-color">Assets</span>
             </div>
             
             <template v-for="(part, index) in pathParts" :key="index">
                 <span class="text-text-disabled mx-0.5">/</span>
                 <div 
                    class="breadcrumb-item hover:bg-bg-hover px-1 rounded cursor-pointer truncate max-w-[100px]"
                    @click="navigateToIndex(index)"
                 >
                    {{ part }}
                 </div>
             </template>
        </div>

        <!-- SEARCH -->
        <div class="relative w-40 group">
             <span class="absolute left-2 top-1.5 text-text-disabled">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
             </span>
             <input 
                v-model="assetStore.searchQuery"
                type="text" 
                placeholder="Search..."
                class="w-full bg-bg-input border border-transparent focus:border-accent-color rounded pl-6 pr-2 py-0.5 text-xs text-text-primary focus:outline-none placeholder-text-disabled transition-all"
             />
        </div>

        <!-- SORT (Dropdown) -->
        <div class="relative">
            <button 
                class="p-1 rounded hover:bg-bg-hover text-text-secondary flex items-center gap-1"
                @click="toggleSort"
                title="Sort Order"
            >
                 <svg v-if="assetStore.sortOrder === 'asc'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                 <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
            </button>
        </div>

        <!-- ZOOM SLIDER -->
        <div class="flex items-center gap-1 border-l border-border pl-2">
            <input 
                type="range" 
                min="0" 
                max="3" 
                step="1"
                :value="assetStore.zoomLevel"
                @input="onZoomChange"
                class="w-16 h-1 bg-bg-input rounded appearance-none cursor-pointer zoom-slider"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAssetStore } from '../../../stores/useAssetStore';

const assetStore = useAssetStore();

const pathParts = computed(() => {
    if (!assetStore.currentPath) return [];
    return assetStore.currentPath.replace(/\\/g, '/').split('/');
});

const navigateToIndex = (index: number) => {
    const parts = pathParts.value;
    const newPath = parts.slice(0, index + 1).join('/');
    assetStore.changeDirectory(newPath);
};

const toggleSort = () => {
    assetStore.sortOrder = assetStore.sortOrder === 'asc' ? 'desc' : 'asc';
};

const onZoomChange = (e: Event) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    assetStore.setZoom(val);
};

</script>

<style scoped>
.zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-secondary);
  cursor: pointer;
  transition: background .15s ease-in-out;
}
.zoom-slider::-webkit-slider-thumb:hover {
  background: var(--accent-color);
}
</style>
