import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar, { FSWatcher } from 'chokidar';

import config from '../ukit.config.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

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
        
        const projectConfig = {
            name: path.basename(folderPath),
            version: '1.0.0',
            params: {}
        };
        
        await fs.writeFile(
            path.join(folderPath, 'project.json'), 
            JSON.stringify(projectConfig, null, 4)
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
            const files = await fs.readdir(sourceAssetsPath);
            console.log(`[Main] Found ${files.length} assets.`);
            for (const file of files) {
                const src = path.join(sourceAssetsPath, file);
                const dest = path.join(assetsPath, file);
                
                const stat = await fs.stat(src);
                if (stat.isFile()) {
                    await fs.copyFile(src, dest);
                    console.log(`[Main] Copied ${file} to ${dest}`);
                }
            }
        } catch (err) {
            console.error('Failed to copy default assets:', err);
        }
        // -------------------------------
        
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

ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    const fs = await import('fs/promises');
    try {
        await fs.unlink(filePath);
        return true;
    } catch (e: any) {
        throw new Error(e.message);
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (watcher) watcher.close();
    if (process.platform !== 'darwin') app.quit();
});
