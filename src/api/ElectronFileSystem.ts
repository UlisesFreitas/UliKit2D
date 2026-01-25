
import type { IFileSystem, FileEntry, FileChangeEvent } from './FileSystem';
import { projectState } from '../editor/managers/ProjectManager';

export class ElectronFileSystem implements IFileSystem {
    public isElectron = true;
    private electronAPI = (window as any).electronAPI;

    async selectFolder(): Promise<string | null> {
        return await this.electronAPI.selectFolder();
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
        
        // 2. Handle Absolute Paths (Windows Drive Letter)
        if (/^[a-zA-Z]:\//.test(texturePath)) {
            // Use file:// protocol for Electron (requires webSecurity: false)
            return encodeURI('file:///' + texturePath);
        }
        
        // 3. Handle Already Prefixed Paths
        if (texturePath.startsWith('file://')) {
            return encodeURI(texturePath);
        }

        // 4. Handle Relative Paths (Project Assets)
        if (projectState.currentProjectPath && typeof projectState.currentProjectPath === 'string') {
            const projectRoot = projectState.currentProjectPath.replace(/\\/g, '/');
            // Remove leading slash if present in relative path
            const cleanRelPath = texturePath.startsWith('/') ? texturePath.slice(1) : texturePath;
            
            // Construct full path: file:/// + ProjectRoot + / + RelativePath
            return encodeURI(`file:///${projectRoot}/${cleanRelPath}`);
        }

        // Fallback
        return encodeURI(texturePath);
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
            const text = await content.text();
            return await this.electronAPI.writeFile(this.resolvePath(path), text);
        }
        return await this.electronAPI.writeFile(this.resolvePath(path), content as string);
    }

    async deleteFile(path: string): Promise<boolean> {
        return await this.electronAPI.deleteFile(this.resolvePath(path));
    }

    async renameFile(oldPath: string, newPath: string): Promise<boolean> {
        return await this.electronAPI.renameFile(this.resolvePath(oldPath), this.resolvePath(newPath));
    }

    async readdir(path: string): Promise<FileEntry[]> {
        return await this.electronAPI.readdir(this.resolvePath(path));
    }

    // Asset Management
    async importFile(sourcePath: string, destDir: string, customFilename?: string): Promise<{success: boolean, path?: string, error?: string}> {
        return await this.electronAPI.importFile(sourcePath, destDir, customFilename);
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
