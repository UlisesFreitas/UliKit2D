
import type { IFileSystem, FileEntry, FileChangeEvent } from './FileSystem';
import { projectState } from '../editor/managers/ProjectManager';

export class ElectronFileSystem implements IFileSystem {
    public isElectron = true;
    private electronAPI = (window as any).electronAPI;

    async selectFolder(): Promise<string | null> {
        return await this.electronAPI.selectFolder();
    }

    async openProject(path: string): Promise<void> {
        // Electron handles context via absolute paths in ProjectManager, but we can log for debugging.
        console.log('[ElectronFileSystem] Opening project context:', path);
    }

    async createProject(path: string): Promise<{ success: boolean; error?: string }> {
        try {
            // 1. Create Directories via IPC
           const result = await this.electronAPI.createProject(path); // This creates the root, assets, imported, and scenes
           if (!result.success) return result;
           
           // Resolve project path for usage (Ensure normalized)
           const projectRoot = path.replace(/\\/g, '/');

           // Ensure assets/scenes directory exists (Redundant if main.ts does it, but safe)
           await this.electronAPI.writeFile(`${projectRoot}/assets/scenes/.gitkeep`, '');
           
           // 2. Copy Default Assets
           // Handled by Main Process (ipcMain.handle('project:create'))
           // We do NOT need to do it here. 
           
           // Resolve project path for usage
           // const projectRoot = path; // Already declared at the top of try block

           
           // 3. Create project.json is handled by Main
            
           return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async getAssetURL(relPath: string): Promise<string> {
        // 1. Direct Return for Protocols
        if (relPath.startsWith('http:') || relPath.startsWith('https:') || relPath.startsWith('blob:') || relPath.startsWith('data:')) {
            return relPath;
        }

        // 2. Normalize slashes
        let texturePath = relPath.replace(/\\/g, '/');
        
        // Helper to safe encode: use encodeURI but patch characters that break URLs (#, ?)
        const safeEncode = (p: string) => {
             return encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F');
        };

        let finalUrl = '';

        // 2. Handle Absolute Paths (Windows Drive Letter)
        if (/^[a-zA-Z]:\//.test(texturePath)) {
            finalUrl = 'asset:///' + safeEncode(texturePath);
        }
        
        // 3. Handle Already Prefixed Paths
        else if (texturePath.startsWith('file://')) {
            finalUrl = texturePath.replace('file://', 'asset://');
        }

        // 4. Handle Relative Paths (Project Assets)
        else if (projectState.currentProjectPath && typeof projectState.currentProjectPath === 'string') {
            const projectRoot = projectState.currentProjectPath.replace(/\\/g, '/');
            // Remove leading slash if present in relative path
            const cleanRelPath = texturePath.startsWith('/') ? texturePath.slice(1) : texturePath;
            
            // Construct full path: asset:/// + ProjectRoot + / + RelativePath
            finalUrl = `asset:///${safeEncode(projectRoot)}/${safeEncode(cleanRelPath)}`;
        } else {
            // Fallback
             finalUrl = 'asset:///' + safeEncode(texturePath);
        }
        
        return finalUrl;
    }

    async watchProject(path: string, onEvent: (event: FileChangeEvent) => void): Promise<() => void> {
        await this.electronAPI.watchProject(path);
        
        const listener = (_event: any, data: FileChangeEvent) => {
            onEvent(data);
        };
        
        this.electronAPI.onFileEvent(listener);
        
        return () => {
            // cleanup if needed
        };
    }

    private resolvePath(p: string): string {
        if (!projectState.currentProjectPath) return p;
        // If already absolute (Windows), return it
        if (/^[a-zA-Z]:\\/.test(p) || /^[a-zA-Z]:\//.test(p)) return p;
        
        // If it starts with /@fs/, it's a special internal URL, but for FS ops we likely need real path.
        // But usually we get simple 'assets/scenes/foo.json' here.
        
        // Simple join using forward slashes for consistency if needed, but Electron runs on Node.
        // Using string concatenation to avoid importing 'path' (browser compatible file).
        // But this is ElectronFileSystem, it has Node access via IPC, but here we are in Renderer.
        // We can't import 'path' in Renderer easily without polyfill.
        // Let's assume passed paths are standardized or use simple logic.
        
        const cleanProject = (projectState.currentProjectPath as string).replace(/\\/g, '/');
        const cleanPath = p.replace(/\\/g, '/');
        
        const result = `${cleanProject}/${cleanPath}`;
        // console.log(`[ElectronFileSystem] resolvePath: '${p}' -> '${result}'`); // Reduced spam
        return result;
    }

    async readFile(path: string): Promise<string> {
        return await this.electronAPI.readFile(this.resolvePath(path));
    }

    async writeFile(path: string, content: string | Blob | Uint8Array): Promise<boolean> {
        if (content instanceof Blob) {
             // For standard text Blobs, or convert to buffer if binary?
             // Assuming ProjectFactory handles binary-to-buffer conversion now.
             // If we get a blob here, it might be safer to convert to ArrayBuffer then Uint8Array
             const buf = await content.arrayBuffer();
             return await this.electronAPI.writeFile(this.resolvePath(path), new Uint8Array(buf));
        }
        return await this.electronAPI.writeFile(this.resolvePath(path), content);
    }

    async deleteFile(path: string): Promise<boolean> {
        return await this.electronAPI.deleteFile(this.resolvePath(path));
    }

    async readdir(path: string): Promise<FileEntry[]> {
        return await this.electronAPI.readdir(this.resolvePath(path));
    }

    async createFolder(path: string): Promise<boolean> {
        return await this.electronAPI.createFolder(this.resolvePath(path));
    }

    async rename(oldPath: string, newPath: string): Promise<boolean> {
         return await this.electronAPI.renameFile(this.resolvePath(oldPath), this.resolvePath(newPath));
    }

    // Asset Management
    async importFile(sourcePath: string, destDir: string, customFilename?: string): Promise<{success: boolean, path?: string, error?: string}> {
        // Resolve absolute destination path to ensure file is copied to project folder, not CWD
        let finalDestDir = destDir;
        if (projectState.currentProjectPath && typeof projectState.currentProjectPath === 'string') {
             // If relative (no drive letter)
             if (!/^[a-zA-Z]:/.test(destDir) && !destDir.startsWith('/')) {
                  const projectRoot = projectState.currentProjectPath.replace(/\\/g, '/');
                  finalDestDir = `${projectRoot}/${destDir}`;
             }
        }
        return await this.electronAPI.importFile(sourcePath, finalDestDir, customFilename);
    }

    getPathForFile(file: File): string {
        return this.electronAPI.getPathForFile(file);
    }

    async showItemInFolder(path: string): Promise<void> {
        await this.electronAPI.showItemInFolder(path);
    }

    // Native Dialogs
    async openFileDialog(filters: {name: string, extensions: string[]}[]): Promise<string | null> {
        return await this.electronAPI.openFile(filters);
    }

    async saveFileDialog(filters: {name: string, extensions: string[]}[]): Promise<string | null> {
        return await this.electronAPI.saveFile(filters);
    }
}
