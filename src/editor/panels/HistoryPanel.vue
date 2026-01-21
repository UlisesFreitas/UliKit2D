<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { instance as commandManager } from '../commands/CommandManager';

// Debug Log Helper
const log = (msg: string, ...args: any[]) => {
    console.log(`[HistoryPanel] ${msg}`, ...args);
};

// Access Reactive State directly
const history = commandManager.history;
const future = commandManager.future;

onMounted(() => {
    log('Mounted. History Length:', history.value.length);
    log('Current History:', history.value);
});

// Watch for changes to debug
watch(history, (newVal) => {
    log('History Updated:', newVal.length, newVal);
}, { deep: true });

const undo = () => {
    log('User Clicked Undo');
    commandManager.undo();
};

const redo = () => {
    log('User Clicked Redo');
    commandManager.redo();
};

const jumpTo = (index: number) => {
    log('Jumping to index:', index);
    // TODO: Implement Jump Logic if needed, or just loop undo/redo
    // For now, let's just use undo/redo references
};

// Format timestamp
const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

</script>

<template>
    <div class="history-panel flex flex-col h-full bg-bg-base text-xs overflow-hidden">
        <div class="header p-2 border-b border-border font-bold text-text-disabled uppercase tracking-wider flex justify-between items-center">
            <span>Command History</span>
            <span class="text-[10px] opacity-50">{{ history.length }} / {{ history.length + future.length }}</span>
        </div>

        <div class="flex-1 overflow-y-auto p-1">
            <!-- Empty State -->
            <div v-if="history.length === 0 && future.length === 0" class="text-text-disabled p-4 text-center italic">
                No history recorded.
            </div>

            <!-- List -->
            <div class="flex flex-col gap-0.5">
                
                <!-- Past Commands -->
                <div 
                    v-for="(cmd, index) in history" 
                    :key="cmd.id"
                    class="history-item p-1.5 rounded cursor-pointer flex items-center gap-2 hover:bg-bg-hover transition-colors"
                    :class="{ 'bg-bg-selection text-white': index === history.length - 1 }"
                    @click="jumpTo(index)"
                >
                    <span class="text-text-disabled text-[10px] font-mono">{{ formatTime(cmd.timestamp || Date.now()) }}</span>
                    <span class="truncate flex-1">{{ cmd.description || 'Unknown Action' }}</span>
                </div>

                <!-- Active Line Indicator -->
                 <div v-if="future.length > 0" class="h-0.5 bg-accent-color my-1 opacity-50"></div>

                <!-- Future Commands (Redo Stack) -->
                <div 
                    v-for="cmd in [...future].reverse()" 
                    :key="cmd.id"
                    class="history-item p-1.5 rounded cursor-pointer flex items-center gap-2 opacity-50 hover:opacity-100 hover:bg-bg-hover transition-colors"
                    @click="redo" 
                >
                     <span class="text-text-disabled text-[10px] font-mono">{{ formatTime(cmd.timestamp || Date.now()) }}</span>
                    <span class="truncate flex-1 italic">{{ cmd.description || 'Unknown Action' }}</span>
                </div>

            </div>
        </div>

        <!-- Toolbar -->
        <div class="footer p-2 border-t border-border flex justify-end gap-2 bg-bg-header">
            <button 
                class="px-3 py-1 bg-bg-panel hover:bg-bg-hover border border-border rounded text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                @click="undo"
                :disabled="history.length === 0"
            >
                Undo
            </button>
            <button 
                class="px-3 py-1 bg-bg-panel hover:bg-bg-hover border border-border rounded text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                @click="redo"
                :disabled="future.length === 0"
            >
                Redo
            </button>
        </div>
    </div>
</template>

<style scoped>
.history-item.bg-bg-selection {
    background-color: var(--color-accent); /* Fallback */
    background-color: var(--bg-selection);
    color: var(--text-accent);
}
</style>
