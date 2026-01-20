import type { ICommand } from './ICommand';
import { ref, type Ref } from 'vue';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectSettingsStore } from '../../stores/useProjectSettingsStore';

export class CommandManager {
    // Reactive state for History Panel
    public history: Ref<ICommand[]> = ref([]);
    public future: Ref<ICommand[]> = ref([]);

    // Reactive state for UI buttons (Legacy? can compute from history/future)
    public canUndo: Ref<boolean> = ref(false);
    public canRedo: Ref<boolean> = ref(false);

    public execute(command: ICommand) {
        console.log('[CommandManager] Execute:', command);
        command.execute();
        this.history.value.push(command);
        this.future.value = []; // Clear redo stack on new action
        
        this.enforceLimits();
        this.updateState();
    }

    private enforceLimits() {
         const store = useProjectSettingsStore();
         const maxSteps = store.settings.editor.historyMaxSteps || 50;
         // const maxBytes = store.settings.editor.historyMaxBytes;

         if (this.history.value.length > maxSteps) {
             const overflow = this.history.value.length - maxSteps;
             // Remove oldest
             this.history.value.splice(0, overflow);
             console.log(`[CommandManager] History limit reached. Removed ${overflow} old steps.`);
         }

         // Byte limit is expensive to calculate on every step (JSON.stringify).
         // Implement if strictly needed, or maybe async/debounce?
         // For now user asked for "steps OR bytes", steps is safer for performance.
    }

    public undo() {
        if (this.history.value.length === 0) return;
        const command = this.history.value.pop();
        if (command) {
            console.log('[CommandManager] Undo:', command);
            command.undo();
            this.future.value.push(command);
            this.updateState();
        }
    }

    public redo() {
        if (this.future.value.length === 0) return;
        const command = this.future.value.pop();
        if (command) {
            console.log('[CommandManager] Redo:', command);
            command.execute();
            this.history.value.push(command);
            this.updateState();
        }
    }

    private updateState() {
        console.log('[CommandManager] Update State. History:', this.history.value.length, 'Future:', this.future.value.length);
        const editorStore = useEditorStore();
        
        // Update local refs (if anyone uses them)
        this.canUndo.value = this.history.value.length > 0;
        this.canRedo.value = this.future.value.length > 0;

        // Sync with Editor Store (Global UI)
        if (editorStore) {
            editorStore.canUndo = this.canUndo.value;
            editorStore.canRedo = this.canRedo.value;
        }
    }
}

export const instance = new CommandManager();
