
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
            
            // 2. Determine destination path
            let fileName = customFilename;
            
            if (!fileName) {
                 const urlParts = sourcePath.split('/');
                 const popped = urlParts.pop();
                 fileName = (popped && popped.length > 0) ? popped : 'imported_file.png';
                 // Clean query params if any
                 fileName = fileName.split('?')[0] ?? fileName;
            }

            // If it's a UUID blob, maybe append extension if missing?
            if (!fileName.includes('.')) {
                // Peek mimetype
                if (blob.type === 'image/png') fileName += '.png';
                else if (blob.type === 'image/jpeg') fileName += '.jpg';
                else if (blob.type === 'image/webp') fileName += '.webp';
                else if (blob.type === 'image/gif') fileName += '.gif';
            }

            const cleanDestDir = destDir.replace(/\\/g, '/');
            const destPath = `${cleanDestDir}/${fileName}`;
            // Ensure relative to project root? 
            // destDir passed from Animator is `projectPath/assets/imported/AnimName`.
            // So destPath should be relative from project root? 
            // Wait, In WebFileSystem, keys are `project::path`. 
            // `path` argument in createProject is the "root". 
            // In AnimatorModal: `const destDir = ${projectPath}/assets/imported/${animName...`
            // So destDir is fully qualified "Project/assets/...".
            // That matches our key structure.

            // 3. Write to DB
            // key is implicitly used in put, but we construct it inline to avoid lint error if not needed separately
            
            // Extract relative path
            let relativeDestPath = destPath;
            if (relativeDestPath.startsWith(this.currentProject + '/')) {
                relativeDestPath = relativeDestPath.substring(this.currentProject.length + 1);
            }

            // 3. Ensure Directory Exists (Recursive-ish for one level)
            // If destDir is "MyProject/assets/imported", we want to ensure it exists as a directory entry
            // This fixes issues where existing projects don't have the explicit folder entry
            const tx = this.db.transaction(['files'], 'readwrite');
            const store = tx.objectStore('files');

            let relativeDestDir = destDir;
            if (relativeDestDir.startsWith(this.currentProject + '/')) {
                relativeDestDir = relativeDestDir.substring(this.currentProject.length + 1);
            }
            
            // Check/Create Main Dir
            // We assume "assets" likely exists, but "assets/imported" might not.
            // Ideally should split and ensure all parts, but for now specific fix for imported:
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

            // 4. Store File
            // key is implicitly used in put, but we construct it inline to avoid lint error if not needed separately
            
            // Extract relative path (re-use variable logic, but don't redeclare if already present in scope? No, it was shadowed in my mind)
            // The previous block was inserted ABOVE the original declaration.
            // But wait, the original code had:
            // let relativeDestPath = destPath; 
            // ...
            
            // My replacement block INCLUDED the original declaration at the end.
            // "store.put" block uses it.
            
            // If the error says "Cannot redeclare", it means it appears twice in the same scope.
            
            // Let's remove the second declaration or merge.
            // I will just remove the "let" keyword if it's already declared, OR ensure it's only declared once.
            
            // Looking at the file content (via mental model or previous read):
            // I replaced lines 395-405.
            // Line 390 had: `let relativeDestPath = destPath;`
            // Wait, looking at the DIFF:
            // I added the block, and the "4. Store" section is repeated? 
            
            // Ah, I see:
            // My replacement content ended with:
            // `let relativeDestPath = destPath; ... store.put(...)`
            
            // But I replaced the block STARTING at line 395.
            // Did line 390 EXIST before?
            // Yes, line 390: `let relativeDestPath = destPath;` was OUTSIDE my target range?
            // No, wait. 
            // In step 2054 view:
            // 389: // Extract relative path
            // 390: let relativeDestPath = destPath;
            // ...
            // 395: // 4. Store
            
            // I replaced starting at 395.
            // So `let relativeDestPath` at 390 is STILL THERE.
            // And my replacement ADDS `let relativeDestPath` again at the end of the block.
            
            // Solution: Remove the duplicate declaration and logic from my replacement block, 
            // relying on the one that exists at line 390 (which is before my block).
            
            // Wait, my replacement block is inserted at 395.
            // So the structure is now:
            // 390: let relativeDestPath = destPath; ...
            // 395: // 3. Ensure Directory Exists ...
            // ...
            // 430: let relativeDestPath = destPath;
            
            // Yes. I will remove the re-declaration.
            
            store.put({
                key: `${this.currentProject}::${relativeDestPath}`,
                project: this.currentProject,
                path: relativeDestPath,
                content: blob,
                type: 'file'
            });

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });

            console.log(`[WebFileSystem] Imported successfully to: ${destPath}`);
            return { success: true, path: destPath }; // Return full "absolute" path (Project/...) logic

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

        const key = `${this.currentProject}::${relPath}`;
        
        return new Promise((resolve) => {
            const tx = this.db!.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const req = store.get(key);
            
            req.onsuccess = () => {
                const res = req.result;
                if (res && res.content instanceof Blob) {
                    resolve(URL.createObjectURL(res.content));
                }  else if (res && typeof res.content === 'string') {
                    // Create Blob for text content (scripts)
                    const blob = new Blob([res.content], { type: 'text/javascript' });
                    resolve(URL.createObjectURL(blob));
                } else {
                     // Fallback or missing
                     resolve(relPath);
                }
            };
            req.onerror = () => resolve(relPath);
        });
    }
}
