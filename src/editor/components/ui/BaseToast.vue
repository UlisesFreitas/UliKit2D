<script setup lang="ts">
import { 
  ToastRoot, 
  ToastTitle, 
  ToastDescription, 
  ToastClose 
} from 'radix-vue';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-vue-next';
import { computed } from 'vue';

export interface ToastProps {
    id: string;
    title?: string;
    description?: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
    open: boolean;
}

const props = defineProps<ToastProps>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();

const icon = computed(() => {
    switch (props.type) {
        case 'success': return CheckCircle;
        case 'error': return AlertCircle;
        case 'warning': return AlertCircle;
        default: return Info;
    }
});

const colorClass = computed(() => {
    switch (props.type) {
        case 'success': return 'border-green-500 text-green-500';
        case 'error': return 'border-red-500 text-red-500';
        case 'warning': return 'border-yellow-500 text-yellow-500';
        default: return 'border-blue-500 text-blue-500';
    }
});
</script>

<template>
    <ToastRoot 
        :open="open" 
        @update:open="(v) => emit('update:open', v)"
        :duration="duration || 5000"
        class="group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border border-border bg-bg-panel p-4 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full mt-2"
    >
        <div class="flex gap-3 items-start">
             <component :is="icon" class="w-5 h-5 mt-0.5" :class="colorClass" />
             <div class="grid gap-1">
                 <ToastTitle v-if="title" class="text-sm font-semibold text-text-primary">{{ title }}</ToastTitle>
                 <ToastDescription v-if="description" class="text-sm opacity-90 text-text-secondary">{{ description }}</ToastDescription>
             </div>
        </div>
        <ToastClose class="absolute right-2 top-2 rounded-md p-1 text-text-secondary opacity-0 transition-opacity focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 hover:text-text-primary">
            <X class="h-4 w-4" />
        </ToastClose>
    </ToastRoot>
</template>
