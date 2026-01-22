<script setup lang="ts">
import { instance as commandManager } from '../../commands/CommandManager';
import { TransformCommand } from '../../commands/TransformCommand';
import { ref } from 'vue';

const props = defineProps<{
    transform: { x: number; y: number; rotation: number; scale: { x: number; y: number }; zIndex?: number };
    entity?: any;
    revision?: number;
}>();

const emit = defineEmits<{
    (e: 'update', val: any): void;
}>();

const startState = ref<any>(null);

const handleFocus = () => {
    if (!props.transform) return;
    const t = props.transform;
    startState.value = {
        x: t.x,
        y: t.y,
        scaleX: t.scale.x,
        scaleY: t.scale.y,
        rotation: t.rotation
    };
};

const handleChange = () => {
    if (!startState.value || !props.entity || !props.transform) return;
    
    const t = props.transform;
    const newState = {
        x: t.x,
        y: t.y,
        scaleX: t.scale.x,
        scaleY: t.scale.y,
        rotation: t.rotation
    };
    
    // Check for difference
    const old = startState.value;
    if (Math.abs(newState.x - old.x) > 0.001 ||
        Math.abs(newState.y - old.y) > 0.001 ||
        Math.abs(newState.scaleX - old.scaleX) > 0.001 ||
        Math.abs(newState.scaleY - old.scaleY) > 0.001 ||
        Math.abs(newState.rotation - old.rotation) > 0.001) {
            
        // Create Command
        const cmd = new TransformCommand([
            {
                entityId: props.entity.id,
                oldState: old,
                newState: newState
            }
        ], 'Inspector Transform');
        
        commandManager.execute(cmd);
    }
    
    startState.value = null;
};

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
                <div class="flex items-center border border-border rounded overflow-hidden group focus-within:border-accent-color transition-colors">
                    <div class="px-2 text-xs font-bold text-red-500 cursor-ew-resize border-r border-border hover:bg-bg-hover">X</div>
                    <input 
                        type="number" 
                        class="w-full u-input bg-bg-input text-xs p-1 px-2 outline-none text-text-primary"
                        name="transform-x"
                        :value="transform.x"
                        @focus="handleFocus"
                        @change="handleChange"
                        @input="(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            transform.x = val;
                            update('x', val);
                        }"
                    />
                </div>
                <div class="flex items-center border border-border rounded overflow-hidden group focus-within:border-accent-color transition-colors">
                    <div class="px-2 text-xs font-bold text-green-500 cursor-ns-resize border-r border-border hover:bg-bg-hover">Y</div>
                    <input 
                        type="number" 
                        class="w-full u-input bg-bg-input text-xs p-1 px-2 outline-none text-text-primary"
                        name="transform-y"
                        :value="transform.y"
                        @focus="handleFocus"
                        @change="handleChange"
                        @input="(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            transform.y = val;
                            update('y', val);
                        }"
                    />
                </div>
            </div>
        </div>

        <!-- Rotation -->
         <div class="flex items-center">
             <div class="w-16 text-xs text-text-secondary">Rotation</div>
             <div class="flex-1">
                 <div class="flex items-center border border-border rounded overflow-hidden group focus-within:border-accent-color transition-colors">
                    <div class="px-2 text-xs font-bold text-blue-400 cursor-ew-resize border-r border-border hover:bg-bg-hover">Z</div>
                    <input 
                        type="number" 
                        class="w-full u-input bg-bg-input text-xs p-1 px-2 outline-none text-text-primary"
                        name="transform-rotation"
                        :value="Math.round(transform.rotation * (180 / Math.PI) * 100) / 100"
                        @focus="handleFocus"
                        @change="handleChange"
                        @input="(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            transform.rotation = val * (Math.PI / 180);
                            update('rotation', transform.rotation);
                        }"
                    />
                </div>
             </div>
         </div>

        <!-- Z-Index -->
         <div class="flex items-center">
             <div class="w-16 text-xs text-text-secondary">Layer</div>
             <div class="flex-1">
                 <div class="flex items-center border border-border rounded overflow-hidden group focus-within:border-accent-color transition-colors">
                    <div class="px-2 text-xs font-bold text-yellow-500 cursor-ew-resize border-r border-border hover:bg-bg-hover">#</div>
                    <input 
                        type="number" 
                        class="w-full u-input bg-bg-input text-xs p-1 px-2 outline-none text-text-primary"
                        name="transform-layer"
                        :value="transform.zIndex || 0"
                        @input="(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            transform.zIndex = val;
                            update('zIndex', val);
                        }"
                        placeholder="0"
                    />
                </div>
            </div>
        </div>

        <!-- Scale -->
        <div class="flex items-center">
            <div class="w-16 text-xs text-text-secondary">Scale</div>
            <div class="flex-1 grid grid-cols-2 gap-1">
                <div class="flex items-center border border-border rounded overflow-hidden group focus-within:border-accent-color transition-colors">
                    <div class="px-2 text-xs font-bold text-text-secondary border-r border-border hover:bg-bg-hover">X</div>
                    <input 
                        type="number" 
                        step="0.1"
                        class="w-full u-input bg-bg-input text-xs p-1 px-2 outline-none text-text-primary placeholder-text-secondary"
                        name="transform-scale-x"
                        :value="transform.scale.x"
                        @focus="handleFocus"
                        @change="handleChange"
                        @input="(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            transform.scale.x = val;
                            update('scale.x', val);
                        }"
                    />
                </div>
                <div class="flex items-center border border-border rounded overflow-hidden group focus-within:border-accent-color transition-colors">
                    <div class="px-2 text-xs font-bold text-text-secondary border-r border-border hover:bg-bg-hover">Y</div>
                    <input 
                        type="number" 
                        step="0.1"
                        class="w-full u-input bg-bg-input text-xs p-1 px-2 outline-none text-text-primary"
                        name="transform-scale-y"
                        :value="transform.scale.y"
                        @focus="handleFocus"
                        @change="handleChange"
                        @input="(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            transform.scale.y = val;
                            update('scale.y', val);
                        }"
                    />
                </div>
            </div>
        </div>

        <!-- SPECIAL: Dimensions (For Text Wrapping) -->
        <div v-if="entity && (entity.label || entity.bitmapText)" class="flex items-center pt-2 border-t border-border mt-2">
            <div class="w-16 text-xs text-text-secondary">Size</div>
            <div class="flex-1 grid grid-cols-2 gap-1">
                <div class="flex items-center border border-border rounded overflow-hidden group focus-within:border-accent-color transition-colors">
                    <div class="px-2 text-xs font-bold text-text-secondary border-r border-border hover:bg-bg-hover">W</div>
                    <input 
                        type="number" 
                        class="w-full u-input bg-bg-input text-xs p-1 px-2 outline-none text-text-primary"
                        :value="entity.label ? (entity.label.width || 0) : (entity.bitmapText.width || 0)"
                        @input="(e) => {
                            const val = parseFloat((e.target as HTMLInputElement).value);
                            if (entity.label) entity.label.width = val;
                            else if (entity.bitmapText) entity.bitmapText.width = val;
                            update('width', val); // Triggers update
                        }"
                        placeholder="Auto"
                    />
                </div>
                 <div class="flex items-center border border-border rounded overflow-hidden opacity-50" title="Height is automatic for text">
                    <div class="px-2 text-xs font-bold text-text-secondary border-r border-border">H</div>
                    <input 
                        type="number" 
                        class="w-full u-input bg-bg-input text-xs p-1 px-2 outline-none text-text-disabled cursor-not-allowed"
                        disabled
                        placeholder="Auto"
                    />
                </div>
            </div>
        </div>
    </div>
</template>
