<script setup lang="ts">

const props = defineProps<{
    camera: {
        zoom: number;
        isPrimary: boolean;
        backgroundColor?: string;
    };
}>();

const emit = defineEmits(['update']);

const onUpdate = () => {
    emit('update');
};
</script>

<template>
    <div class="flex flex-col gap-2 px-2 py-1 select-none">
        <!-- Is Primary -->
        <div class="flex items-center">
            <div class="w-24 text-xs font-bold text-text-secondary">Is Primary</div>
            <div class="flex-1 flex justify-start">
                 <input 
                    type="checkbox" 
                    v-model="camera.isPrimary" 
                    @change="onUpdate"
                    class="h-4 w-4 rounded border-border bg-bg-input text-accent-color focus:ring-offset-bg-base"
                />
            </div>
        </div>

        <!-- Zoom -->
        <div class="flex items-center">
            <div class="w-24 text-xs font-bold text-text-secondary">Zoom</div>
            <div class="flex-1 flex gap-2 items-center">
                <input 
                    type="range" 
                    v-model.number="camera.zoom" 
                    min="0.1" 
                    max="5" 
                    step="0.1"
                    @input="onUpdate"
                    class="flex-1"
                />
                <input 
                    type="number" 
                    v-model.number="camera.zoom" 
                    step="0.1"
                    @input="onUpdate"
                    class="u-input w-12 text-center bg-bg-input border border-border rounded text-xs p-1 text-text-primary outline-none"
                />
            </div>
        </div>

        <!-- Background Color -->
        <div class="flex items-center">
             <div class="w-24 text-xs font-bold text-text-secondary">Background</div>
             <div class="flex-1">
                 <input 
                    type="color" 
                    class="u-input h-6 w-full p-0 border border-border rounded cursor-pointer bg-transparent" 
                    :value="camera.backgroundColor || '#000000'"
                    @input="(e: any) => { camera.backgroundColor = e.target.value; onUpdate(); }"
                 />
             </div>
        </div>
    </div>
</template>
