<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { type Entity } from '../../../engine/ecs/ECS';

const props = defineProps<{
    entity: Entity;
}>();

const emit = defineEmits(['update']);

// Local state for the selected animation to edit
const selectedAnimName = ref<string>('');
const version = ref(0); // Force update for non-reactive ECS data

// Ensure animator component exists
const animator = computed(() => {
    version.value; // Dependency
    if (!props.entity.animator) {
         // This shouldn't happen if parent checks, but for safety:
         return {
             currentAnim: '',
             isPlaying: false,
             speed: 1,
             elapsedTime: 0,
             animations: {}
         };
    }
    return props.entity.animator;
});

const animationNames = computed(() => {
    // Rely on version to update keys
    version.value;
    return Object.keys(animator.value.animations);
});

const selectedAnimation = computed(() => {
    version.value;
    if (!selectedAnimName.value) return undefined;
    return animator.value.animations[selectedAnimName.value];
});

const addAnimation = () => {
    const name = prompt("Animation Name:");
    if (name) {
        if (!animator.value.animations[name]) {
            animator.value.animations[name] = {
                frames: [],
                loop: true,
                speed: 12
            };
            selectedAnimName.value = name;
            version.value++;
            emit('update');
        } else {
            alert('Animation already exists!');
        }
    }
};

const removeAnimation = (name: string) => {
    if (confirm(`Delete animation '${name}'?`)) {
        delete animator.value.animations[name];
        if (selectedAnimName.value === name) selectedAnimName.value = '';
        version.value++;
        emit('update');
    }
};

const addFrame = (animName: string) => {
    const anim = animator.value.animations[animName];
    if (anim) {
        anim.frames.push('');
        version.value++;
        emit('update');
    }
};

const removeFrame = (animName: string, index: number) => {
    const anim = animator.value.animations[animName];
    if (anim) {
        anim.frames.splice(index, 1);
        version.value++;
        emit('update');
    }
};

const updateFrame = (animName: string, index: number, value: string) => {
    const anim = animator.value.animations[animName];
    if (anim) {
        anim.frames[index] = value;
        emit('update');
    }
};

const onDropFrame = (e: DragEvent, animName: string) => {
    const path = e.dataTransfer?.getData('text/plain');
    if (path) {
        // Simple check if it's an image
        if (path.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
             const anim = animator.value.animations[animName];
             if (anim) {
                 anim.frames.push(path);
                 emit('update');
             }
        }
    }
};

// Watch for external updates
watch(() => props.entity, () => {
    // Refresh logic if needed
}, { deep: true });

</script>

<template>
    <div class="animator-editor space-y-3">
        
        <!-- Global Settings -->
        <div class="section border border-border rounded p-2 bg-bg-panel/50">
            <div class="text-xs font-bold mb-2 text-text-secondary uppercase">Global Settings</div>
            
            <!-- Current Animation -->
            <div class="flex items-center justify-between mb-2">
                <label class="text-xs w-24">Current Anim</label>
                <select 
                    v-model="animator.currentAnim" 
                    @change="emit('update')"
                    class="flex-1 bg-bg-input border border-border rounded px-1 py-0.5 text-xs text-text-primary"
                >
                    <option value="">(None)</option>
                    <option v-for="name in animationNames" :key="name" :value="name">{{ name }}</option>
                </select>
            </div>

            <!-- Global Speed -->
             <div class="flex items-center justify-between mb-2">
                <label class="text-xs w-24">Speed Multiplier</label>
                <input 
                    type="number" 
                    v-model.number="animator.speed" 
                    @input="emit('update')"
                    step="0.1"
                    class="w-16 bg-bg-input border border-border rounded px-1 py-0.5 text-xs text-text-primary text-right"
                />
            </div>

            <!-- Is Playing -->
            <div class="flex items-center justify-between">
                <label class="text-xs w-24">Auto Play</label>
                <input 
                    type="checkbox" 
                    v-model="animator.isPlaying"
                    @change="emit('update')"
                />
            </div>
        </div>

        <!-- Animations Manager -->
        <div class="section border border-border rounded p-2 bg-bg-panel/50">
             <div class="flex justify-between items-center mb-2">
                <div class="text-xs font-bold text-text-secondary uppercase">Animations</div>
                <button @click="addAnimation" class="text-xs bg-bg-input hover:bg-bg-hover border border-border px-2 py-0.5 rounded">+</button>
            </div>

            <div class="flex space-x-2 h-32">
                <!-- List -->
                <div class="w-1/3 border border-border rounded overflow-y-auto bg-bg-base">
                    <div 
                        v-for="name in animationNames" 
                        :key="name"
                        @click="selectedAnimName = name"
                        :class="['px-2 py-1 text-xs cursor-pointer truncate', selectedAnimName === name ? 'bg-accent-color text-white' : 'hover:bg-bg-hover']"
                    >
                        {{ name }}
                    </div>
                     <div v-if="animationNames.length === 0" class="text-[10px] text-text-secondary p-2 text-center italic">No anims</div>
                </div>

                <!-- Editor -->
                <div class="flex-1 border border-border rounded p-2 overflow-y-auto bg-bg-base" v-if="selectedAnimation">
                     <div class="flex justify-between items-center mb-2 border-b border-border pb-1">
                        <span class="font-bold text-xs">{{ selectedAnimName }}</span>
                        <button @click="removeAnimation(selectedAnimName)" class="text-red-400 hover:text-red-500 text-[10px]">Delete</button>
                    </div>

                    <!-- Props -->
                    <div class="grid grid-cols-2 gap-2 mb-2">
                        <div>
                            <label class="block text-[10px] text-text-secondary">FPS</label>
                            <input type="number" v-model.number="selectedAnimation.speed" @input="emit('update')" class="w-full bg-bg-input border border-border rounded px-1 py-0.5 text-xs" />
                        </div>
                        <div class="flex items-center pt-3">
                            <input type="checkbox" v-model="selectedAnimation.loop" @change="emit('update')" class="mr-1" />
                            <label class="text-xs cursor-pointer" @click="selectedAnimation.loop = !selectedAnimation.loop">Loop</label>
                        </div>
                    </div>

                    <!-- Frames -->
                     <div class="text-[10px] text-text-secondary mb-1 flex justify-between">
                         <span>Frames (Drag Assets Here)</span>
                         <button @click="addFrame(selectedAnimName)" class="text-accent-color hover:underline">+ Add</button>
                     </div>
                     <div 
                        class="space-y-1 min-h-[50px] border border-dashed border-border rounded p-1"
                        @dragover.prevent
                        @drop.prevent="onDropFrame($event, selectedAnimName)"
                    >
                        <div v-for="(frame, idx) in selectedAnimation.frames" :key="idx" class="flex items-center space-x-1">
                             <div class="text-[10px] w-4 text-text-secondary">{{ idx }}</div>
                             <input 
                                type="text" 
                                :value="frame" 
                                @input="e => updateFrame(selectedAnimName, idx, (e.target as HTMLInputElement).value)"
                                class="flex-1 min-w-0 bg-bg-input border border-border rounded px-1 py-0.5 text-[10px]"
                             />
                             <button @click="removeFrame(selectedAnimName, idx)" class="text-red-400 hover:text-red-500">×</button>
                        </div>
                         <div v-if="selectedAnimation.frames.length === 0" class="text-[10px] text-text-secondary text-center py-2 opacity-50">
                             No frames
                         </div>
                     </div>
                </div>
                <div v-else class="flex-1 flex items-center justify-center text-xs text-text-secondary opacity-50">
                    Select an animation
                </div>
            </div>
        </div>
    </div>
</template>
