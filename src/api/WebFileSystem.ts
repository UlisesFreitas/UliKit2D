import type { IFileSystem, FileEntry, FileChangeEvent } from './FileSystem';
import { fs, configure } from '@zenfs/core';
import { WebAccess } from '@zenfs/dom';
import { useUIStore } from '../stores/useUIStore';

export class WebFileSystem implements IFileSystem {
    public isElectron = false;
    private currentProject: string | null = null;
    private watcherCallback: ((event: FileChangeEvent) => void) | null = null;
    private initialized = false;

    constructor() {
        this.init();
    }

    private async init() {
        if (this.initialized) return;
        
        try {
            if (!navigator.storage || !navigator.storage.getDirectory) {
                console.error('[WebFileSystem] OPFS not supported');
                return;
            }

            // check if already accessible (HMR case)
            try {
                await fs.promises.stat('/');
                console.log('[WebFileSystem] OPFS Root already accessible (HMR). Skipping configure.');
                this.initialized = true;
                return;
            } catch (ignore) {
                // Not ready, proceed to configure
            }

            const rootHandle = await navigator.storage.getDirectory();
            
            await configure({
                mounts: {
                    '/': { backend: WebAccess, handle: rootHandle }
                }
            });
            this.initialized = true;
            console.log('[WebFileSystem] ZenFS initialized with WebAccess (OPFS) backend');
        } catch (e: any) {
            console.warn('[WebFileSystem] Initialization warning:', e);
            
            // Final check: did it work?
            try {
                await fs.promises.stat('/');
                console.log('[WebFileSystem] Verified: Root is accessible despite warning.');
                this.initialized = true;
            } catch (statError) {
                console.error('[WebFileSystem] Initialization FAILED. Please refresh manually.', statError);
                // We do NOT auto-reload here to avoid loops.
            }
        }
    }

    private async ensureInit() {
        if (!this.initialized) await this.init();
    }

    async selectFolder(): Promise<string | null> {
         await this.ensureInit();

         // 1. Get existing projects
         let existingProjects: string[] = [];
         try {
             const dirents = await fs.promises.readdir('/', { withFileTypes: true });
             existingProjects = dirents
                .filter(d => d.isDirectory())
                .map(d => d.name);
         } catch (e) {
             console.warn('Failed to list existing projects', e);
         }

         const projectListStr = existingProjects.length > 0 
            ? `Available Projects:\n- ${existingProjects.join('\n- ')}` 
            : 'No projects found.';

         // 2. Prompt loop for Opening
         const ui = useUIStore();
         let name: string | null = null;
         
         while (true) {
             name = await ui.prompt({ 
                 title: 'Open Project', 
                 message: `${projectListStr}\n\nEnter Exact Project Name to Open:`, 
                 defaultValue: existingProjects[0] || '',
                 placeholder: 'Project Name'
             });
             
             if (!name) return null; // User cancelled
             
             if (existingProjects.includes(name)) {
                 return name; // Found! Open it.
             } else {
                 await ui.confirm({
                     title: 'Project Not Found',
                     message: `Project "${name}" does not exist.`
                 });
                 // Loop again
             }
         }
    }

    async openProject(path: string): Promise<void> {
        await this.ensureInit();

        // Validate existence before setting context
        const projectPath = `/${path}`;
        try {
            const stat = await fs.promises.stat(projectPath);
            if (!stat.isDirectory()) {
                throw new Error('Path exists but is not a directory');
            }
        } catch (e) {
            console.warn(`[WebFileSystem] Project not found: ${path}`);
            throw new Error(`Project "${path}" not found in storage.`);
        }

        this.currentProject = path;
        console.log(`[WebFileSystem] Context set to project: ${path}`);
    }

    async createProject(path: string): Promise<{ success: boolean; error?: string }> {
        await this.ensureInit();
        this.currentProject = path;
        
        try {
            const projectPath = `/${path}`;
            
            // 1. Check if exists
            try {
                await fs.promises.stat(projectPath);
                // Exists
            } catch {
                // Doesn't exist, proceed
            }

            await fs.promises.mkdir(projectPath, { recursive: true });
            await fs.promises.mkdir(`${projectPath}/assets`, { recursive: true });
            await fs.promises.mkdir(`${projectPath}/assets/scenes`, { recursive: true });
            await fs.promises.mkdir(`${projectPath}/assets/imported`, { recursive: true });

            // 2. Load Default Assets
            // Use recursive glob to capture subfolders (e.g. player/)
            const defaultAssets = import.meta.glob('../resources/default_assets/**/*.*', { query: '?url', import: 'default', eager: true });
            
            console.log('[WebFileSystem] Default Assets Object:', defaultAssets);

            for (const [key, url] of Object.entries(defaultAssets)) {
                // Key is like "../resources/default_assets/player/sprite.png"
                // Extract relative part: "player/sprite.png"
                const relativePath = key.replace(/^\.\.\/resources\/default_assets\//, '');
                
                if (!relativePath) continue;
                
                console.log(`[WebFileSystem] Processing asset: ${relativePath} -> ${url}`);

                try {
                    const response = await fetch(url as string);
                    if (!response.ok) throw new Error(`Fetch failed ${response.status}`);
                    const blob = await response.blob();
                    const buffer = await blob.arrayBuffer();
                    
                    // Determine dest path inside project
                    const destPath = `${projectPath}/assets/${relativePath}`;
                    
                    // Ensure directory exists
                    const parts = relativePath.split('/');
                    parts.pop(); // Remove filename
                    if (parts.length > 0) {
                        const subDir = parts.join('/');
                        await fs.promises.mkdir(`${projectPath}/assets/${subDir}`, { recursive: true });
                    }

                    await fs.promises.writeFile(destPath, new Uint8Array(buffer));
                    console.log(`[WebFileSystem] Wrote ${relativePath} to assets`);
                } catch (e) {
                    console.error(`[WebFileSystem] Failed to load asset ${relativePath}`, e);
                }
            }

            // 3. Create Initial Scene (Parity with Electron main.ts)
            // Ensure directory exists (redundant safety check)
            try {
                await fs.promises.mkdir(`${projectPath}/assets/scenes`, { recursive: true });
            } catch (ignore) {}

            const defaultScene = [
                {
                    "id": "main-camera-id",
                    "name": "Main Camera",
                    "transform": { "x": 0, "y": 0, "rotation": 0, "scale": { "x": 1, "y": 1 } },
                    "camera": { "zoom": 1, "isPrimary": true, "backgroundColor": "#333333" }
                }
            ];
            
            await fs.promises.writeFile(
                `${projectPath}/assets/scenes/NewScene.json`, 
                JSON.stringify(defaultScene, null, 2)
            );

            // 4. Create project.json
            const projectJson = JSON.stringify({
                name: path,
                version: '1.0.0',
                created: Date.now(),
                lastModified: Date.now(),
                settings: {
                     layers: [
                        'Base Layer',  // 0: Immortal/Bottom
                        'Ground',      // 1
                        'Objects',     // 2
                        '', '', '', '', '', '', '', // 3-9
                        'Player',      // 10
                        '', '', '', '', '', '', '', '', '', // 11-19
                        '', '', '', '', '', '', '', '', '', '', // 20-29
                        'Particles',   // 30
                        'UI'           // 31: Top Most
                     ],
                     physics: { gravity: { x: 0, y: 9.8 } }
                },
                scenes: [
                    {
                        name: 'NewScene',
                        path: 'assets/scenes/NewScene.json',
                        id: 'default-scene-id',
                        updated: Date.now()
                    }
                ],
                resources: []
            }, null, 4);
            
            await fs.promises.writeFile(`${projectPath}/project.json`, projectJson);
            
            // Verification
            const verifyFiles = await fs.promises.readdir(`${projectPath}/assets`);
            console.log(`[WebFileSystem] Verification - Files in assets:`, verifyFiles);
            
            console.log('[WebFileSystem] Project created via ZenFS at', projectPath);
            return { success: true };

        } catch (e: any) {
            console.error('[WebFileSystem] createProject failed', e);
            return { success: false, error: e.message };
        }
    }

    async watchProject(path: string, onEvent: (event: FileChangeEvent) => void): Promise<() => void> {
        await this.ensureInit();
        this.currentProject = path;
        this.watcherCallback = onEvent;
        
        console.log(`[WebFileSystem] Watching project: ${path}`);
        
        // Initial Scan
        this._scanRecursive('').then(files => {
            console.log(`[WebFileSystem] Initial Recursive Scan Result:`, files);
            onEvent({ event: 'initial', path: '', files });
        });

        return () => {
            this.watcherCallback = null;
        };
    }

    private async _scanRecursive(dir: string): Promise<FileEntry[]> {
        if (!this.currentProject) return [];
        let results: FileEntry[] = [];
        const fullDir = dir ? `/${this.currentProject}/${dir}` : `/${this.currentProject}`;
        
        try {
            const dirents = await fs.promises.readdir(fullDir, { withFileTypes: true });
            for (const d of dirents) {
                const relativePath = dir ? `${dir}/${d.name}` : d.name;
                results.push({
                    name: d.name,
                    type: d.isDirectory() ? 'directory' : 'file',
                    path: relativePath
                });
                
                if (d.isDirectory()) {
                    const subResults = await this._scanRecursive(relativePath);
                    results = results.concat(subResults);
                }
            }
        } catch (e) {
            console.error(`[WebFileSystem] Scan failed for ${dir}`, e);
        }
        return results;
    }

    async readFile(path: string): Promise<string> {
        await this.ensureInit();
        if (!this.currentProject) throw new Error('No project');

        const cleanPath = this._normalizePath(path);
        const fullPath = `/${this.currentProject}/${cleanPath}`;
        
        const content = await fs.promises.readFile(fullPath, 'utf8');
        return content;
    }

    async writeFile(path: string, content: string | Blob | Uint8Array): Promise<boolean> {
        await this.ensureInit();
        if (!this.currentProject) return false;
        
        const cleanPath = this._normalizePath(path);
        const fullPath = `/${this.currentProject}/${cleanPath}`;
        
        // console.log(`[WebFileSystem] writeFile: '${path}' -> '${fullPath}'`);

        try {
            let data: Uint8Array | string;
            if (content instanceof Blob) {
                const ab = await content.arrayBuffer();
                data = new Uint8Array(ab);
            } else {
                data = content;
            }
            
            await fs.promises.writeFile(fullPath, data);

             // Trigger Watcher Manually
             if (this.watcherCallback) {
                this._scanRecursive('').then(files => {
                    if (this.watcherCallback) this.watcherCallback({ event: 'change', path: cleanPath, files });
                });
            }

            return true;
        } catch (e: any) {
            console.error(`[WebFileSystem] write failed for '${fullPath}'`, e);
            return false;
        }
    }

    async deleteFile(path: string): Promise<boolean> {
        await this.ensureInit();
        if (!this.currentProject) return false;
        
        try {
            const cleanPath = this._normalizePath(path);
            const fullPath = `/${this.currentProject}/${cleanPath}`;
            
            const stat = await fs.promises.stat(fullPath);
            
            if (stat.isDirectory()) {
                // Recursive delete
                await fs.promises.rm(fullPath, { recursive: true, force: true });
            } else {
                await fs.promises.unlink(fullPath);
            }

             // Trigger Watcher Manually
             if (this.watcherCallback) {
                this._scanRecursive('').then(files => {
                    if (this.watcherCallback) this.watcherCallback({ event: 'unlink', path: cleanPath, files });
                });
            }
            return true;
        } catch (e) {
            console.error('[WebFileSystem] delete failed', e);
            return false;
        }
    }

    // Helper to strip Project Prefix if present
    private _normalizePath(path: string): string {
        if (!this.currentProject) return path;
        
        // Handle windows style
        let clean = path.replace(/\\/g, '/');
        
        if (clean.startsWith(`${this.currentProject}/`)) {
            return clean.substring(this.currentProject.length + 1);
        }
        if (clean === this.currentProject) {
            return '';
        }
        return clean;
    }

    async createFolder(path: string): Promise<boolean> {
        console.log(`[WebFileSystem] Request createFolder: ${path}`);
        await this.ensureInit();
        if (!this.currentProject) {
            console.error('[WebFileSystem] No current project');
            return false;
        }
        
        try {
            const normalize = (p: string) => p.replace(/\\/g, '/').replace(/\/+/g, '/');
            const cleanPath = normalize(path).replace(/^\//, '');
            const fullPath = `/${this.currentProject}/${cleanPath}`;

            console.log(`[WebFileSystem] Creating folder at full path: '${fullPath}'`);
            
            await fs.promises.mkdir(fullPath, { recursive: true });
            console.log('[WebFileSystem] mkdir successful');
            
            // Trigger Watcher Manually
            if (this.watcherCallback) {
                console.log('[WebFileSystem] Triggering scan for watcher...');
                this._scanRecursive('').then(files => {
                    console.log(`[WebFileSystem] Scan complete (count: ${files.length}). Firing watcher callback.`);
                    if (this.watcherCallback) this.watcherCallback({ event: 'change', path, files });
                });
            }
            return true;
        } catch (e) {
             console.error('[WebFileSystem] createFolder failed', e);
             return false;
        }
    }

    async rename(oldPath: string, newPath: string): Promise<boolean> {
        console.log(`[WebFileSystem] Request Rename: ${oldPath} -> ${newPath}`);
        await this.ensureInit();
        if (!this.currentProject) {
            console.error('[WebFileSystem] No current project set');
            return false;
        }

        const normalize = (p: string) => p.replace(/\\/g, '/').replace(/\/+/g, '/');
        
        // Ensure paths don't start with / if they are relative, but we construct full path manually
        const cleanOld = normalize(oldPath).replace(/^\//, '');
        const cleanNew = normalize(newPath).replace(/^\//, '');

        const oldFullPath = `/${this.currentProject}/${cleanOld}`;
        const newFullPath = `/${this.currentProject}/${cleanNew}`;

        console.log(`[WebFileSystem] Full Paths: '${oldFullPath}' -> '${newFullPath}'`);

        try {
            // Check if source is file or directory
            let stat;
            try {
                stat = await fs.promises.stat(oldFullPath);
            } catch (statError) {
                console.error(`[WebFileSystem] Source not found: ${oldFullPath}`, statError);
                
                // DEBUG: List parent to see what exists
                const parentDir = oldFullPath.split('/').slice(0, -1).join('/');
                console.log(`[WebFileSystem] Listing parent '${parentDir}':`);
                try {
                    const params = await fs.promises.readdir(parentDir);
                    console.log('Entries:', params);
                } catch (e) { console.error('Failed to list parent:', e); }

                return false;
            }
            
            if (stat.isDirectory()) {
                console.log('[WebFileSystem] Source is Directory. Performing recursive copy-delete.');
                // Recursive Copy + Delete
                // 1. Create new dir
                await fs.promises.mkdir(newFullPath, { recursive: true });
                
                // 2. Recursive Copy
                const copyRecursive = async (src: string, dest: string) => {
                    const entries = await fs.promises.readdir(src, { withFileTypes: true });
                    for (const entry of entries) {
                        const srcPath = `${src}/${entry.name}`;
                        const destPath = `${dest}/${entry.name}`;
                        if (entry.isDirectory()) {
                            await fs.promises.mkdir(destPath, { recursive: true });
                            await copyRecursive(srcPath, destPath);
                        } else {
                            const content = await fs.promises.readFile(srcPath);
                            await fs.promises.writeFile(destPath, content);
                        }
                    }
                };
                await copyRecursive(oldFullPath, newFullPath);

                // 3. Delete old
                await fs.promises.rm(oldFullPath, { recursive: true, force: true });
            } else {
                console.log('[WebFileSystem] Source is File.');
                // File Copy + Delete
                const content = await fs.promises.readFile(oldFullPath);
                await fs.promises.writeFile(newFullPath, content);
                await fs.promises.unlink(oldFullPath);
            }

            console.log('[WebFileSystem] Rename successful.');

            // Trigger Watcher
            if (this.watcherCallback) {
                this._scanRecursive('').then(files => {
                    if (this.watcherCallback) this.watcherCallback({ event: 'change', path: '', files });
                });
            }

            return true;

        } catch (e: any) {
            console.error('[WebFileSystem] Rename failed:', e);
            return false;
        }
    }

    async readdir(path: string): Promise<FileEntry[]> {
        // ... existing readdir (shallow) ...
        return this.readdirShallow(path);
    }
    
    // Rename original readdir to avoid confusion if needed, or keep as is.
    // Ideally the interface defines readdir. We'll keep readdir as shallow.
    async readdirShallow(path: string): Promise<FileEntry[]> {
         await this.ensureInit();
        if (!this.currentProject) return [];
        
        const fullDirPath = path ? `/${this.currentProject}/${path}` : `/${this.currentProject}`;
        console.log(`[WebFileSystem] readdir: raw path '${path}' -> full '${fullDirPath}'`);
        
        try {
            const dirents = await fs.promises.readdir(fullDirPath, { withFileTypes: true });
            
            const entries: FileEntry[] = dirents.map(d => ({
                name: d.name,
                type: d.isDirectory() ? 'directory' : 'file',
                path: path ? `${path}/${d.name}` : d.name
            }));
            
            return entries;
        } catch (e) {
            console.error('[WebFileSystem] readdir failed', e);
            return [];
        }
    }

    // Asset Management
    async importFile(sourcePath: string, destDir: string, customFilename?: string): Promise<{success: boolean, path?: string, error?: string}> {
        await this.ensureInit();
        if (!this.currentProject) return { success: false, error: 'No project' };

        try {
            const response = await fetch(sourcePath);
            if (!response.ok) throw new Error('Fetch failed');
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();

            // Determine filename
            let fileName = customFilename;
             if (!fileName) {
                 const urlParts = sourcePath.split('/');
                 const popped = urlParts.pop();
                 fileName = (popped && popped.length > 0) ? popped : 'imported_file.png';
                 fileName = fileName.split('?')[0] ?? fileName;
            }

            if (!fileName.includes('.')) {
                 if (blob.type === 'image/png') fileName += '.png';
                 else if (blob.type === 'image/jpeg') fileName += '.jpg';
                 else if (blob.type === 'image/webp') fileName += '.webp';
                 else if (blob.type === 'image/gif') fileName += '.gif';
            }

            let relativeDestDir = destDir;
            if (relativeDestDir.startsWith(this.currentProject + '/')) {
                relativeDestDir = relativeDestDir.substring(this.currentProject.length + 1);
            } else if (relativeDestDir === this.currentProject) {
                relativeDestDir = '';
            }

            const fullDestPath = `/${this.currentProject}/${relativeDestDir}/${fileName}`;
            
            // Ensure dir exists
            const fullDestDir = `/${this.currentProject}/${relativeDestDir}`;
            try {
                await fs.promises.stat(fullDestDir);
            } catch {
                 await fs.promises.mkdir(fullDestDir, { recursive: true });
            }

            await fs.promises.writeFile(fullDestPath, new Uint8Array(buffer));
            
            // Return relative path for Animator
            const finalPath = relativeDestDir ? `${relativeDestDir}/${fileName}` : fileName;
            const absolutePath = `${this.currentProject}/${finalPath}`;
            
            console.log(`[WebFileSystem] Imported to ${fullDestPath}`);

            // Trigger Watcher Update
             if (this.watcherCallback) {
                this._scanRecursive('').then(files => {
                    if (this.watcherCallback) this.watcherCallback({ event: 'change', path: finalPath, files });
                });
            }

            return { success: true, path: absolutePath };
            
        } catch (e: any) {
            console.error('[WebFileSystem] Import failed', e);
            return { success: false, error: e.message };
        }
    }

    getPathForFile(file: File): string {
        return URL.createObjectURL(file);
    }

    async showItemInFolder(path: string): Promise<void> {
        console.log('WebFileSystem: showItemInFolder', path);
    }

    async openFileDialog(filters: {name: string, extensions: string[]}[]): Promise<string | null> {
         return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            const accepts = filters.flatMap(f => f.extensions).map(e => `.${e}`).join(',');
            input.accept = accepts;
            
            input.onchange = async () => {
                if (input.files && input.files[0]) {
                    resolve(URL.createObjectURL(input.files[0]));
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
        await this.ensureInit(); // Usually init is done
        
        if (relPath.startsWith('blob:') || relPath.startsWith('data:') || relPath.startsWith('http:') || relPath.startsWith('https:')) return relPath;
        
        // Skip internal assets (Vite served) to prevent ENOENT warnings
        if (relPath.includes('internal_default_assets') || relPath.startsWith('/src/')) return relPath;

        // Clean path
        let cleanPath = relPath;
        if (this.currentProject && cleanPath.startsWith(this.currentProject + '/')) {
            cleanPath = cleanPath.substring(this.currentProject.length + 1);
        }

        const fullPath = `/${this.currentProject}/${cleanPath}`;

        try {
            const stat = await fs.promises.stat(fullPath);
            if (stat.isFile()) {
                const content = await fs.promises.readFile(fullPath);
                // console.log(`[WebFS Debug] Loading ${fullPath}, Size: ${content.length}`);

                // Convert Buffer to Uint8Array for Blob compatibility
                const bufferContent = new Uint8Array(content as any);
                
                // Debug Header
                const header = Array.from(bufferContent.slice(0, 8)).map(b => b.toString(16).padStart(2,'0')).join(' ');
                console.log(`[WebFS Debug] Header: ${header}`);

                // If small, log as text to see if it's an error
                if (bufferContent.length < 500) {
                    try {
                        const text = new TextDecoder().decode(bufferContent);
                        // Using text to suppress warning if needed, or just let it compile out
                        if (false) console.log(text); 
                        // console.log(`[WebFS Debug] Small Content Text: ${text}`);
                    } catch (e) { /* ignore */ }
                }

                // Assume image or octet-stream?
                // We can guess mime type from extension
                const ext = cleanPath.split('.').pop()?.toLowerCase();
                let params: BlobPropertyBag = {};
                if (ext === 'png') params.type = 'image/png';
                else if (ext === 'jpg' || ext === 'jpeg') params.type = 'image/jpeg';
                else if (ext === 'webp') params.type = 'image/webp';
                else if (ext === 'svg') params.type = 'image/svg+xml';
                else if (ext === 'json') params.type = 'application/json';
                else if (ext === 'js' || ext === 'mjs') params.type = 'application/javascript';

                const blob = new Blob([bufferContent], params);
                return URL.createObjectURL(blob);
            }
        } catch (e) {
             console.warn(`[WebFileSystem] Failed to get URL for ${fullPath}`, e);
        }
        
        return relPath;
    }
}
