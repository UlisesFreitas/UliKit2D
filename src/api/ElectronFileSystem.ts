
import type { IFileSystem, FileEntry, FileChangeEvent } from './FileSystem';
import { projectState } from '../editor/managers/ProjectManager';

export class ElectronFileSystem implements IFileSystem {
    public isElectron = true;
    private electronAPI = (window as any).electronAPI;

    async selectFolder(): Promise<string | null> {
        return await this.electronAPI.selectFolder();
    }

    async createProject(path: string): Promise<{ success: boolean; error?: string }> {
        return await this.electronAPI.createProject(path);
    }

    async getAssetURL(relPath: string): Promise<string> {
        // 1. Normalize slashes
        let texturePath = relPath.replace(/\\/g, '/');
        
        // 2. Handle Absolute Paths (Windows Drive Letter)
        if (/^[a-zA-Z]:\//.test(texturePath)) {
            // Already absolute, wrap in /@fs/ and encode
            return encodeURI('/@fs/' + texturePath);
        }
        
        // 3. Handle Already Prefixed Paths
        if (texturePath.startsWith('/@fs/')) {
            // Ensure encoded but avoid double encoding if already encoded? 
            // Better to assume raw and encode. decodeURI first safely?
            // For now, let's assume we receive raw paths mostly.
            return encodeURI(texturePath);
        }

        // 4. Handle Relative Paths (Project Assets)
        if (projectState.currentProjectPath && typeof projectState.currentProjectPath === 'string') {
            const projectRoot = projectState.currentProjectPath.replace(/\\/g, '/');
            // Remove leading slash if present in relative path
            const cleanRelPath = texturePath.startsWith('/') ? texturePath.slice(1) : texturePath;
            
            // Construct full path: /@fs/ + ProjectRoot + / + RelativePath
            return encodeURI(`/@fs/${projectRoot}/${cleanRelPath}`);
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

    async readFile(path: string): Promise<string> {
        return await this.electronAPI.readFile(path);
    }

    async writeFile(path: string, content: string | Blob | Uint8Array): Promise<boolean> {
        if (content instanceof Blob) {
            const text = await content.text();
            return await this.electronAPI.writeFile(path, text);
        }
        return await this.electronAPI.writeFile(path, content as string);
    }

    async readdir(path: string): Promise<FileEntry[]> {
        return await this.electronAPI.readdir(path);
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
