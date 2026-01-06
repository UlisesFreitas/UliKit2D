<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    script: { path: string; parameters?: Record<string, any> };
    index: number;
    entity: any; // Passed to emit updates/removals context
}>();

const emit = defineEmits(['update', 'remove']);

const scriptName = computed(() => {
    return props.script.path.split(/[\\/]/).pop() || 'Unknown Script';
});

const onParameterUpdate = () => {
    emit('update');
};

const onRemove = () => {
    emit('remove', props.index);
};
</script>

<template>
    <div class="rounded border border-border bg-bg-panel overflow-hidden mb-2">
        <!-- Header -->
        <div class="flex justify-between items-center bg-bg-header px-2 py-1 border-b border-border">
            <div class="flex items-center gap-2 font-bold text-sm">
                <span class="text-accent-color opacity-80">📜</span>
                <span>{{ scriptName }}</span>
            </div>
            <div class="flex items-center gap-1">
                <!-- Open Source (Placeholder) -->
                <!-- <button class="text-xs opacity-50 hover:opacity-100" title="Edit Script Source">📝</button> -->
                
                <button 
                    @click="onRemove"
                    class="text-xs text-text-secondary hover:text-red-500 w-5 h-5 flex items-center justify-center rounded hover:bg-bg-input transition-colors"
                    title="Remove Script"
                >
                    ✕
                </button>
            </div>
        </div>

        <!-- Body -->
        <div class="p-2 text-xs">
            <div class="flex flex-col gap-2">
                <!-- Source Path (Read Only) -->
                <div class="flex gap-2 items-center text-text-secondary opacity-60 mb-1">
                    <label class="w-20 truncate" title="Source Path">Source</label>
                    <div class="flex-1 truncate font-mono select-all bg-bg-base px-1 rounded border border-transparent hover:border-border">
                        {{ script.path }}
                    </div>
                </div>

                <!-- Parameters -->
                <div v-if="script.parameters && Object.keys(script.parameters).length > 0">
                     <div v-for="(val, key) in script.parameters" :key="key" class="flex items-center gap-2">
                        <label class="w-24 truncate text-text-primary" :title="String(key)">{{ key }}</label>
                        
                        <!-- Value Input -->
                        <div class="flex-1">
                            <input 
                                v-if="typeof val === 'number'"
                                type="number" 
                                v-model.number="script.parameters[key]"
                                class="u-input w-full"
                                @input="onParameterUpdate"
                            >
                            <input 
                                v-else-if="typeof val === 'string'"
                                type="text" 
                                v-model="script.parameters[key]"
                                class="u-input w-full"
                                @input="onParameterUpdate"
                            >
                            <input 
                                v-else-if="typeof val === 'boolean'"
                                type="checkbox" 
                                v-model="script.parameters[key]"
                                @change="onParameterUpdate"
                                class="h-4 w-4 rounded border-border bg-bg-input text-accent-color focus:ring-offset-bg-base"
                            >
                        </div>
                     </div>
                </div>
                <div v-else class="text-text-secondary italic text-center py-1 opacity-50">
                    No parameters
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Inherit styles from global or parent */
</style>
