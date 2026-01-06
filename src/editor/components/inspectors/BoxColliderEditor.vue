<script setup lang="ts">
const props = defineProps<{
    collider: {
        width: number;
        height: number;
    };
}>();

const emit = defineEmits(['update']);

const update = () => {
    emit('update');
};
</script>

<template>
    <div class="grid grid-cols-2 gap-2 text-xs">
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
</template>
