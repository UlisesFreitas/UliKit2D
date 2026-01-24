import { getFileSystem } from '../../api/FileSystem';
import { useProjectSettingsStore } from '../../stores/useProjectSettingsStore';

const SETTINGS_FILENAME = 'ulikit.project';

export class ProjectSettingsManager {
    
    static async loadSettings(projectPathOrHandle?: string | FileSystemDirectoryHandle | null) {
         const store = useProjectSettingsStore();
         const fs = getFileSystem();
         console.log('[ProjectSettingsManager] Loading settings...');
         
         try {
             let content = '';
             
             if (typeof projectPathOrHandle === 'string') {
                 const isElectron = (fs as any).isElectron;
                 
                 if (isElectron) {
                     // Electron: Join path
                     const root = projectPathOrHandle.replace(/\\/g, '/');
                     const path = `${root}/${SETTINGS_FILENAME}`;
                     try {
                         content = await fs.readFile(path);
                     } catch (e) {
                         console.log('Settings file not found at', path);
                     }
                 } else {
                     // Web: use relative filename (FS handles context)
                      try {
                         content = await fs.readFile(SETTINGS_FILENAME);
                     } catch (e) {
                         console.log('Settings file not found (Web)');
                     }
                 }
             } else {
                 // Web: try reading direct file
                 // Assumes FS context is set
                 try {
                    content = await fs.readFile(SETTINGS_FILENAME);
                 } catch (e) {
                     console.log('Settings file not found (Web)');
                 }
             }

             if (content) {
                 const json = JSON.parse(content);
                 store.setSettings(json);
                 console.log('[ProjectSettingsManager] Settings loaded.');
             } else {
                 console.log('[ProjectSettingsManager] Creating default settings.');
                 await this.saveSettings(projectPathOrHandle);
             }
             
         } catch (e) {
             console.error('[ProjectSettingsManager] Failed to load settings:', e);
             store.resetDefaults();
         }
    }

    static async saveSettings(projectPathOrHandle?: string | FileSystemDirectoryHandle | null) {
        const store = useProjectSettingsStore();
        const fs = getFileSystem();
        console.log('[ProjectSettingsManager] Saving settings...');
        
        try {
            const json = JSON.stringify(store.settings, null, 2);
            let path = SETTINGS_FILENAME;

        if (typeof projectPathOrHandle === 'string') {
            const isElectron = (fs as any).isElectron;
            
            if (isElectron) {
                const root = projectPathOrHandle.replace(/\\/g, '/');
                path = `${root}/${SETTINGS_FILENAME}`;
            } else {
                 // Web: rely on FS context, do not double-prefix
                path = SETTINGS_FILENAME;
            }
        }
            
            // For Web (Handle), we rely on current project context in FS, or we just write?
            // If projectPathOrHandle is generic handle, writeFile might behave differently if not handled 
            // but standard API usually takes string path.
            // If WebFileSystem wrapper handles 'ulikit.project' by writing to root handle, this works.
            
            await fs.writeFile(path, json);
            console.log('[ProjectSettingsManager] Settings saved to', path);
            store.isDirty = false;
        } catch (e) {
             console.error('[ProjectSettingsManager] Error saving settings:', e);
        }
    }
}
