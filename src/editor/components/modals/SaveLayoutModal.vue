<script setup lang="ts">
import { ref } from 'vue';
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "radix-vue";
import { useLayoutStore } from '../../../stores/useLayoutStore';
import { useUIStore } from '../../../stores/useUIStore';

const props = defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();

const layoutStore = useLayoutStore();
const ui = useUIStore();
const layoutName = ref('');

const onSave = async () => {
    if (!layoutName.value.trim()) {
        ui.showToast({ title: 'Error', description: 'Layout name cannot be empty.', type: 'error' });
        return;
    }
    
    await layoutStore.saveNamedLayout(layoutName.value);
    
    ui.showToast({ title: 'Layout Saved', description: `Layout "${layoutName.value}" saved successfully.`, type: 'success' });
    layoutName.value = ''; // Reset
    emit('update:open', false);
};

</script>

<template>
    <DialogRoot :open="open" @update:open="$emit('update:open', $event)">
        <DialogPortal>
            <DialogOverlay class="fixed inset-0 bg-black/50 z-50 transition-opacity backdrop-blur-sm" />
            <DialogContent class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border rounded-lg shadow-xl z-50 w-[400px] flex flex-col focus:outline-none p-6 gap-4">
                
                <DialogTitle class="text-lg font-bold text-text-primary">Save Layout</DialogTitle>
                <DialogDescription class="text-sm text-text-secondary">
                    Enter a name for your custom layout.
                </DialogDescription>

                <div class="flex flex-col gap-2">
                    <label class="text-xs font-bold text-text-primary">Layout Name</label>
                    <input 
                        v-model="layoutName" 
                        type="text" 
                        placeholder="My Custom Layout" 
                        class="bg-bg-input border border-border rounded px-3 py-2 text-sm text-text-primary outline-none focus:border-accent transition-colors"
                        @keydown.enter="onSave"
                        autoFocus
                    />
                </div>

                <div class="flex justify-end gap-2 mt-2">
                    <button @click="$emit('update:open', false)" class="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition">Cancel</button>
                    <button @click="onSave" class="px-4 py-2 text-sm bg-accent text-white font-bold rounded shadow hover:bg-accent-hover transition">Save</button>
                </div>

                 <DialogClose class="absolute top-4 right-4 text-text-secondary hover:text-text-primary">✕</DialogClose>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
