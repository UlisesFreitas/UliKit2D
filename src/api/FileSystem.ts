
export interface FileEntry {
    name: string;
    type: 'file' | 'directory';
    path: string; // Absolute path or relative path from project root
}

export interface FileChangeEvent {
    event: 'add' | 'addDir' | 'unlink' | 'unlinkDir' | 'change' | 'initial';
    path: string;
    fullPath?: string;
    files?: FileEntry[];
}

export interface IFileSystem {
    // Project Management
    selectFolder(): Promise<string | FileSystemDirectoryHandle | null>;
    openProject(pathOrHandle: string): Promise<void>;
    createProject(pathOrHandle: string | FileSystemDirectoryHandle): Promise<{success: boolean, error?: string}>;
    
    // Watcher (returns cleanup function)
    watchProject(pathOrHandle: string | FileSystemDirectoryHandle, onEvent: (event: FileChangeEvent) => void): Promise<() => void>;
    
    // Generic File I/O
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string | Blob | Uint8Array): Promise<boolean>;
    deleteFile(path: string): Promise<boolean>;
    rename(oldPath: string, newPath: string): Promise<boolean>;
    readdir(path: string): Promise<FileEntry[]>;
    createFolder(path: string): Promise<boolean>;
    
    // Asset Management
    importFile(sourcePath: string, destDir: string, customFilename?: string): Promise<{success: boolean, path?: string, error?: string}>;
    getPathForFile(file: File): string;
    showItemInFolder(path: string): Promise<void>;

    // Native Dialogs
    openFileDialog(filters: {name: string, extensions: string[]}[]): Promise<string | null>;
    saveFileDialog(filters: {name: string, extensions: string[]}[]): Promise<string | null>;

    // Helper for rendering and scripting
    getAssetURL(relPath: string): Promise<string>;
    
    // Helper to check if it's electron
    isElectron: boolean;
}

// We will export a setter for the instance to avoid circular imports
let instance: IFileSystem | null = null;

export function setFileSystem(fs: IFileSystem) {
    instance = fs;
}

import { ElectronFileSystem } from './ElectronFileSystem';
import { WebFileSystem } from './WebFileSystem';

export function getFileSystem(): IFileSystem {
    if (!instance) {
        if ((window as any).electronAPI) {
            instance = new ElectronFileSystem();
        } else {
            instance = new WebFileSystem();
        }
    }
    return instance;
}
