
import type { IFileSystem, FileEntry, FileChangeEvent } from './FileSystem';

// IndexedDB Schema (Simplistic)
// DB Name: UliKit2D_Projects
// Stores:
// - projects: { name, id (path) }
// - files: { project, path, content, type } -> Composite Index on [project, path]


export class WebFileSystem implements IFileSystem {
    public isElectron = false;
    private dbName = 'UliKit2D_Projects';
    private dbVersion = 1;
    private currentProject: string | null = null;
    private db: IDBDatabase | null = null;
    private watcherCallback: ((event: FileChangeEvent) => void) | null = null;

    constructor() {
        this.initDB();
    }

    private initDB(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error("IndexedDB error", request.error);
                reject(request.error); 
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('projects')) {
                    db.createObjectStore('projects', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('files')) {
                    const store = db.createObjectStore('files', { keyPath: 'key' }); // key = project + '::' + path
                    store.createIndex('project', 'project', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
            };
        });
    }

    async selectFolder(): Promise<string | null> {
         // Managing Web Projects Simulation
         // Since we can't open a system folder, we return a virtual project ID or ask user to create/select from a list (Modal needed later)
         // For now, let's auto-create or select a default "MyWebProject"
         return "MyWebProject"; 
    }

    async createProject(path: string): Promise<{ success: boolean; error?: string }> {
        if (!this.db) await this.initDB();
        
        this.currentProject = path;
        
        // 1. CLEAR existing data for this project to prevent corruption/nesting issues
        const txClear = this.db!.transaction(['files'], 'readwrite');
        const clearStore = txClear.objectStore('files');
        const clearIndex = clearStore.index('project');
        const clearReq = clearIndex.getAllKeys(path);
        
        await new Promise<void>((resolve) => {
            clearReq.onsuccess = () => {
                const keys = clearReq.result;
                let count = 0;
                if (keys.length === 0) {
                    resolve();
                    return;
                }
                keys.forEach(k => {
                    clearStore.delete(k).onsuccess = () => {
                        count++;
                        if (count === keys.length) resolve();
                    };
                });
            };
        });


        console.log('[WebFileSystem] Creating project:', path);
        
        // 1. Pre-fetch ALL default assets dynamically
        const loadedAssets: { name: string, blob: Blob }[] = [];
        const defaultAssets = import.meta.glob('../resources/default_assets/*.*', { query: '?url', import: 'default', eager: true });

        console.log('[WebFileSystem] Discovered default assets:', Object.keys(defaultAssets));

        await Promise.all(Object.entries(defaultAssets).map(async ([relativePath, url]) => {
            const fileName = relativePath.split('/').pop();
            if(!fileName) return;

            try {
                const response = await fetch(url as string);
                if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                const blob = await response.blob();
                console.log(`[WebFileSystem] Loaded ${fileName} (${blob.size} bytes, ${blob.type})`);
                loadedAssets.push({ name: fileName, blob });
            } catch (e) {
                console.error(`[WebFileSystem] Failed to load default asset: ${fileName}`, e);
            }
        }));

        // 2. Create New Data
        const tx = this.db!.transaction(['projects', 'files'], 'readwrite');
        const projects = tx.objectStore('projects');
        const files = tx.objectStore('files');
        
        projects.put({ id: path, name: path });

        // Create default project.json
        const projectJson = JSON.stringify({
            name: path,
            version: '1.0.0',
            params: {}
        }, null, 4);

        files.put({ 
            key: `${path}::project.json`, 
            project: path, 
            path: 'project.json', 
            content: projectJson, 
            type: 'file' 
        });
        
        // Write all loaded default assets
        for (const asset of loadedAssets) {
            files.put({
                key: `${path}::assets/${asset.name}`,
                project: path,
                path: `assets/${asset.name}`,
                content: asset.blob,
                type: 'file'
            });
        }

        // Explicitly create assets/imported folder
        files.put({
            key: `${path}::assets/imported`,
            project: path,
            path: 'assets/imported',
            content: null,
            type: 'directory'
        });

        return new Promise((resolve) => {
            tx.oncomplete = () => {
                console.log('[WebFileSystem] Transaction complete: Project created');
                resolve({ success: true });
            };
            tx.onerror = () => {
                console.error('[WebFileSystem] Transaction failed', tx.error);
                resolve({ success: false, error: tx.error?.message });
            };
        });
    }


    async watchProject(path: string, onEvent: (event: FileChangeEvent) => void): Promise<() => void> {
        this.currentProject = path;
        this.watcherCallback = onEvent;
        
        // Initial Scan - RECURSIVE (Store expects plain list of all files + directories)
        // We can't just use readdir('') because it's shallow.
        if (this.db) {
            const tx = this.db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const index = store.index('project');
            const request = index.getAll(this.currentProject);

            request.onsuccess = () => {
                const allFiles = request.result as any[];
                
                // We need to construct the full list of files AND implicit directories
                const finalEntries: FileEntry[] = [];
                const distinctDirs = new Set<string>();

                for (const file of allFiles) {
                     // Add the file itself
                     finalEntries.push({ name: file.path.split('/').pop()!, type: file.type, path: file.path });

                     // Infer directories
                     // e.g. "assets/foo/bar.png" -> add "assets", "assets/foo"
                     const parts = file.path.split('/');
                     if (parts.length > 1) {
                         let currentPath = "";
                         for (let i = 0; i < parts.length - 1; i++) {
                             const part = parts[i];
                             currentPath = currentPath ? `${currentPath}/${part}` : part;
                             if (!distinctDirs.has(currentPath)) {
                                 distinctDirs.add(currentPath);
                                 finalEntries.push({ 
                                     name: part, 
                                     type: 'directory', 
                                     path: currentPath 
                                 });
                             }
                         }
                     }
                }
                
                onEvent({ event: 'initial', path: '', files: finalEntries });
            };
        }
        
        return () => {
            this.watcherCallback = null;
        };
    }

    async readFile(path: string): Promise<string> {
        if (!this.db || !this.currentProject) throw new Error('No project');
        
        const key = `${this.currentProject}::${path}`;
        
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const request = store.get(key);
            
            request.onsuccess = () => {
                const res = request.result;
                if (res) {
                    if (res.content instanceof Blob) {
                         // Convert Blob to text if needed? Or API usually expects string content for readFile.
                         // But for images readFile is rarely used by Engine, getAssetURL is used.
                         // For JSON/Scripts, it's text.
                         const reader = new FileReader();
                         reader.onload = () => resolve(reader.result as string);
                         reader.readAsText(res.content);
                    } else {
                        resolve(res.content);
                    }
                } else {
                    reject(new Error('File not found: ' + path));
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async writeFile(path: string, content: string | Blob | Uint8Array): Promise<boolean> {
        if (!this.db || !this.currentProject) return false;
        
        const key = `${this.currentProject}::${path}`;
        const type = 'file';
        
        const tx = this.db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        
        store.put({
            key,
            project: this.currentProject,
            path,
            content, // IDB supports storing Blobs directly
            type
        });

        return new Promise((resolve) => {
            tx.oncomplete = () => {
                // Notify Watcher
                if (this.watcherCallback) {
                    // Slight check to infer things
                     // We should pass the updated file list for simplicity or granular update
                     // Simulating 'change'
                     this.readdir('').then(files => {
                        if (this.watcherCallback) this.watcherCallback({ event: 'change', path, files });
                     });
                }
                resolve(true);
            };
            tx.onerror = () => {
                console.error('Write failed', tx.error);
                resolve(false);
            };
        });
    }

    async readdir(path: string): Promise<FileEntry[]> {
        if (!this.db || !this.currentProject) return [];
        
        return new Promise((resolve) => {
             const tx = this.db!.transaction('files', 'readonly');
             const store = tx.objectStore('files');
             const index = store.index('project');
             const request = index.getAll(this.currentProject); // Get all files for project
             
             request.onsuccess = () => {
                 const allFiles = request.result as any[];
                 // Filter by 'directory' (simulate hierarchy)
                 // If path is empty, we want root items.
                 // A file at "assets/sprite.png" is in "assets".
                 
                 const entries: FileEntry[] = [];
                 const addedDirs = new Set<string>();

                 for (const file of allFiles) {
                     // Check if file belongs to this folder
                     // path = "" -> look for files with no slashes OR first level dirs
                     // path = "assets" -> look for files starting with "assets/"
                     
                     const filePath = file.path;
                     if (path) {
                         if (filePath.startsWith(path + '/')) {
                             const rel = filePath.substring(path.length + 1);
                             const parts = rel.split('/');
                             if (parts.length === 1) {
                                 // It's a file in this dir
                                 entries.push({ name: parts[0], type: file.type, path: filePath });
                             } else {
                                 // It's in a subdirectory
                                 const dirName = parts[0];
                                 if (!addedDirs.has(dirName)) {
                                     addedDirs.add(dirName);
                                     entries.push({ name: dirName, type: 'directory', path: `${path}/${dirName}` });
                                 }
                             }
                         }
                     } else {
                         // Root
                         const parts = filePath.split('/');
                         if (parts.length === 1) {
                             entries.push({ name: parts[0], type: file.type, path: filePath });
                         } else {
                             const dirName = parts[0];
                             if (!addedDirs.has(dirName)) {
                                 addedDirs.add(dirName);
                                 entries.push({ name: dirName, type: 'directory', path: dirName });
                             }
                         }
                     }
                 }
                 resolve(entries);
             };
        });
    }

    // Asset Management
    async importFile(sourcePath: string, destDir: string, customFilename?: string): Promise<{success: boolean, path?: string, error?: string}> {
        if (!this.db || !this.currentProject) return { success: false, error: 'No project' };
        
        console.log(`[WebFileSystem] Importing file. Source: ${sourcePath}, DestDir: ${destDir}, CustomName: ${customFilename}`);

        try {
            // 1. Fetch the blob from the source URL (likely a Blob URL)
            const response = await fetch(sourcePath);
            if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
            const blob = await response.blob();
            
            // 2. Determine destination filename
            let fileName = customFilename;
            
            if (!fileName) {
                 const urlParts = sourcePath.split('/');
                 const popped = urlParts.pop();
                 fileName = (popped && popped.length > 0) ? popped : 'imported_file.png';
                 // Clean query params if any
                 fileName = fileName.split('?')[0] ?? fileName;
            }

            // Ensure extension exists for Blobs if missing
            if (!fileName.includes('.')) {
                if (blob.type === 'image/png') fileName += '.png';
                else if (blob.type === 'image/jpeg') fileName += '.jpg';
                else if (blob.type === 'image/webp') fileName += '.webp';
                else if (blob.type === 'image/gif') fileName += '.gif';
            }

            const cleanDestDir = destDir.replace(/\\/g, '/');
            const destPath = `${cleanDestDir}/${fileName}`;

            // 3. Extract relative path for DB Key and Storage
            let relativeDestPath = destPath;
            if (relativeDestPath.startsWith(this.currentProject + '/')) {
                relativeDestPath = relativeDestPath.substring(this.currentProject.length + 1);
            }

            // 4. Ensure Directory Exists (e.g. assets/imported)
            const tx = this.db.transaction(['files'], 'readwrite');
            const store = tx.objectStore('files');
            
            const parts = relativeDestPath.split('/');
            parts.pop(); // remove filename
            const relativeDestDir = parts.join('/');

            if (relativeDestDir === 'assets/imported') {
                const dirKey = `${this.currentProject}::assets/imported`;
                const dirReq = store.get(dirKey);
                dirReq.onsuccess = () => {
                     if (!dirReq.result) {
                         console.log('[WebFileSystem] Auto-creating missing folder: assets/imported');
                         store.put({
                            key: dirKey,
                            project: this.currentProject,
                            path: 'assets/imported',
                            content: null,
                            type: 'directory'
                        });
                     }
                };
            }

            // 5. Store File
            const key = `${this.currentProject}::${relativeDestPath}`;
            store.put({
                key: key, 
                project: this.currentProject,
                path: relativeDestPath, // e.g. "assets/imported/nanoid_foo.png"
                content: blob,
                type: 'file'
            });

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });

            console.log(`[WebFileSystem] Imported successfully to: ${destPath}`);
            return { success: true, path: destPath };

        } catch (e: any) {
            console.error('[WebFileSystem] Import failed:', e);
            return { success: false, error: e.message };
        }
    }

    getPathForFile(file: File): string {
        // Return object URL for reading
        return URL.createObjectURL(file);
    }

    async showItemInFolder(path: string): Promise<void> {
        console.log('WebFileSystem: showItemInFolder', path);
    }

    // Native Dialogs
    async openFileDialog(filters: {name: string, extensions: string[]}[]): Promise<string | null> {
        // Simulation using <input type="file">
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            const accepts = filters.flatMap(f => f.extensions).map(e => `.${e}`).join(',');
            input.accept = accepts;
            
            input.onchange = async () => {
                if (input.files && input.files[0]) {
                    const file = input.files[0];
                    resolve(URL.createObjectURL(file));
                } else {
                    resolve(null);
                }
            };
            input.click();
        });
    }

    async saveFileDialog(_filters: {name: string, extensions: string[]}[]): Promise<string | null> {
         return "web-save-dialog";
    }

    async getAssetURL(relPath: string): Promise<string> {
        if (!this.db || !this.currentProject) return relPath;
        if (relPath.startsWith('blob:') || relPath.startsWith('data:')) return relPath;

        let cleanPath = relPath;
        // Strip project name if present at start (e.g. "MyWebProject/assets/foo.png" -> "assets/foo.png")
        if (cleanPath.startsWith(this.currentProject + '/')) {
            cleanPath = cleanPath.substring(this.currentProject.length + 1);
        }

        const key = `${this.currentProject}::${cleanPath}`;
        // console.log(`[WebFileSystem] getAssetURL Key: ${key}`);
        
        return new Promise((resolve) => {
            const tx = this.db!.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const req = store.get(key);
            
            req.onsuccess = () => {
                const res = req.result;
                if (res && res.content instanceof Blob) {
                    // console.log(`[WebFileSystem] Found Blob for ${key}, size: ${res.content.size}`);
                    resolve(URL.createObjectURL(res.content));
                }  else if (res && typeof res.content === 'string') {
                    resolve(URL.createObjectURL(new Blob([res.content], { type: 'text/javascript' })));
                } else {
                     console.warn(`[WebFileSystem] Asset not found in DB: ${key}`);
                     resolve(relPath);
                }
            };
            req.onerror = () => {
                console.error(`[WebFileSystem] DB Error looking up ${key}`, req.error);
                resolve(relPath);
            };
        });
    }
}
