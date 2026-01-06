import type { ICommand } from './ICommand';
import { ref, type Ref } from 'vue';

export class CommandManager {
    private history: ICommand[] = [];
    private future: ICommand[] = [];

    // Reactive state for UI (disabling buttons etc)
    public canUndo: Ref<boolean> = ref(false);
    public canRedo: Ref<boolean> = ref(false);

    public execute(command: ICommand) {
        command.execute();
        this.history.push(command);
        this.future = []; // Clear redo stack on new action
        this.updateState();
    }

    public undo() {
        if (this.history.length === 0) return;
        const command = this.history.pop();
        if (command) {
            command.undo();
            this.future.push(command);
            this.updateState();
        }
    }

    public redo() {
        if (this.future.length === 0) return;
        const command = this.future.pop();
        if (command) {
            command.execute();
            this.history.push(command);
            this.updateState();
        }
    }

    private updateState() {
        this.canUndo.value = this.history.length > 0;
        this.canRedo.value = this.future.length > 0;
    }
}
