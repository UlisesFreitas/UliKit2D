<script setup lang="ts">
const props = defineProps<{
    label: {
        text: string;
        fontSize: number;
        fontFamily: string;
        color: string;
        align: 'left' | 'center' | 'right';
        fontWeight?: 'normal' | 'bold';
        fontStyle?: 'normal' | 'italic';
        stroke?: string;
        strokeThickness?: number;
        dropShadow?: {
            enabled: boolean;
            color: string;
            blur: number;
            distance: number;
            angle: number;
            alpha: number;
        };
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

        <!-- Styles (Row) -->
        <div class="flex items-center space-x-2 pt-2 border-t border-border mt-2">
            <label class="text-text-secondary w-10">Style</label>
            <div class="flex space-x-2">
                 <label class="flex items-center space-x-1 cursor-pointer select-none">
                    <input type="checkbox" 
                        :checked="label.fontWeight === 'bold'"
                        @change="(e) => { label.fontWeight = (e.target as HTMLInputElement).checked ? 'bold' : 'normal'; update(); }"
                        class="h-4 w-4 rounded border-border bg-bg-input text-accent-color"
                    />
                    <span class="font-bold">B</span>
                </label>
                <label class="flex items-center space-x-1 cursor-pointer select-none">
                    <input type="checkbox" 
                         :checked="label.fontStyle === 'italic'"
                        @change="(e) => { label.fontStyle = (e.target as HTMLInputElement).checked ? 'italic' : 'normal'; update(); }"
                        class="h-4 w-4 rounded border-border bg-bg-input text-accent-color"
                    />
                    <span class="italic">I</span>
                </label>
            </div>
        </div>

        <!-- Outline -->
        <div class="pt-2 border-t border-border mt-1">
            <div class="flex items-center justify-between mb-1">
                 <div class="text-xs font-bold ml-10 text-text-primary">Outline</div>
                 <input 
                    type="checkbox" 
                    :checked="(label.strokeThickness || 0) > 0"
                    @change="(e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        if (checked) {
                             if (!label.strokeThickness) label.strokeThickness = 1;
                             if (!label.stroke) label.stroke = '#000000';
                        } else {
                             label.strokeThickness = 0;
                        }
                        update();
                    }"
                    class="mr-2 h-4 w-4 rounded border-border bg-bg-input text-accent-color"
                 />
            </div>
             <div v-if="(label.strokeThickness || 0) > 0" class="pl-2 grid grid-cols-2 gap-2">
                 <div class="flex items-center space-x-2">
                    <label class="text-text-secondary w-10">Color</label>
                     <div class="flex-1 flex items-center space-x-1">
                        <input type="color" v-model="label.stroke" @input="update" class="h-6 w-6 border-none bg-transparent cursor-pointer" />
                         <span class="text-xs font-mono text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis">{{ label.stroke || 'None' }}</span>
                     </div>
                 </div>
                 <div class="flex items-center space-x-2">
                    <label class="text-text-secondary w-8 text-right">Thick</label>
                    <input type="number" v-model.number="label.strokeThickness" @input="update" min="0" step="0.5" class="u-input flex-1 min-w-0" />
                 </div>
            </div>
        </div>

        <!-- Shadow -->
        <div class="pt-2 border-t border-border mt-1">
            <div class="flex items-center justify-between mb-1">
                 <div class="text-xs font-bold ml-10 text-text-primary">Shadow</div>
                 <input 
                    type="checkbox" 
                    :checked="label.dropShadow?.enabled"
                    @change="(e) => {
                        if (!label.dropShadow) label.dropShadow = { enabled: true, color: '#000000', blur: 2, distance: 3, angle: 45, alpha: 0.5 };
                        label.dropShadow.enabled = (e.target as HTMLInputElement).checked;
                        update();
                    }"
                    class="mr-2 h-4 w-4 rounded border-border bg-bg-input text-accent-color"
                 />
            </div>
            
            <div v-if="label.dropShadow?.enabled" class="pl-2 flex flex-col gap-1">
                 <!-- Shadow Color -->
                 <div class="flex items-center space-x-2">
                    <label class="text-text-secondary w-10">Color</label>
                     <div class="flex-1 flex items-center space-x-1">
                        <input type="color" v-model="label.dropShadow.color" @input="update" class="h-6 w-6 border-none bg-transparent cursor-pointer" />
                        <span class="text-xs font-mono text-text-secondary">{{ label.dropShadow.color }}</span>
                     </div>
                 </div>

                 <!-- Shadow Props 1 -->
                 <div class="grid grid-cols-2 gap-2">
                      <div class="flex items-center space-x-1">
                        <label class="text-text-secondary text-[10px] w-8">Dist</label>
                        <input type="number" v-model.number="label.dropShadow.distance" @input="update" class="u-input flex-1 min-w-0 px-1" />
                      </div>
                       <div class="flex items-center space-x-1">
                        <label class="text-text-secondary text-[10px] w-8">Blur</label>
                        <input type="number" v-model.number="label.dropShadow.blur" @input="update" class="u-input flex-1 min-w-0 px-1" />
                      </div>
                 </div>

                 <!-- Shadow Props 2 -->
                 <div class="grid grid-cols-2 gap-2">
                      <div class="flex items-center space-x-1">
                        <label class="text-text-secondary text-[10px] w-8">Ang°</label>
                        <input type="number" v-model.number="label.dropShadow.angle" @input="update" class="u-input flex-1 min-w-0 px-1" title="Degrees" />
                      </div>
                       <div class="flex items-center space-x-1">
                        <label class="text-text-secondary text-[10px] w-8">Alpha</label>
                        <input type="number" v-model.number="label.dropShadow.alpha" @input="update" step="0.1" min="0" max="1" class="u-input flex-1 min-w-0 px-1" />
                      </div>
                 </div>
            </div>
        </div>
    </div>
</template>
