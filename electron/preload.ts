const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  watchProject: (path: string) => ipcRenderer.invoke('project:watch', path),
  onFileEvent: (callback: (event: any, data: any) => void) => {
      ipcRenderer.removeAllListeners('file:event');
      ipcRenderer.on('file:event', callback);
  },
  importFile: (source: string, project: string, customName?: string) => ipcRenderer.invoke('import:file', source, project, customName),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  // Project Management
  selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  createProject: (path: string) => ipcRenderer.invoke('project:create', path),
  readdir: (path: string) => ipcRenderer.invoke('fs:readdir', path),

  
  // Shell
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path),

  // Generic File I/O
  showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:showOpenDialog', options),
  openFile: (filters: any[]) => ipcRenderer.invoke('dialog:openFile', filters),
  saveFile: (filters: any[]) => ipcRenderer.invoke('dialog:saveFile', filters),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  deleteFile: (path: string) => ipcRenderer.invoke('fs:deleteFile', path),
  createFolder: (path: string) => ipcRenderer.invoke('fs:createFolder', path)
});
