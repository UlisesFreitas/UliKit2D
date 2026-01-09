<script setup lang="ts">
import { useUIStore } from '../../../stores/useUIStore';
import BaseToast from '../ui/BaseToast.vue';
import { ToastProvider, ToastViewport } from 'radix-vue';

const uiStore = useUIStore();
</script>

<template>
    <div class="z-[9999] relative">
        <!-- Render Modals -->
        <!-- Note: We render them dynamically. 
             Since they use DialogPortal, they will teleport to body anyway, 
             so simpler is just to iterate them. -->
        <component 
            v-for="modal in uiStore.modals" 
            :key="modal.id" 
            :is="modal.component" 
            v-bind="modal.props"
            @resolve="modal.resolve" 
            @reject="modal.reject"
        />

        <!-- Render Toasts -->
        <ToastProvider>
            <BaseToast 
                v-for="toast in uiStore.toasts" 
                :key="toast.id"
                :id="toast.id"
                :title="toast.title"
                :description="toast.description"
                :type="toast.type"
                :duration="toast.duration"
                :open="toast.open"
                @update:open="(val) => !val && uiStore.removeToast(toast.id)"
            />
            <ToastViewport class="fixed bottom-0 right-0 p-6 flex flex-col gap-2 w-[390px] max-w-[100vw] m-0 z-[10000] outline-none" />
        </ToastProvider>
    </div>
</template>
