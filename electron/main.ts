import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import chokidar, { FSWatcher } from 'chokidar';

import config from '../ukit.config.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

// Register Custom Protocol (Must be done before app ready)
protocol.registerSchemesAsPrivileged([
    { scheme: 'asset', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }
]);

let mainWindow: BrowserWindow | null = null;
let watcher: FSWatcher | null = null;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false
        },
        show: false,
        backgroundColor: '#1a1a1a',
    });

    const isDev = process.argv.includes('--dev');

    if (isDev) {
        const host = config.server?.host || 'localhost';
        const port = config.server?.port || 9222;
        mainWindow.loadURL(`http://${host}:${port}`);
    } else {
        mainWindow.loadFile(path.join(__dirname, '../index.html'));
    }

    mainWindow.webContents.openDevTools();

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
};

// IPC Handlers
ipcMain.handle('project:watch', async (_event, projectPath) => {
    if (watcher) {
        await watcher.close();
    }
    
    // Watch the Project Root
    const watchPath = projectPath;
    
    // Ensure assets folder exists (just in case)
    const fs = await import('fs/promises');
    try {
        await fs.mkdir(path.join(watchPath, 'assets'), { recursive: true });
    } catch (e) {}

    watcher = chokidar.watch(watchPath, {
        ignoreInitial: false,
        depth: 5,
        ignored: /(^|[\/\\])\../ // ignore dotfiles
    });

    watcher.on('all', (eventName, filePath) => {
         // Send event to renderer
         if (mainWindow) {
             const relativePath = path.relative(projectPath, filePath);
             mainWindow.webContents.send('file:event', { event: eventName, path: relativePath, fullPath: filePath });
         }
    });

    return { success: true, watchedPath: watchPath };
});

ipcMain.handle('import:file', async (_event, sourcePath, destDir, customFilename) => {
    console.log(`[Main] import:file call. Source: ${sourcePath}, DestDir: ${destDir}, CustomName: ${customFilename}`);
    const fs = await import('fs/promises');
    const filename = customFilename || path.basename(sourcePath);
    const destPath = path.join(destDir, filename);
    console.log(`[Main] DestPath resolved to: ${destPath}`);
    
    try {
        // Ensure destination directory exists
        const dir = path.dirname(destPath);
        console.log(`[Main] Ensuring directory exists: ${dir}`);
        await fs.mkdir(dir, { recursive: true });
        
        console.log(`[Main] Copying file...`);
        await fs.copyFile(sourcePath, destPath);
        
        console.log(`[Main] Copy success! File at: ${destPath}`);
        return { success: true, path: destPath };
    } catch (e: any) {
        console.error(`[Main] Copy failed:`, e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('shell:showItemInFolder', async (_event, path) => {
    shell.showItemInFolder(path);
    return true;
});

// -- New Project Handlers --

ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory', 'createDirectory']
    });
    
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});

ipcMain.handle('project:create', async (_event, folderPath: string) => {
    const fs = await import('fs/promises');
    console.log(`[Main] project:create called for: ${folderPath}`);
    try {
        // Create basic structure
        const assetsPath = path.join(folderPath, 'assets');
        console.log(`[Main] Creating assets at: ${assetsPath}`);
        await fs.mkdir(assetsPath, { recursive: true });
        
        // Ensure imported folder exists
        const importedPath = path.join(assetsPath, 'imported');
        console.log(`[Main] Creating imported at: ${importedPath}`);
        await fs.mkdir(importedPath, { recursive: true });

        // Ensure scenes folder exists
        const scenesPath = path.join(assetsPath, 'scenes');
        console.log(`[Main] Creating scenes at: ${scenesPath}`);
        await fs.mkdir(scenesPath, { recursive: true });
        
        const projectConfig: any = {
            name: path.basename(folderPath),
            version: '1.0.0',
            engineVersion: '1.0.0',
            created: Date.now(),
            lastModified: Date.now(),
            settings: {
                 // Minimal defaults, Manager will handle rest
                 layers: ['Background', 'Base Layer', 'Player', 'UI'],
                 physics: { gravity: { x: 0, y: 9.8 } }
            },
            scenes: [
                {
                    name: 'NewScene',
                    path: 'assets/scenes/NewScene.json',
                    id: 'default-scene-id', // We should generate a UUID here or use a fixed one for initial
                    updated: Date.now()
                }
            ],
            resources: []
        };
        
        await fs.writeFile(
            path.join(folderPath, 'project.json'), 
            JSON.stringify(projectConfig, null, 4)
        );

        // Create Initial Scene
        const defaultScene = [
            {
                "id": "main-camera-id",
                "name": "Main Camera",
                "transform": { "x": 0, "y": 0, "rotation": 0, "scale": { "x": 1, "y": 1 } },
                "camera": { "zoom": 1, "isPrimary": true, "backgroundColor": "#333333" }
            }
        ];
        await fs.writeFile(
            path.join(scenesPath, 'NewScene.json'),
            JSON.stringify(defaultScene, null, 2)
        );
        

        // -------- DEFAULT ASSETS --------
        // Copy from src/resources/default_assets
        // In dev: ../src/resources/default_assets
        // In prod: process.resourcesPath/default_assets (need to ensure they are copied there)
        
        const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
        let sourceAssetsPath = '';
        
        if (isDev) {
            // Use process.cwd() which is the project root in dev
            sourceAssetsPath = path.join(process.cwd(), 'src/resources/default_assets');
        } else {
            // Need to handle production path later, assuming adjacent to resources or similar
            sourceAssetsPath = path.join(process.resourcesPath, 'default_assets'); 
        }

        try {
            console.log(`[Main] Looking for default assets at: ${sourceAssetsPath}`);
            
            // Recursive Copy Helper
            const copyRecursive = async (src: string, dest: string) => {
                try {
                    const stats = await fs.stat(src);
                    if (stats.isDirectory()) {
                        await fs.mkdir(dest, { recursive: true });
                        const entries = await fs.readdir(src);
                        for (const entry of entries) {
                            await copyRecursive(path.join(src, entry), path.join(dest, entry));
                        }
                    } else {
                        await fs.copyFile(src, dest);
                    }
                } catch(e) {
                     console.warn(`[Main] Skipping ${src}:`, e);
                }
            };

            await copyRecursive(sourceAssetsPath, assetsPath);
            console.log(`[Main] Default assets copied recursively.`);
        } catch (err) {
            console.error('Failed to copy default assets:', err);
        }
        
        // -------- ASSET SCANNING (PHASE 8 HYDRATION) --------
        // We must populate project.json with the assets we just copied
        const scannedResources: any[] = [];
        
        const getAssetType = (ext: string): string => {
            const map: Record<string, string> = {
                '.png': 'texture', '.jpg': 'texture', '.jpeg': 'texture',
                '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio',
                '.js': 'script', '.ts': 'script', '.json': 'json'
            };
            return map[ext.toLowerCase()] || 'unknown';
        };

        const scanAssets = async (dir: string) => {
             const entries = await fs.readdir(dir, { withFileTypes: true });
             for (const entry of entries) {
                 const fullPath = path.join(dir, entry.name);
                 if (entry.isDirectory()) {
                     if (entry.name === 'imported') continue; // Skip imported cache if serves that purpose
                     await scanAssets(fullPath);
                 } else {
                     // Start relative from project root (assets/...)
                     // fullPath is C:/.../assets/foo.png
                     // We want assets/foo.png
                     // assetsPath is C:/.../assets
                     // relative from assetsPath -> foo.png. 
                     // relative from folderPath -> assets/foo.png
                     const relPath = path.relative(folderPath, fullPath).replace(/\\/g, '/');
                     const ext = path.extname(entry.name);
                     
                     scannedResources.push({
                         guid: crypto.randomUUID(),
                         path: relPath,
                         type: getAssetType(ext),
                         meta: {}
                     });
                 }
             }
        };

        try {
            await scanAssets(assetsPath);
            console.log(`[Main] Scanned ${scannedResources.length} default assets.`);
        } catch(e) {
            console.error('[Main] Asset scan failed:', e);
        }
        
        // Update the project config with resources
        projectConfig.resources = scannedResources;
        
        // Rewrite the project.json with the populated resources
        await fs.writeFile(
            path.join(folderPath, 'project.json'), 
            JSON.stringify(projectConfig, null, 4)
        );
        // ----------------------------------------------------
        
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

// -- Generic File I/O Handlers --

ipcMain.handle('dialog:openFile', async (_event, filters: any[]) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters: filters || []
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:showOpenDialog', async (_event, options: any) => {
    return await dialog.showOpenDialog(mainWindow!, options);
});

ipcMain.handle('dialog:saveFile', async (_event, filters: any[]) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
        filters: filters || []
    });
    return result.canceled ? null : result.filePath;
});

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    const fs = await import('fs/promises');
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
    } catch (e: any) {
        throw new Error(e.message);
    }
});

ipcMain.handle('fs:readdir', async (_event, dirPath: string) => {
    const fs = await import('fs/promises');
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries.map(entry => ({
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
            path: path.join(dirPath, entry.name)
        }));
    } catch (e: any) {
        throw new Error(e.message);
    }
});

    ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    const fs = await import('fs/promises');
    try {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        await fs.writeFile(filePath, content, 'utf-8');
        return true;
    } catch (e: any) {
        throw new Error(e.message);
    }
});

ipcMain.handle('fs:createFolder', async (_event, dirPath: string) => {
    const fs = await import('fs/promises');
    try {
        await fs.mkdir(dirPath, { recursive: true });
        return true;
    } catch (e: any) {
        throw new Error(e.message);
    }
});

ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    const fs = await import('fs/promises');
    try {
        await fs.unlink(filePath);
        return true;
    } catch (e: any) {
        throw new Error(e.message);
    }
});

ipcMain.handle('fs:renameFile', async (_event, oldPath: string, newPath: string) => {
    const fs = await import('fs/promises');
    console.log(`[Main] fs:renameFile ${oldPath} -> ${newPath}`);
    try {
        await fs.rename(oldPath, newPath);
        return true;
    } catch (e: any) {
        console.error(`[Main] Rename failed: ${e.message}`);
        throw new Error(e.message);
    }
});

app.whenReady().then(() => {
    // Register Protocol Handler
    protocol.handle('asset', async (request) => {
        try {
            // 1. Strip protocol
            let filePath = decodeURIComponent(request.url.replace('asset://', ''));

            // 2. CORRECTION FOR WINDOWS (Chromium treats drive letter as host)
            // If URL was asset:///C:/file, filePath becomes "/c:/file" (or "c:/file" if host stripped differently)
            // But if it was asset://c/file, filePath is "c/file" (missing colon)
            
            // If it starts with slash, remove it first
            if (filePath.startsWith('/')) {
                filePath = filePath.slice(1);
            }

            // 3. Restore colon if missing on Windows
            // If the 2nd char is NOT ':', but 1st is a letter, and we are on Windows
            // It means chrome parsed 'c' as host and ate the colon.
            if (process.platform === 'win32') {
                 // Check pattern like "c/Users" where it should be "c:/Users"
                 if (filePath.length > 1 && filePath[1] !== ':' && /^[a-zA-Z]/.test(filePath[0])) {
                     // Heuristic: If it looks like a drive path but missing colon
                     // e.g. "c/Users/ulise..." -> "c:/Users/ulise..."
                     filePath = filePath[0] + ':' + filePath.slice(1);
                 }
                 // Force Uppercase Drive Letter for consistency/OneDrive
                 if (filePath.length > 1 && filePath[1] === ':' && /^[a-z]/.test(filePath[0])) {
                     filePath = filePath[0].toUpperCase() + filePath.slice(1);
                 }
            }
            
            // Normalize path (fixes mixed slashes, reduces '..')
            filePath = path.normalize(filePath);
            
            // Debug Log
            console.log(`[AssetProtocol] URL: ${request.url}`);
            console.log(`[AssetProtocol] Path: ${filePath}`);
            
            // Check existence
            const fs = await import('fs/promises');
            try {
                // Try access for verification
                await fs.access(filePath);
            } catch (err: any) {
                 console.error(`[AssetProtocol] ❌ File not found at: '${filePath}'`);
                 console.error(`[AssetProtocol] FS Error:`, err.code);
                 
                 // DEBUG: List directory contents to see if file is actually there
                 try {
                     const dir = path.dirname(filePath);
                     console.log(`[AssetProtocol] Listing dir: ${dir}`);
                     const files = await fs.readdir(dir);
                     console.log(`[AssetProtocol] Files in dir:`, files);
                 } catch (readErr) {
                     console.error(`[AssetProtocol] Failed to list dir:`, readErr);
                 }
            }

            const fileUrl = pathToFileURL(filePath).toString();
            console.log(`[AssetProtocol] Fetching: ${fileUrl}`);

            return net.fetch(fileUrl);
        } catch (e) {
            console.error('[AssetProtocol] Critical Error:', e);
            return new Response('Internal Server Error', { status: 500 });
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (watcher) watcher.close();
    if (process.platform !== 'darwin') app.quit();
});
