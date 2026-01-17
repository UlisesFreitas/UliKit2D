import { defineStore } from 'pinia';
import { ref } from 'vue';
import { CommandManager } from '../editor/commands/CommandManager';
import type { ICommand } from '../editor/commands/ICommand';
import { world } from '../engine/ecs/ECS';
import { SceneManager } from '../engine/managers/SceneManager';
import { instance as engine } from '../engine/core/Engine';

export const useEditorStore = defineStore('editor', () => {
    // Selection
    const selectedEntityId = ref<string | null>(null);
    const selectedEntityIds = ref<string[]>([]); // Multi-selection support

    // Command System
    const commandManager = new CommandManager();

    // Actions
    const selectEntity = (id: string | null) => {
        selectedEntityId.value = id;
        selectedEntityIds.value = id ? [id] : [];
    };

    const selectEntities = (ids: string[]) => {
        selectedEntityIds.value = ids;
        // Primary selection is the first one (or last one? Usually last selected is active).
        // Let's say first one for now.
        selectedEntityId.value = (ids.length > 0 && ids[0]) ? ids[0] : null; 
    };

    const executeCommand = (command: ICommand) => {
        commandManager.execute(command);
    };

    const undo = () => commandManager.undo();
    const redo = () => commandManager.redo();
    
    // Game State
    const isPlaying = ref(false);
    const sceneBackup = ref<string | null>(null);

    const playGame = () => {
        if (isPlaying.value) return;
        
        console.log('[EditorStore] Starting Game...');
        // Backup Scene
        const backup = SceneManager.saveScene();
        sceneBackup.value = backup;
        console.log(`[EditorStore] Scene Saved. Backup size: ${sceneBackup.value.length}`);
        
        isPlaying.value = true;
        // Start Simulation (Physics + Scripts)
        engine.startSimulation();
    };

    const stopGame = () => {
        if (!isPlaying.value) return;

        console.log('[EditorStore] Stopping Game...');
        isPlaying.value = false;
        
        // Stop Simulation
        engine.stopSimulation();
        
        // Restore Scene
        if (sceneBackup.value) {
            console.log('[EditorStore] Restoring Scene...');
            try {
                SceneManager.loadScene(sceneBackup.value);
                console.log('[EditorStore] Scene Restored.');
            } catch (e) {
                console.error('[EditorStore] Failed to restore scene!', e);
            }
            sceneBackup.value = null;
        } else {
            console.warn('[EditorStore] No backup found to restore!');
        }
    };
    
    // Clipboard
    const clipboardData = ref<any | null>(null);

    // View State
    const zoomLevel = ref(1);
    
    const setZoom = (value: number) => {
        // Clamp between 0.1 and 10
        zoomLevel.value = Math.max(0.1, Math.min(value, 64));
    };

    const zoomIn = () => setZoom(zoomLevel.value + 0.1);
    const zoomOut = () => setZoom(zoomLevel.value - 0.1);
    const resetZoom = () => setZoom(1);

    // Theme State
    const theme = ref<'dark' | 'light'>('dark');
    const toggleTheme = () => {
         theme.value = theme.value === 'dark' ? 'light' : 'dark';
         if (theme.value === 'light') {
             document.documentElement.classList.add('light-theme');
             document.documentElement.classList.remove('dark-theme');
         } else {
             document.documentElement.classList.add('dark-theme');
             document.documentElement.classList.remove('light-theme');
         }
    };

    const copy = () => {
        if (!selectedEntityId.value) return;
        
        const entity = world.where(e => e.id === selectedEntityId.value).first;
        if (entity) {
             // Deep Clone & strip runtime data
             const data = {
                 name: entity.name,
                 transform: { ...entity.transform }, // Clone transform
                 sprite: entity.sprite ? { ...entity.sprite } : undefined,
                 rigidBody: entity.rigidBody ? { ...entity.rigidBody } : undefined,
                 boxCollider: entity.boxCollider ? { ...entity.boxCollider } : undefined,
                 circleCollider: entity.circleCollider ? { ...entity.circleCollider } : undefined,
                 camera: entity.camera ? { ...entity.camera } : undefined,
                 audioSource: entity.audioSource ? { ...entity.audioSource } : undefined,
                 label: entity.label ? { ...entity.label } : undefined,
                 bitmapText: entity.bitmapText ? { ...entity.bitmapText } : undefined,
                 nineSliceSprite: entity.nineSliceSprite ? { ...entity.nineSliceSprite } : undefined,
                 polygonCollider: entity.polygonCollider ? { ...entity.polygonCollider } : undefined,
                 animator: entity.animator ? JSON.parse(JSON.stringify(entity.animator)) : undefined,
                 script: entity.script && Array.isArray(entity.script) ? entity.script.map(s => ({...s})) : undefined
             };
             clipboardData.value = data;
             console.log('Copied Entity', data);
        }
    };

    const paste = () => {
        if (!clipboardData.value) return;
        
        const data = clipboardData.value;
        // Create new ID
        const newId = crypto.randomUUID();
        
        // Offset position slightly
        const newTransform = { ...data.transform };
        if (newTransform) {
            newTransform.x += 20;
            newTransform.y += 20;
        }

        world.add({
            id: newId,
            ...data,
            name: `${data.name} (Copy)`,
            transform: newTransform
        });
        
        // Select the new entity
        // selectEntity(newId);
    };

    // Layer Selection
    const activeLayerId = ref<string>('Base Layer');
    const selectLayer = (id: string) => {
        activeLayerId.value = id;
    };

    return {
        selectedEntityId,
        selectedEntityIds,
        selectEntity,
        selectEntities,
        activeLayerId,
        selectLayer,
        commandManager,
        executeCommand,
        undo,
        redo,
        canUndo: commandManager.canUndo,
        canRedo: commandManager.canRedo,
        copy,
        paste,
        clipboardData,
        playGame,
        stopGame,
        isPlaying,
        zoomLevel,
        setZoom,
        zoomIn,
        zoomOut,
        resetZoom,
        theme,
        toggleTheme
    };
});
