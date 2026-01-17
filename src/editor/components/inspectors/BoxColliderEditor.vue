<script setup lang="ts">
const props = defineProps<{
    collider: {
        width: number;
        height: number;
        show?: boolean;
    };
    revision?: number;
}>();

const emit = defineEmits(['update']);

const update = () => {
    emit('update');
};

const onToggleShow = () => {
    // Default to true if undefined, so if it's undefined, we toggle to false
    const current = props.collider.show !== false;
    props.collider.show = !current;
    emit('update');
};
</script>

<template>
    <div class="rounded border border-border bg-bg-panel overflow-hidden mb-2">
        <div class="flex justify-between items-center bg-bg-header px-2 py-1 border-b border-border">
            <span class="font-bold text-sm">Box Collider</span>
             <!-- Show/Hide Debug Toggle -->
             <button 
                @click="onToggleShow"
                class="text-xs px-1 rounded hover:bg-bg-hover"
                :class="collider.show !== false ? 'text-primary' : 'text-text-muted'"
                title="Toggle Debug View"
            >
                👁️
            </button>
        </div>

        <div class="p-2 grid grid-cols-2 gap-2 text-xs">
            <!-- Width -->
            <div class="flex items-center space-x-2">
                 <label class="text-text-secondary w-10">Width</label>
                 <input 
                    type="number" 
                    v-model.number="collider.width"
                    @input="update"
                    step="10"
                    class="u-input flex-1 min-w-0"
                 />
            </div>

            <!-- Height -->
            <div class="flex items-center space-x-2">
                 <label class="text-text-secondary w-10">Height</label>
                 <input 
                    type="number" 
                    v-model.number="collider.height"
                    @input="update"
                    step="10"
                    class="u-input flex-1 min-w-0"
                 />
            </div>
        </div>
    </div>
</template>
