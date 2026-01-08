<script setup lang="ts">

const props = defineProps<{
    transform: { x: number; y: number; rotation: number; scale: { x: number; y: number } };
    revision?: number;
}>();

const emit = defineEmits<{
    (e: 'update', val: any): void;
}>();


const update = (key: string, val: number) => {
    emit('update', { key, val });
};
</script>

<template>
    <div class="flex flex-col space-y-2 select-none px-2 py-1">
        <!-- Position -->
        <div class="flex items-center">
             <div class="w-16 text-xs text-text-secondary">Position</div>
             <div class="flex-1 grid grid-cols-2 gap-1">
                <div class="flex items-center bg-bg-input border border-border rounded overflow-hidden group">
                    <div class="px-2 text-xs font-bold text-red-500 cursor-ew-resize border-r border-border hover:bg-bg-hover">X</div>
                    <input 
                        type="number" 
                        class="w-full bg-transparent text-xs p-1 px-2 outline-none text-text-primary"
                        v-model.number="transform.x"
                        @input="update('x', transform.x)"
                    />
                </div>
                <div class="flex items-center bg-bg-input border border-border rounded overflow-hidden group">
                    <div class="px-2 text-xs font-bold text-green-500 cursor-ns-resize border-r border-border hover:bg-bg-hover">Y</div>
                    <input 
                        type="number" 
                        class="w-full bg-transparent text-xs p-1 px-2 outline-none text-text-primary"
                        v-model.number="transform.y"
                        @input="update('y', transform.y)"
                    />
                </div>
            </div>
        </div>

        <!-- Rotation -->
         <div class="flex items-center">
             <div class="w-16 text-xs text-text-secondary">Rotation</div>
             <div class="flex-1">
                 <div class="flex items-center bg-bg-input border border-border rounded overflow-hidden group">
                    <div class="px-2 text-xs font-bold text-blue-400 cursor-ew-resize border-r border-border hover:bg-bg-hover">Z</div>
                    <input 
                        type="number" 
                        class="w-full bg-transparent text-xs p-1 px-2 outline-none text-text-primary"
                        :value="Math.round(transform.rotation * (180 / Math.PI) * 100) / 100"
                        @input="(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            transform.rotation = val * (Math.PI / 180);
                            update('rotation', transform.rotation);
                        }"
                    />
                </div>
             </div>
         </div>

        <!-- Scale -->
        <div class="flex items-center">
            <div class="w-16 text-xs text-text-secondary">Scale</div>
            <div class="flex-1 grid grid-cols-2 gap-1">
                <div class="flex items-center bg-bg-input border border-border rounded overflow-hidden group">
                    <div class="px-2 text-xs font-bold text-text-secondary border-r border-border hover:bg-bg-hover">X</div>
                    <input 
                        type="number" 
                        step="0.1"
                        class="w-full bg-transparent text-xs p-1 px-2 outline-none text-text-primary"
                        v-model.number="transform.scale.x"
                        @input="update('scale.x', transform.scale.x)"
                    />
                </div>
                <div class="flex items-center bg-bg-input border border-border rounded overflow-hidden group">
                    <div class="px-2 text-xs font-bold text-text-secondary border-r border-border hover:bg-bg-hover">Y</div>
                    <input 
                        type="number" 
                        step="0.1"
                        class="w-full bg-transparent text-xs p-1 px-2 outline-none text-text-primary"
                        v-model.number="transform.scale.y"
                        @input="update('scale.y', transform.scale.y)"
                    />
                </div>
            </div>
        </div>
    </div>
</template>
