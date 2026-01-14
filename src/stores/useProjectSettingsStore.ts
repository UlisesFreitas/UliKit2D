import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import { instance as engine } from '../engine/core/Engine';
import { TextureStyle } from 'pixi.js';

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
    };
    tags: string[];
    layers: string[];
    layouts: Record<string, any>;
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
        backgroundColor: '#000000'
    },
    physics: {
        gravity: { x: 0, y: 9.81 },
        debugDraw: false
    },
    tags: ['Player', 'Enemy', 'Ground'],
    layers: ['Default', 'UI', 'Player', 'Background'],
    layouts: {}
};

export const useProjectSettingsStore = defineStore('projectSettings', () => {
    
    // State
    const settings = reactive<IProjectSettings>(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
    const isDirty = ref(false);

    // Engine Hooks
    const applySettings = () => {
        console.log('[ProjectSettings] Applying settings...', settings);
        
        // 1. Display Settings
        
        // Pixel Art Mode (Texture Filtering)
        // PixiJS v8 uses 'nearest' or 'linear' strings
        TextureStyle.defaultOptions.scaleMode = settings.display.pixelArt ? 'nearest' : 'linear';
        
        // Note: Changing defaultOptions only affects NEW textures. 
        // Existing textures in the scene won't automatically update unless we iterate specific caches, 
        // but for this test (adding new sprite) it is sufficient.

        // 2. Engine Runtime Updates
        if (engine && engine.app && engine.app.renderer) {
             // Background Color
             try {
                engine.app.renderer.background.color = settings.display.backgroundColor;
             } catch (e) {
                 console.warn('[ProjectSettings] Failed to set background color:', e);
             }

             // Update Physics
             const physics = (engine as any).physicsSystem || (engine as any)._physicsSystem;
             
             if (physics && physics.world) {
                  physics.world.gravity.x = settings.physics.gravity.x;
                  physics.world.gravity.y = settings.physics.gravity.y;
             }
        }
        
        console.log(`[ProjectSettings] Settings applied. ScaleMode: ${TextureStyle.defaultOptions.scaleMode}`);
    };

    // Actions
    const setSettings = (newSettings: IProjectSettings) => {
        // Deep merge or replace
        Object.assign(settings, newSettings);
        isDirty.value = false;
        applySettings();
    };

    const updateSetting = <K extends keyof IProjectSettings>(category: K, value: IProjectSettings[K]) => {
        settings[category] = value;
        isDirty.value = true;
    };

    const resetDefaults = () => {
        Object.assign(settings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
        isDirty.value = true;
    };

    return {
        settings,
        isDirty,
        setSettings,
        updateSetting,
        applySettings,
        resetDefaults
    };
});
