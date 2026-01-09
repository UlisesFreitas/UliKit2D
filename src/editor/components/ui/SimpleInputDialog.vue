<script setup lang="ts">
import BaseDialog from './BaseDialog.vue';
import { ref, onMounted, nextTick } from 'vue';

const props = defineProps<{
    title: string;
    message: string;
    defaultValue?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
}>();

const emit = defineEmits<{
    (e: 'resolve', value: string | null): void;
    (e: 'update:open', value: boolean): void;
}>();

const open = ref(true);
const inputValue = ref(props.defaultValue || '');
const inputRef = ref<HTMLInputElement | null>(null);

const handleConfirm = () => {
    open.value = false;
    emit('resolve', inputValue.value);
};

const handleCancel = () => {
    open.value = false;
    emit('resolve', null);
};

onMounted(() => {
    nextTick(() => {
        inputRef.value?.focus();
        if (props.defaultValue) {
            inputRef.value?.select();
        }
    });
});
</script>

<template>
    <BaseDialog 
        v-model:open="open" 
        :title="title" 
        :description="message"
        max-width="max-w-sm"
        @update:open="(val) => !val && handleCancel()"
    >
        <div class="py-2">
            <input 
                ref="inputRef"
                v-model="inputValue" 
                class="w-full bg-bg-input text-text-primary px-3 py-2 rounded border border-border focus:border-accent outline-none"
                :placeholder="placeholder"
                @keyup.enter="handleConfirm"
                @keyup.esc="handleCancel"
            />
        </div>

        <template #footer>
            <button 
                @click="handleCancel"
                class="px-3 py-1.5 text-xs rounded border border-border hover:bg-bg-hover text-text-primary"
            >
                {{ cancelText || 'Cancel' }}
            </button>
            <button 
                @click="handleConfirm"
                class="px-3 py-1.5 text-xs rounded bg-primary hover:bg-primary-hover text-white"
            >
                {{ confirmText || 'OK' }}
            </button>
        </template>
    </BaseDialog>
</template>
