<script setup lang="ts">
const props = defineProps<{
    body: {
        mass: number;
        isStatic: boolean;
        friction: number;
        restitution: number;
    };
}>();

const emit = defineEmits(['update']);

const update = () => {
    emit('update');
};
</script>

<template>
    <div class="grid grid-cols-2 gap-2 text-xs">
        <!-- Static / Dynamic -->
        <div class="col-span-2 flex items-center mb-1">
            <label class="flex items-center cursor-pointer space-x-2">
                <input 
                    type="checkbox" 
                    v-model="body.isStatic"
                    @change="update"
                    class="h-4 w-4 bg-bg-input border-border text-accent-color rounded"
                />
                <span class="text-text-primary">Is Static</span>
            </label>
        </div>

        <!-- Mass -->
        <div class="flex items-center space-x-2">
             <label class="text-text-secondary w-16">Mass</label>
             <input 
                type="number" 
                v-model.number="body.mass"
                @input="update"
                step="1.0"
                class="u-input flex-1 min-w-0"
                :disabled="body.isStatic"
             />
        </div>

        <!-- Friction -->
        <div class="flex items-center space-x-2">
             <label class="text-text-secondary w-16">Friction</label>
             <input 
                type="number" 
                v-model.number="body.friction"
                @input="update"
                step="0.05"
                min="0"
                max="1"
                class="u-input flex-1 min-w-0"
             />
        </div>

        <!-- Restitution (Bounciness) -->
        <div class="flex items-center space-x-2">
             <label class="text-text-secondary w-16">Bounciness</label>
             <input 
                type="number" 
                v-model.number="body.restitution"
                @input="update"
                step="0.1"
                min="0"
                max="2"
                class="u-input flex-1 min-w-0"
             />
        </div>
    </div>
</template>
