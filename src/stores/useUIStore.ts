import { defineStore } from 'pinia';
import { ref, markRaw, type Component } from 'vue';
import { nanoid } from 'nanoid';

export interface ModalInstance {
    id: string;
    component: Component;
    props?: Record<string, any>;
    resolve?: (value: any) => void;
    reject?: (reason?: any) => void;
}

export interface ToastMessage {
    id: string;
    title?: string;
    description?: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
    open: boolean;
}

export const useUIStore = defineStore('ui', () => {
    // State
    const modals = ref<ModalInstance[]>([]);
    const toasts = ref<ToastMessage[]>([]);

    // Actions
    const openModal = (component: Component, props?: Record<string, any>): Promise<any> => {
        return new Promise((resolve, reject) => {
            const id = nanoid();
            modals.value.push({
                id,
                component: markRaw(component),
                props,
                resolve,
                reject
            });
        });
    };

    const closeModal = (id: string, result?: any) => {
        const index = modals.value.findIndex(m => m.id === id);
        if (index !== -1) {
            const modal = modals.value[index];
            if (modal && modal.resolve) modal.resolve(result);
            modals.value.splice(index, 1);
        }
    };

    const closeAllModals = () => {
        modals.value.forEach(m => {
            if (m.resolve) m.resolve(undefined);
        });
        modals.value = [];
    };

    const showToast = (options: Omit<ToastMessage, 'id' | 'open'>) => {
        const id = nanoid();
        const toast: ToastMessage = {
            id,
            open: true,
            ...options
        };
        toasts.value.push(toast);

        // Cleanup isn't strictly necessary as ToastProvider handles removal, but good for memory
        if (options.duration !== Infinity) {
             setTimeout(() => {
                 removeToast(id);
             }, (options.duration || 5000) + 1000);
        }
    };

    const removeToast = (id: string) => {
         const index = toasts.value.findIndex(t => t.id === id);
         if (index !== -1) {
             toasts.value.splice(index, 1);
         }
    };

    const confirm = (options: { title: string; message: string; confirmText?: string; cancelText?: string; isDanger?: boolean }): Promise<boolean> => {
        return new Promise((resolve) => {
            // Lazy load component to avoid circular references if any
            import('../editor/components/ui/SimpleConfirmDialog.vue').then((module) => {
                 openModal(module.default, options).then((result) => {
                     resolve(result === undefined ? false : result);
                 });
            });
        });
    };

    const prompt = (options: { title: string; message: string; defaultValue?: string; placeholder?: string; confirmText?: string; cancelText?: string; }): Promise<string | null> => {
        return new Promise((resolve) => {
            import('../editor/components/ui/SimpleInputDialog.vue').then((module) => {
                 openModal(module.default, options).then((result) => {
                     resolve(result === undefined ? null : result);
                 });
            });
        });
    };

    const isLoading = ref(false);
    const loadingMessage = ref('');
    const progressValue = ref(0);
    const progressMode = ref<'indeterminate' | 'determinate'>('indeterminate');
    const progressDetail = ref('');
    
    const setLoading = (active: boolean, message: string = 'Loading...', mode: 'indeterminate' | 'determinate' = 'indeterminate') => {
        isLoading.value = active;
        loadingMessage.value = message;
        progressMode.value = mode;
        if (!active) {
            progressValue.value = 0;
            progressDetail.value = '';
        }
    };

    const setProgress = (value: number, detail?: string) => {
        progressValue.value = value;
        if (detail) progressDetail.value = detail;
    };

    return {
        modals,
        toasts,
        isLoading,
        loadingMessage,
        openModal,
        closeModal,
        closeAllModals,
        showToast,
        removeToast,
        confirm,
        prompt,
        setLoading,
        setProgress,
        progressValue,
        progressMode,
        progressDetail
    };
});
