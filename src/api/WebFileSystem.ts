
import type { IFileSystem, FileEntry, FileChangeEvent } from './FileSystem';
import { fs, configure } from '@zenfs/core';
import { IndexedDB } from '@zenfs/dom';

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
            await configure({
                mounts: {
                    '/': { backend: IndexedDB, name: 'UliKit2D_FS' }
                }
            });
            this.initialized = true;
            console.log('[WebFileSystem] ZenFS initialized with IndexedDB backend');
        } catch (e: any) {
            if (e.message && e.message.includes('Mount point is already in use')) {
                console.log('[WebFileSystem] ZenFS already configured (HMR re-init detected)');
                this.initialized = true;
            } else {
                console.error('[WebFileSystem] Added ZenFS configuration error:', e);
            }
        }
    }

    private async ensureInit() {
        if (!this.initialized) await this.init();
    }

    async selectFolder(): Promise<string | null> {
         await this.ensureInit();
         // ZenFS is a global root, so "MyWebProject" is just a folder at '/'
         return "MyWebProject"; 
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
            await fs.promises.mkdir(`${projectPath}/assets/imported`, { recursive: true });

            // 2. Load Default Assets
            const defaultAssets = import.meta.glob('../resources/default_assets/*.*', { query: '?url', import: 'default', eager: true });
            
            console.log('[WebFileSystem] Default Assets Object:', defaultAssets);

            for (const [key, url] of Object.entries(defaultAssets)) {
                const fileName = key.split('/').pop();
                if (!fileName) continue;
                
                console.log(`[WebFileSystem] Processing asset: ${fileName} -> ${url}`);

                try {
                    const response = await fetch(url as string);
                    if (!response.ok) throw new Error(`Fetch failed ${response.status}`);
                    const blob = await response.blob();
                    const buffer = await blob.arrayBuffer();
                    await fs.promises.writeFile(`${projectPath}/assets/${fileName}`, new Uint8Array(buffer));
                    console.log(`[WebFileSystem] Wrote ${fileName} to assets`);
                } catch (e) {
                    console.error(`[WebFileSystem] Failed to load asset ${fileName}`, e);
                }
            }

            // 3. Create project.json
            const projectJson = JSON.stringify({
                name: path,
                version: '1.0.0',
                params: {}
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
        
        const fullPath = `/${this.currentProject}/${path}`;
        const content = await fs.promises.readFile(fullPath, 'utf8');
        return content;
    }

    async writeFile(path: string, content: string | Blob | Uint8Array): Promise<boolean> {
        await this.ensureInit();
        if (!this.currentProject) return false;
        
        const fullPath = `/${this.currentProject}/${path}`;
        
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
                    if (this.watcherCallback) this.watcherCallback({ event: 'change', path, files });
                });
            }

            return true;
        } catch (e) {
            console.error('[WebFileSystem] write failed', e);
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
        
        if (relPath.startsWith('blob:') || relPath.startsWith('data:')) return relPath;

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
                // Convert Buffer to Uint8Array for Blob compatibility
                const bufferContent = new Uint8Array(content);
                
                // Assume image or octet-stream?
                // We can guess mime type from extension
                const ext = cleanPath.split('.').pop()?.toLowerCase();
                let params: BlobPropertyBag = {};
                if (ext === 'png') params.type = 'image/png';
                else if (ext === 'jpg' || ext === 'jpeg') params.type = 'image/jpeg';
                else if (ext === 'js' || ext === 'json') params.type = 'text/plain'; // Scripts

                const blob = new Blob([bufferContent], params);
                return URL.createObjectURL(blob);
            }
        } catch (e) {
             console.warn(`[WebFileSystem] Failed to get URL for ${fullPath}`, e);
        }
        
        return relPath;
    }
}
