<script setup lang="ts">
const props = defineProps<{
    label: {
        text: string;
        fontSize: number;
        fontFamily: string;
        color: string;
        align: 'left' | 'center' | 'right';
    };
    revision?: number;
}>();

const emit = defineEmits(['update']);

const update = () => {
    emit('update');
};
</script>

<template>
    <div class="flex flex-col gap-2 text-xs">
        <!-- Text Content -->
        <textarea 
            v-model="label.text"
            @input="update"
            class="u-input w-full h-16 resize-none"
            placeholder="Enter text..."
        ></textarea>

        <div class="grid grid-cols-2 gap-2">
            <!-- Font Size -->
            <div class="flex items-center space-x-2">
                <label class="text-text-secondary w-10">Size</label>
                <input 
                    type="number" 
                    v-model.number="label.fontSize"
                    @input="update"
                    min="8"
                    step="1"
                    class="u-input flex-1 min-w-0"
                />
            </div>

            <!-- Color -->
            <div class="flex items-center space-x-2">
                <label class="text-text-secondary w-10">Color</label>
                <div class="flex-1 flex items-center space-x-1">
                     <input 
                        type="color" 
                        v-model="label.color"
                        @input="update"
                        class="h-6 w-6 border-none bg-transparent cursor-pointer"
                    />
                    <span class="text-xs font-mono text-text-secondary">{{ label.color }}</span>
                </div>
            </div>
        </div>

        <!-- Font Family -->
        <div class="flex items-center space-x-2">
            <label class="text-text-secondary w-10">Font</label>
            <select 
                v-model="label.fontFamily" 
                @change="update"
                class="u-input flex-1"
            >
                <option value="Arial">Arial</option>
                <option value="Verdana">Verdana</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Georgia">Georgia</option>
                <option value="Impact">Impact</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
            </select>
        </div>

        <!-- Align -->
        <div class="flex items-center space-x-2">
            <label class="text-text-secondary w-10">Align</label>
            <div class="flex bg-bg-input rounded border border-border overflow-hidden">
                <button 
                    class="px-2 py-1 hover:bg-bg-hover transition-colors" 
                    :class="label.align === 'left' ? 'bg-accent-color text-white' : 'text-text-secondary'"
                    @click="label.align = 'left'; update()"
                    title="Left"
                >
                    ⬅
                </button>
                <button 
                     class="px-2 py-1 hover:bg-bg-hover transition-colors border-l border-r border-border"
                    :class="label.align === 'center' ? 'bg-accent-color text-white' : 'text-text-secondary'"
                    @click="label.align = 'center'; update()"
                    title="Center"
                >
                    ⬇
                </button>
                <button 
                     class="px-2 py-1 hover:bg-bg-hover transition-colors"
                    :class="label.align === 'right' ? 'bg-accent-color text-white' : 'text-text-secondary'"
                    @click="label.align = 'right'; update()"
                    title="Right"
                >
                    ➡
                </button>
            </div>
        </div>
    </div>
</template>
