import { reactive, ref, type Ref } from 'vue';
import { getFileSystem } from '../../api/FileSystem';
import darkTheme from '../themes/dark_modern.json';
import lightTheme from '../themes/light_modern.json';

export interface Theme {
    name: string;
    type?: string;
    colors: Record<string, string>;
}

class ThemeManagerClass {
    public currentTheme: Ref<Theme> = ref(darkTheme);
    public availableThemes = reactive<Theme[]>([darkTheme, lightTheme]);

    constructor() {
        console.log('[ThemeManager] Initializing. Default Theme:', darkTheme);
        if (!this.currentTheme.value) {
            console.error('[ThemeManager] Default theme is undefined! Using fallback.');
            this.currentTheme.value = {
                name: 'Fallback',
                type: 'dark',
                colors: {}
            };
        }
        this.applyTheme(this.currentTheme.value);
    }

    public applyTheme(theme: Theme) {
        console.log('Applying Theme:', theme.name, theme.colors);
        this.currentTheme.value = theme;
        const root = document.documentElement;
        for (const [key, value] of Object.entries(theme.colors)) {
            root.style.setProperty(key, value);
        }
    }
    
    public async importTheme() {
        const fs = getFileSystem();
        
        try {
            const path = await fs.openFileDialog([{ name: 'UliKit Theme', extensions: ['json'] }]);
            if (!path) return;
            
            let content = '';
            if (path.startsWith('blob:')) {
                // Browser handled file
                const response = await fetch(path);
                content = await response.text();
            } else {
                content = await fs.readFile(path);
            }
            
            const theme = JSON.parse(content);
            
            // Basic Validation
            if (!theme.name || !theme.colors) {
                alert('Invalid Theme File');
                return;
            }
            
            // Check if exists
            const existing = this.availableThemes.find(t => t.name === theme.name);
            if (!existing) {
                this.availableThemes.push(theme);
            } else {
                Object.assign(existing, theme);
            }
            
            this.applyTheme(theme);
            console.log('Imported Theme:', theme.name);
        } catch(e) {
            console.error('Failed to import theme', e);
            alert('Failed to import theme');
        }
    }

    public async exportTheme(theme: Theme) {
        const fs = getFileSystem();
        
        try {
            const filename = theme.name.toLowerCase().replace(/\s+/g, '_') + '.json';
            const path = await fs.saveFileDialog([{ name: 'UliKit Theme', extensions: ['json'] }]);
             
            if (!path) return;
            
            if (path === 'web-save-dialog') {
                // Handle Browser Download
                const blob = new Blob([JSON.stringify(theme, null, 4)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                await fs.writeFile(path, JSON.stringify(theme, null, 4));
            }
            console.log('Exported Theme to:', path);
        } catch (e) {
             console.error('Failed to export theme', e);
             alert('Failed to export theme');
        }
    }
}

export const ThemeManager = new ThemeManagerClass();
