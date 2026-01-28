import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import { instance as engine } from '../engine/core/Engine';
import { TextureStyle } from 'pixi.js';
import { eventBus } from '../engine/core/EventBus';

export interface IProjectSettings {
    general: {
        title: string;
        version: string;
        company: string;
    };
    display: {
        width: number;
        height: number;
        fullscreen: boolean;
        pixelArt: boolean; // false = linear, true = nearest
        backgroundColor: string;
    };
    physics: {
        gravity: { x: number; y: number };
        debugDraw: boolean;
        layerCollisionMatrix: Record<number, number>; // Index -> Bitmask
    };
    tags: string[];
    layers: string[]; // Ordered array: Index = Layer ID
    layouts: Record<string, any>;
    editor: {
        historyMaxSteps: number;
        historyMaxBytes: number;
    };
    input: {
        actions: Record<string, string[]>;
        axes: Record<string, { negative: string; positive: string; altNegative?: string; altPositive?: string; gravity: number; sensitivity: number; dead: number }>;
    };
    time: {
        fixedTimestep: number;
        maxAllowedTimestep: number;
        timeScale: number;
    };
    audio: {
        masterVolume: number;
        channels: Record<string, { volume: number; muted: boolean }>;
    };
}

const DEFAULT_SETTINGS: IProjectSettings = {
    general: {
        title: 'New Game',
        version: '0.0.1',
        company: 'Indie Dev'
    },
    display: {
        width: 1280,
        height: 720,
        fullscreen: false,
        pixelArt: true,
        backgroundColor: '#252526' // Matches 'dark_modern' --bg-panel
    },
    physics: {
        gravity: { x: 0, y: 9.81 },
        debugDraw: false,
        layerCollisionMatrix: {} // Will be auto-populated
    },
    input: {
        actions: {
            'Jump': ['Space', 'Enter'],
            'Fire': ['KeyZ', 'MouseLeft']
        },
        axes: {
            'Horizontal': { negative: 'ArrowLeft', positive: 'ArrowRight', altNegative: 'KeyA', altPositive: 'KeyD', gravity: 3, sensitivity: 3, dead: 0.001 },
            'Vertical': { negative: 'ArrowUp', positive: 'ArrowDown', altNegative: 'KeyW', altPositive: 'KeyS', gravity: 3, sensitivity: 3, dead: 0.001 }
        }
    },
    time: {
        fixedTimestep: 0.02, // 50hz
        maxAllowedTimestep: 0.1, // Avoid spiraling
        timeScale: 1.0
    },
    audio: {
        masterVolume: 1.0,
        channels: {
            'Music': { volume: 1.0, muted: false },
            'SFX': { volume: 1.0, muted: false }
        }
    },
    tags: ['Player', 'Enemy', 'Ground'],
    layers: [
        'Base Layer',  // 0: Immortal/Bottom
        'Ground',      // 1
        'Objects',     // 2
        '', '', '', '', '', '', '', // 3-9
        'Player',      // 10
        '', '', '', '', '', '', '', '', '', // 11-19
        '', '', '', '', '', '', '', '', '', '', // 20-29
        'Particles',   // 30
        'UI'           // 31: Top Most
    ],
    layouts: {},
    editor: {
        historyMaxSteps: 50,
        historyMaxBytes: 10485760 // 10MB
    }
};

export const useProjectSettingsStore = defineStore('projectSettings', () => {
    
    // State
    const settings = reactive<IProjectSettings>(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
    const isDirty = ref(false);

    // Engine Hooks
    const applySettings = async () => {
        // console.log('[ProjectSettings] applySettings()', settings.physics.layerCollisionMatrix);
        
        // 1. Display Settings
        TextureStyle.defaultOptions.scaleMode = settings.display.pixelArt ? 'nearest' : 'linear';

        // 2. Engine Runtime Updates
        if (engine && engine.app && engine.app.renderer) {
             // Background Color
             try {
                engine.app.renderer.background.color = settings.display.backgroundColor;
             } catch (e) {
                 console.warn('[ProjectSettings] Failed to set background color:', e);
             }

             // Update Physics
             let physics: any = undefined;
             if ((engine as any).getPhysics) {
                 physics = (engine as any).getPhysics();
             } else {
                 physics = (engine as any).physicsSystem || (engine as any)._physicsSystem;
             }
             
             try {
                 // CRITICAL: Sync Layers to SceneManager (Integer Lookup)
                 const { SceneManager } = await import('../engine/managers/SceneManager');
                 if (SceneManager) {
                     SceneManager.setProjectLayers(settings.layers);
                 }
             } catch (e) {
                 console.error('[ProjectSettings] Failed to import/sync SceneManager:', e);
             }

             // Check for 'world' (via getter) OR 'engine.world'
             const world = physics?.world || physics?.engine?.world;

             if (physics && world) {
                  world.gravity.x = settings.physics.gravity.x;
                  world.gravity.y = settings.physics.gravity.y;
                  
                  // Update Collision Matrix
                  if (physics.updateCollisionConfig) {
                      physics.updateCollisionConfig(settings.layers, settings.physics.layerCollisionMatrix);
                  }
             }

             // Input Config
             engine.configureInput(settings.input);
             
             // ... (Time/Audio omitted for brevity) ...
              // Time Config (New)
             if ((engine as any).setTimeSettings) {
                 (engine as any).setTimeSettings(settings.time);
             } else {
                 (engine as any).timeScale = settings.time.timeScale;
             }

             // Audio Config (New)
             if ((engine as any).audioSystem) {
                 (engine as any).audioSystem.setSettings(settings.audio);
             }
        }
        
        console.log(`[ProjectSettings] Settings applied.`);
    };
    
    // Deep Merge Helper
    const deepMerge = (target: any, source: any) => {
        if (!source) return target;
        for (const key of Object.keys(source)) {
            const val = source[key];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                deepMerge(target[key], val);
            } else {
                target[key] = val;
            }
        }
        return target;
    };

    // Actions
    const setSettings = async (newSettings: IProjectSettings) => {
        // Deep merge to preserve defaults/structure
        deepMerge(settings, newSettings);
        isDirty.value = false;
        await applySettings();
    };

    const updateSetting = <K extends keyof IProjectSettings>(category: K, value: IProjectSettings[K]) => {
        settings[category] = value;
        isDirty.value = true;
    };

    const resetDefaults = () => {
        Object.assign(settings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
        isDirty.value = true;
    };

    // Event Listeners for Dynamic Layer Updates
    eventBus.on('scene-loaded', () => {
        // Wait one tick for SceneManager to fully settle if needed, but usually synchronous
        setTimeout(() => applySettings(), 0);
    });
    
    eventBus.on('layer-update', () => {
        applySettings();
    });

    // Helper: Save Mechanism (Dynamic Import to avoid cycles)
    const saveToManifest = async () => {
        try {
            const { projectState } = await import('../editor/managers/ProjectManager');
            const { ProjectManifestManager } = await import('../editor/managers/ProjectManifestManager');
            
            let path = 'project.json'; 
            if (projectState.currentProjectPath && typeof projectState.currentProjectPath === 'string') {
                 path = projectState.currentProjectPath;
            }
             
             await ProjectManifestManager.saveProject(path);
             console.log('[ProjectSettings] Auto-saved manifest for layer changes.');
        } catch (e) {
            console.error('[ProjectSettings] Failed to auto-save manifest:', e);
        }
    };

    return {
        settings,
        isDirty,
        setSettings,
        updateSetting,
        applySettings,
        resetDefaults,
        
        // Layer Actions (Centralized Logic - Async & Persistent)
        addLayer: async (name: string) => {
            settings.layers.push(name);
            isDirty.value = true;
            await applySettings();
            await saveToManifest();
            eventBus.emit('layer-update');
        },
        removeLayer: async (index: number) => {
            if (index >= 0 && index < settings.layers.length) {
                settings.layers.splice(index, 1);
                isDirty.value = true;
                await applySettings();
                await saveToManifest();
                eventBus.emit('layer-update');
            }
        },
        renameLayer: async (index: number, newName: string) => {
             if (index >= 0 && index < settings.layers.length) {
                settings.layers[index] = newName;
                isDirty.value = true;
                await applySettings();
                await saveToManifest();
                eventBus.emit('layer-update');
            }
        },
        reorderLayers: async (newLayers: string[]) => {
            settings.layers = newLayers;
            isDirty.value = true;
            await applySettings();
            await saveToManifest();
            eventBus.emit('layer-update');
        }
    };
});
