<script setup lang="ts">
import BaseDialog from './BaseDialog.vue';
import { ref } from 'vue';

const props = defineProps<{
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
}>();

const emit = defineEmits<{
    (e: 'resolve', value: boolean): void;
    (e: 'update:open', value: boolean): void;
}>();

const open = ref(true);

const handleConfirm = () => {
    open.value = false;
    emit('resolve', true);
};

const handleCancel = () => {
    open.value = false;
    emit('resolve', false);
};
</script>

<template>
    <BaseDialog 
        v-model:open="open" 
        :title="title" 
        :description="message"
        max-width="max-w-sm"
        @update:open="(val) => !val && handleCancel()"
    >
        <template #footer>
            <button 
                @click="handleCancel"
                class="px-3 py-1.5 text-xs rounded border border-border hover:bg-bg-hover text-text-primary"
            >
                {{ cancelText || 'Cancel' }}
            </button>
            <button 
                @click="handleConfirm"
                class="px-3 py-1.5 text-xs rounded text-white"
                :class="isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-hover'"
            >
                {{ confirmText || 'Confirm' }}
            </button>
        </template>
    </BaseDialog>
</template>
