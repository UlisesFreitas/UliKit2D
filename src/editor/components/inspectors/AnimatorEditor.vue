<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { type Entity } from '../../../engine/ecs/ECS';
import AnimatorModal from '../modals/AnimatorModal.vue';

const props = defineProps<{
    entity: Entity;
}>();

const emit = defineEmits(['update']);

// Local state
const isModalOpen = ref(false);
const version = ref(0); // Force update for non-reactive ECS data

// Ensure animator component exists
const animator = computed(() => {
    version.value; // Dependency
    if (!props.entity.animator) {
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
    version.value;
    return Object.keys(animator.value.animations || {});
});

const onModalUpdate = () => {
    version.value++;
    emit('update');
};

// Watch for external updates
watch(() => props.entity, () => {
    version.value++;
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
                    class="flex-1 bg-bg-input border border-border rounded px-1 py-0.5 text-xs text-text-primary outline-none focus:border-accent-color"
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
                    class="w-16 bg-bg-input border border-border rounded px-1 py-0.5 text-xs text-text-primary text-right outline-none focus:border-accent-color"
                />
            </div>

            <!-- Is Playing -->
            <div class="flex items-center justify-between">
                <label class="text-xs w-24">Auto Play</label>
                <input 
                    type="checkbox" 
                    v-model="animator.isPlaying"
                    @change="emit('update')"
                    class="accent-accent-color"
                />
            </div>
        </div>

        <!-- Open Manager -->
        <button 
            @click="isModalOpen = true" 
            class="w-full py-2 bg-bg-input hover:bg-bg-hover border border-border rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        >
            <span>🎬</span> Edit Animations
        </button>

        <!-- Modal -->
        <Teleport to="body">
            <AnimatorModal 
                :isOpen="isModalOpen"
                :entity="entity"
                @close="isModalOpen = false"
                @update="onModalUpdate"
            />
        </Teleport>
    </div>
</template>
