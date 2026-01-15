import { defineStore } from 'pinia';
import { reactive, watch } from 'vue';

export const usePreferencesStore = defineStore('preferences', () => {
    // Grid Settings
    const grid = reactive({
        visible: true,
        width: 32,
        height: 32,
        color: '#7ad3ff',
        offsetX: 0,
        offsetY: 0,
        isIsometric: false
    });

    // Panel Visibility (Placeholder for DockLayout integration)
    const panels = reactive<Record<string, boolean>>({});

    // Persistence Logic
    const loadPreferences = () => {
        const saved = localStorage.getItem('editor_preferences');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                
                // Merge Grid Settings
                if (data.grid) {
                    Object.assign(grid, data.grid);
                }

                // Merge Panel Settings
                if (data.panels) {
                    Object.assign(panels, data.panels);
                }
            } catch (e) {
                console.error('[PreferencesStore] Failed to load preferences', e);
            }
        }
    };

    // Initialize Auto-Save
    watch([grid, panels], () => {
        localStorage.setItem('editor_preferences', JSON.stringify({ grid, panels }));
    }, { deep: true });

    // Initial Load
    loadPreferences();

    return {
        grid,
        panels
    };
});
