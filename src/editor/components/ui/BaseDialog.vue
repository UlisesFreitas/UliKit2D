<script setup lang="ts">
import { 
  DialogRoot, 
  DialogPortal, 
  DialogOverlay, 
  DialogContent, 
  DialogTitle, 
  DialogDescription,
  DialogClose
} from 'radix-vue';
import { X } from 'lucide-vue-next';

const props = defineProps<{
    open: boolean;
    title?: string;
    description?: string;
    maxWidth?: string; // e.g. 'max-w-md'
}>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();
</script>

<template>
  <DialogRoot :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogContent 
        class="fixed left-[50%] top-[50%] z-[201] grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-bg-panel p-0 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg"
        :class="[props.maxWidth || 'max-w-lg']"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border px-4 py-3" v-if="title">
            <DialogTitle class="text-sm font-semibold text-text-primary">
                {{ title }}
            </DialogTitle>
            <DialogClose class="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <X class="h-4 w-4 text-text-secondary hover:text-text-primary" />
                <span class="sr-only">Close</span>
            </DialogClose>
        </div>

        <!-- Body -->
        <div class="px-4 py-2">
            <DialogDescription v-if="description" class="text-xs text-text-secondary mb-2">
                {{ description }}
            </DialogDescription>
            <slot />
        </div>

        <!-- Footer (Optional Slot) -->
        <div class="flex justify-end gap-2 border-t border-border px-4 py-3" v-if="$slots.footer">
            <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
