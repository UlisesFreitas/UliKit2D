import { reactive } from 'vue';
import { getFileSystem, type FileChangeEvent } from '../../api/FileSystem';

export const projectState = reactive({
    currentProjectPath: null as string | FileSystemDirectoryHandle | null,
    isDirty: false,
    projectName: 'Untitled'
});

export class ProjectManager {
    
    static async createProject() {
        console.log('ProjectManager: Creating new project...');
        const fs = getFileSystem();
        const pathOrHandle = await fs.selectFolder();
        
        if (pathOrHandle) {
            const result = await fs.createProject(pathOrHandle as any);
            if (result.success) {
                 projectState.currentProjectPath = pathOrHandle;
                 
                 if (typeof pathOrHandle === 'string') {
                    projectState.projectName = pathOrHandle.split(/[/\\]/).pop() || 'New Project';
                 } else {
                    projectState.projectName = (pathOrHandle as FileSystemDirectoryHandle).name;
                 }
                 
                 // Watch Project
                 await fs.watchProject(pathOrHandle as any, (_event: FileChangeEvent) => {
                    // This will be handled by AssetStore usually
                 });
                 console.log('Project Created:', projectState.projectName);
            } else {
                console.error('Failed to create project:', result.error);
                alert('Failed to create project: ' + result.error);
            }
        }
    }

    static async openProject() {
        console.log('ProjectManager: Opening project...');
        const fs = getFileSystem();
        const pathOrHandle = await fs.selectFolder();
        
        if (pathOrHandle) {
            projectState.currentProjectPath = pathOrHandle;
            
            if (typeof pathOrHandle === 'string') {
                projectState.projectName = pathOrHandle.split(/[/\\]/).pop() || 'Project';
             } else {
                projectState.projectName = (pathOrHandle as FileSystemDirectoryHandle).name;
             }
            
            // Watch Project
            await fs.watchProject(pathOrHandle as any, (_event: FileChangeEvent) => {});
            
            console.log('Project Opened:', projectState.projectName);
        }
    }

    static async saveProject() {
        console.log('ProjectManager: Saving project...');
        projectState.isDirty = false;
    }
}
