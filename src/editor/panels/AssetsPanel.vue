<template>
  <div class="assets-panel flex flex-col h-full bg-bg-base text-text-primary w-full">
    <!-- HEADER -->
    <AssetsHeader />

    <!-- SPLIT BODY -->
    <div class="flex-1 flex overflow-hidden">
        <!-- SIDEBAR -->
        <AssetsSidebar />
        
        <!-- CONTENT -->
        <AssetsContent />
    </div>
  </div>
</template>

<script setup lang="ts">
import AssetsHeader from './assets/AssetsHeader.vue';
import AssetsSidebar from './assets/AssetsSidebar.vue';
import AssetsContent from './assets/AssetsContent.vue';
import { onMounted } from 'vue';
import { useAssetStore } from '../../stores/useAssetStore';

const assetStore = useAssetStore();

onMounted(() => {
    assetStore.initWatcher();
});
</script>

<style scoped>
.assets-panel {
    width: 100%;
    height: 100%;
}
</style>
