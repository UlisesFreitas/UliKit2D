<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
    controller: { speed: number; jumpForce: number };
    revision: number;
    // entity?
}>();

const emit = defineEmits(['update']);

const local = ref({ ...props.controller });

watch(() => props.revision, () => {
    // Sync external changes
    local.value = { ...props.controller };
});

const emitUpdate = () => {
    // Mutation is usually direct in ECS object reference passed by props (miniplex entity object),
    // but here props.controller IS the reference to the data object in entity.
    // So modifying local isn't enough if we don't apply it back, OR we modify props directly?
    // In other editors, we mutate props data object directly usually? 
    // Let's check: yes, usually we pass the object ref.
    
    props.controller.speed = local.value.speed;
    props.controller.jumpForce = local.value.jumpForce;
    emit('update');
};
</script>

<template>
    <div class="flex flex-col gap-2 text-xs">
        <div class="flex items-center">
            <label class="w-24 text-text-secondary">Speed</label>
            <input 
                type="number" 
                v-model.number="local.speed" 
                @input="emitUpdate"
                class="u-input flex-1"
            />
        </div>
        <div class="flex items-center">
            <label class="w-24 text-text-secondary">Jump Force</label>
            <input 
                type="number" 
                v-model.number="local.jumpForce" 
                @input="emitUpdate"
                class="u-input flex-1"
            />
        </div>
    </div>
</template>
