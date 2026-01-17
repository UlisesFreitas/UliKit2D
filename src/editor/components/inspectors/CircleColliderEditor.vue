<script setup lang="ts">
const props = defineProps<{
    circleCollider: { 
        radius: number;
        show?: boolean;
    };
    revision?: number;
}>();

const emit = defineEmits(['update']);

const onUpdate = () => {
    emit('update');
};

const onToggleShow = () => {
    const current = props.circleCollider.show !== false;
    props.circleCollider.show = !current;
    emit('update');
};
</script>

<template>
    <div class="rounded border border-border bg-bg-panel overflow-hidden mb-2">
        <div class="flex justify-between items-center bg-bg-header px-2 py-1 border-b border-border">
            <span class="font-bold text-sm">Circle Collider</span>
             <!-- Show/Hide Debug Toggle -->
             <button 
                @click="onToggleShow"
                class="text-xs px-1 rounded hover:bg-bg-hover"
                :class="circleCollider.show !== false ? 'text-primary' : 'text-text-muted'"
                title="Toggle Debug View"
            >
                👁️
            </button>
        </div>
        
        <div class="p-2 text-xs flex flex-col gap-2">
             <div class="flex items-center gap-2">
                <label class="w-16">Radius</label>
                <input 
                    type="number" 
                    v-model.number="circleCollider.radius" 
                    class="u-input flex-1"
                    @input="onUpdate"
                >
             </div>
        </div>
    </div>
</template>
