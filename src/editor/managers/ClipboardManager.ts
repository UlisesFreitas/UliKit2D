
import { useEditorStore } from '../../stores/useEditorStore';
import { world, type Entity } from '../../engine/ecs/ECS';
import { instance as commandManager } from '../commands/CommandManager';
import { PasteCommand } from '../commands/PasteCommand';
import { DeleteCommand } from '../commands/DeleteCommand';

export class ClipboardManager {
    private clipboard: Entity[] = []; // Internal Clipboard
    
    constructor() {
        // Shortcuts initialized by ShortcutManager
    }

    public copy() {
        const store = useEditorStore();
        // Support Multi-Select later, for now single ID
        const id = store.selectedEntityId;
        if (!id) return;

        const entity = world.with('id').where(e => e.id === id).first;
        if (entity) {
            // Deep Clone
            const data = JSON.parse(JSON.stringify(entity));
            this.clipboard = [data];
            console.log('[ClipboardManager] Copied:', data);
        }
    }

    public cut() {
        this.copy();
        this.deleteSelected();
    }

    public paste() {
        if (this.clipboard.length === 0) return;

        // Process Clipboard Data
        const newEntities: Entity[] = this.clipboard.map(original => {
            const clone = JSON.parse(JSON.stringify(original));
            
            // 1. New ID
            clone.id = crypto.randomUUID();
            clone.name = `${original.name} (Copy)`;

            // 2. Offset Position (if transform exists)
            if (clone.transform) {
                clone.transform.x += 20;
                clone.transform.y += 20;
            }

            return clone;
        });

        const cmd = new PasteCommand(newEntities);
        commandManager.execute(cmd);
        console.log('[ClipboardManager] Pasted:', newEntities);
    }

    public deleteSelected() {
        const store = useEditorStore();
        const id = store.selectedEntityId;
        if (!id) return;

        const cmd = new DeleteCommand([id]);
        commandManager.execute(cmd);
        
        store.clearSelection();
    }
}

export const instance = new ClipboardManager();
