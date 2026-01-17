<script setup lang="ts">
const props = defineProps<{
    polygonCollider: {
        show: boolean;
        vertices: { x: number; y: number }[];
        frames?: Record<string, Record<number, { x: number, y: number }[]>>;
    } | undefined;
    
    // We keep this for now, even if unused by the simplified editor, 
    // to match the prop passed by InspectorPanel without error.
    animator?: any;

    revision?: number;
}>();

const emit = defineEmits(['update', 'open-modal']);

const onToggleShow = () => {
    if (props.polygonCollider) {
        props.polygonCollider.show = !props.polygonCollider.show;
        emit('update');
    }
};

const openEditor = () => {
    // No context needed anymore, the Modal handles it.
    emit('open-modal');
};
</script>

<template>
    <div class="rounded border border-border bg-bg-panel overflow-hidden mb-2">
        <div class="flex justify-between items-center bg-bg-header px-2 py-1 border-b border-border">
            <span class="font-bold text-sm">Polygon Collider</span>
            <button 
                v-if="polygonCollider" 
                @click="onToggleShow"
                class="text-xs px-1 rounded hover:bg-bg-hover"
                :class="polygonCollider.show ? 'text-primary' : 'text-text-muted'"
                title="Toggle Debug View"
            >
                👁️
            </button>
        </div>
        
        <div class="p-2 flex flex-col gap-2">
             <div v-if="polygonCollider" class="text-xs text-text-secondary flex justify-between items-center">
                <span>{{ polygonCollider.vertices.length }} Vertices (Global)</span>
             </div>
             
             <button 
                @click="openEditor"
                class="u-button w-full py-1 text-xs flex justify-center items-center gap-2"
             >
                <span>✏️</span>
                <span>Edit Collision Mask</span>
             </button>
        </div>
    </div>
</template>
