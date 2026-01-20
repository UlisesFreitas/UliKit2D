import { useEditorStore } from '../../stores/useEditorStore';
import { ProjectManager } from '../managers/ProjectManager';
import { instance as clipboard } from './ClipboardManager';

export class ShortcutManager {
    constructor() {
        this.setupListeners();
    }

    private setupListeners() {
        window.addEventListener('keydown', (e) => {
            // Ignore if input focused (Input, Textarea, or ContentEditable)
            if (this.isInputFocused(e)) return;

            const store = useEditorStore();

            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
                    case 'z': 
                        if (e.shiftKey) {
                            // Ctrl + Shift + Z -> Redo
                            if (store.canRedo) {
                                store.redo();
                                e.preventDefault();
                            }
                        } else {
                            // Ctrl + Z -> Undo
                            if (store.canUndo) {
                                store.undo();
                                e.preventDefault();
                            }
                        }
                        break;
                    
                    case 'y':
                        // Ctrl + Y -> Redo (Windows standard)
                        if (store.canRedo) {
                            store.redo();
                            e.preventDefault();
                        }
                        break;

                    case 's':
                        // Ctrl + S -> Save Project
                        ProjectManager.saveProject();
                        e.preventDefault();
                        break;

                    case 'a':
                         // Ctrl + A -> Select All
                         if (store.selectAll) {
                             store.selectAll();
                             e.preventDefault();
                         }
                         break;

                    case 'c':
                        clipboard.copy();
                        e.preventDefault();
                        break;
                    case 'v':
                        clipboard.paste();
                        e.preventDefault();
                        break;
                    case 'x':
                        clipboard.cut();
                        e.preventDefault();
                        break;
                }
            } else {
                switch(e.key) {
                    case 'Delete':
                    case 'Backspace':
                         // Delete Selected
                         clipboard.deleteSelected();
                         break;
                    case 'Escape':
                        // Clear Selection
                        store.clearSelection();
                        break;
                }
            }
        });
    }

    private isInputFocused(e: KeyboardEvent): boolean {
        const target = e.target as HTMLElement;
        return (
            target instanceof HTMLInputElement || 
            target instanceof HTMLTextAreaElement || 
            target.isContentEditable
        );
    }
}

export const instance = new ShortcutManager();
