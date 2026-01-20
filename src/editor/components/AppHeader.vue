<script setup lang="ts">
import { ref } from 'vue';

import { 
    MenubarRoot, 
    MenubarMenu, 
    MenubarTrigger, 
    MenubarPortal, 
    MenubarContent, 
    MenubarItem, 
    MenubarSeparator,
    MenubarSub,
    MenubarSubTrigger,
    MenubarSubContent
} from 'radix-vue';
import { ProjectManager, projectState } from '../managers/ProjectManager';
import { useEditorStore } from '../../stores/useEditorStore';
import { ThemeManager } from '../managers/ThemeManager';
import { useUIStore } from '../../stores/useUIStore';
import { useLayoutStore } from '../../stores/useLayoutStore';
import GridSettingsModal from './modals/GridSettingsModal.vue';
import ProjectSettingsModal from './modals/ProjectSettingsModal.vue';
import SaveLayoutModal from './modals/SaveLayoutModal.vue';
import { useProjectSettingsStore } from '../../stores/useProjectSettingsStore';

const editorStore = useEditorStore();
const ui = useUIStore();
const layoutStore = useLayoutStore();
const projectSettings = useProjectSettingsStore();
const showGridSettings = ref(false);
const showProjectSettings = ref(false);
const showSaveLayoutModal = ref(false);

// Menu Actions
const onNewProject = async () => {
    if (await ui.confirm({ 
        title: 'New Project', 
        message: 'Are you sure you want to close the current project and return to the dashboard? Unsaved changes may be lost.'
    })) {
        ProjectManager.closeProject();
    }
};
const onOpenProject = () => ProjectManager.openProject();
const onSaveProject = () => ProjectManager.saveProject();
const onExit = () => window.close(); // Simple mock
const onResetLayout = async () => {
    if (await ui.confirm({
        title: 'Reset Layout',
        message: 'Do you really want to reset the current layout?\nThe project will reload and unsaved changes may be lost.\nPlease ensure you save your changes first.'
    })) {
        layoutStore.resetToDefault();
    }
};

import { EntityFactory, type EntityType } from '../../engine/factories/EntityFactory';
import { instance as engine } from '../../engine/core/Engine';

// ...

const getSpawnPosition = () => {
    // 1. Get Screen Center
    const screenX = engine.app.screen.width / 2;
    const screenY = engine.app.screen.height / 2;
    
    // 2. Get Global Stage Transform (Controlled by ScenePanel)
    const stage = engine.app.stage;
    const zoom = stage.scale.x; 
    
    // 3. Project Screen Center to World Space
    const worldX = (screenX - stage.position.x) / zoom;
    const worldY = (screenY - stage.position.y) / zoom;
    
    return { x: worldX, y: worldY };
};

const createAsset = (type: EntityType) => {
    const pos = getSpawnPosition();
    const id = EntityFactory.createEntity(type, pos);
    
    editorStore.selectEntity(id);
};

</script>

<template>
    <div class="w-full">
        <div class="app-header h-10 flex items-center px-4 bg-bg-header border-b border-border select-none text-text-primary">
        
        <!-- Left: Icon + Menubar -->
        <div class="flex items-center">
            <div class="logo font-bold text-blue-500 mr-4 text-lg">U</div>
            
            <MenubarRoot class="flex bg-transparent">
                <!-- File Menu -->
                <MenubarMenu>
                    <MenubarTrigger class="menu-trigger">File</MenubarTrigger>
                    <MenubarPortal>
                        <MenubarContent class="menu-content" align="start" :sideOffset="5">
                            <MenubarItem class="menu-item" @select="onNewProject">New Project</MenubarItem>
                            <MenubarItem class="menu-item" @select="onOpenProject">Open Project...</MenubarItem>
                            <MenubarSeparator class="menu-separator" />
                            <MenubarItem class="menu-item" @select="onSaveProject">Save</MenubarItem>
                            <MenubarSeparator class="menu-separator" />
                            
                            <!-- Preferences Submenu -->
                            <MenubarSub>
                                <MenubarSubTrigger class="menu-item w-full justify-between">
                                    Preferences <span class="ml-auto text-xs">▶</span>
                                </MenubarSubTrigger>
                                <MenubarPortal>
                                    <MenubarSubContent class="menu-content" :sideOffset="2" :alignOffset="-5">
                                        <MenubarItem class="menu-item" @select="showProjectSettings = true">
                                            Project Settings...
                                        </MenubarItem>
                                        <MenubarItem class="menu-item" @select="showGridSettings = true">
                                            Grid Settings
                                        </MenubarItem>
                                        <MenubarSeparator class="menu-separator" />
                                        <MenubarSub>
                                            <MenubarSubTrigger class="menu-item w-full justify-between">
                                                Themes <span class="ml-auto text-xs">▶</span>
                                            </MenubarSubTrigger>
                                            <MenubarPortal>
                                                <MenubarSubContent class="menu-content" :sideOffset="2" :alignOffset="-5">
                                                    <MenubarItem class="menu-item" @select="ThemeManager.importTheme()">
                                                        Import Theme...
                                                    </MenubarItem>
                                                    <MenubarItem class="menu-item" @select="ThemeManager.exportTheme(ThemeManager.currentTheme.value)">
                                                        Export Current Theme
                                                    </MenubarItem>
                                                    <MenubarSeparator class="menu-separator" />
                                                    
                                                    <MenubarItem 
                                                        v-for="theme in ThemeManager.availableThemes" 
                                                        :key="theme.name"
                                                        class="menu-item"
                                                        @select="ThemeManager.applyTheme(theme)"
                                                    >
                                                        <span class="w-4 h-4 mr-2 rounded-full border border-gray-600" :style="{ background: theme.colors['--bg-base'] }"></span>
                                                        {{ theme.name }}
                                                        <span v-if="ThemeManager.currentTheme.value.name === theme.name" class="ml-auto">✓</span>
                                                    </MenubarItem>
                                                </MenubarSubContent>
                                            </MenubarPortal>
                                        </MenubarSub>
                                    </MenubarSubContent>
                                </MenubarPortal>
                            </MenubarSub>

                            <MenubarSeparator class="menu-separator" />
                            <MenubarItem class="menu-item" @select="onExit">Exit</MenubarItem>
                        </MenubarContent>
                    </MenubarPortal>
                </MenubarMenu>

                <!-- Assets Menu -->
                <MenubarMenu>
                    <MenubarTrigger class="menu-trigger">Assets</MenubarTrigger>
                    <MenubarPortal>
                        <MenubarContent class="menu-content" align="start" :sideOffset="5">
                             <MenubarSub>
                                <MenubarSubTrigger class="menu-item w-full justify-between">
                                    Create <span class="ml-auto text-xs">▶</span>
                                </MenubarSubTrigger>
                                <MenubarPortal>
                                    <MenubarSubContent class="menu-content" :sideOffset="2" :alignOffset="-5">
                                        <MenubarItem class="menu-item" @select="createAsset('Sprite')">
                                            <span class="mr-2">🖼️</span> Sprite
                                        </MenubarItem>
                                        <MenubarItem class="menu-item" @select="createAsset('Camera')">
                                            <span class="mr-2">📷</span> Camera
                                        </MenubarItem>
                                        <MenubarItem class="menu-item" @select="createAsset('Animator')">
                                            <span class="mr-2">🎬</span> Animator
                                        </MenubarItem>
                                        <MenubarItem class="menu-item" @select="createAsset('Text')">
                                            <span class="mr-2">📝</span> Text Label
                                        </MenubarItem>
                                        <MenubarItem class="menu-item" @select="createAsset('BitmapText')">
                                            <span class="mr-2">🔤</span> Bitmap Text
                                        </MenubarItem>
                                        <MenubarItem class="menu-item" @select="createAsset('NineSliceSprite')">
                                            <span class="mr-2">🍱</span> Nine Slice Sprite
                                        </MenubarItem>
                                        <MenubarSeparator class="menu-separator" />
                                        <MenubarItem class="menu-item" @select="createAsset('CircleObject')">
                                            <span class="mr-2">⚪</span> Circle Physics Object
                                        </MenubarItem>
                                        <MenubarItem class="menu-item" @select="createAsset('BoxObject')">
                                            <span class="mr-2">📦</span> Box Physics Object
                                        </MenubarItem>
                                        <MenubarSeparator class="menu-separator" />
                                        <MenubarItem class="menu-item" @select="createAsset('Empty')">
                                             <span class="mr-2">🧊</span> Empty Entity
                                        </MenubarItem>
                                    </MenubarSubContent>
                                </MenubarPortal>
                            </MenubarSub>
                        </MenubarContent>
                    </MenubarPortal>
                </MenubarMenu>

                <!-- Edit Menu -->
                <MenubarMenu>
                    <MenubarTrigger class="menu-trigger">Edit</MenubarTrigger>
                    <MenubarPortal>
                        <MenubarContent class="menu-content" align="start" :sideOffset="5">
                             <MenubarItem class="menu-item" @select="editorStore.undo" :disabled="!editorStore.canUndo">
                                Undo <div class="ml-auto text-xs text-gray-500">Ctrl+Z</div>
                            </MenubarItem>
                            <MenubarItem class="menu-item" @select="editorStore.redo" :disabled="!editorStore.canRedo">
                                Redo <div class="ml-auto text-xs text-gray-500">Ctrl+Y</div>
                            </MenubarItem>
                            <MenubarSeparator class="menu-separator" />
                            <MenubarItem class="menu-item" @select="editorStore.copy">
                                Copy <div class="ml-auto text-xs text-gray-500">Ctrl+C</div>
                            </MenubarItem>
                             <MenubarItem class="menu-item" @select="editorStore.paste">
                                Paste <div class="ml-auto text-xs text-gray-500">Ctrl+V</div>
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarPortal>
                </MenubarMenu>
                
                <!-- View Menu -->
                <MenubarMenu>
                    <MenubarTrigger class="menu-trigger">View</MenubarTrigger>
                    <MenubarPortal>
                        <MenubarContent class="menu-content" align="start" :sideOffset="5">
                             <MenubarItem class="menu-item" @select="editorStore.zoomIn">Zoom In</MenubarItem>
                             <MenubarItem class="menu-item" @select="editorStore.zoomOut">Zoom Out</MenubarItem>
                             <MenubarItem class="menu-item" @select="editorStore.resetZoom">Reset Zoom</MenubarItem>
                        </MenubarContent>
                    </MenubarPortal>
                </MenubarMenu>

                <!-- Layout Menu -->
                <MenubarMenu>
                    <MenubarTrigger class="menu-trigger">Layout</MenubarTrigger>
                    <MenubarPortal>
                         <MenubarContent class="menu-content" align="start" :sideOffset="5">
                             <MenubarItem class="menu-item" @select="layoutStore.togglePanel('scenes', 'Scenes')">Scenes</MenubarItem>
                             <MenubarItem class="menu-item" @select="layoutStore.togglePanel('hierarchy', 'Hierarchy')">Hierarchy</MenubarItem>
                             <MenubarItem class="menu-item" @select="layoutStore.togglePanel('assets', 'Assets')">Assets</MenubarItem>
                             <MenubarItem class="menu-item" @select="layoutStore.togglePanel('scene', 'Scene View')">Scene View</MenubarItem>
                             <MenubarItem class="menu-item" @select="layoutStore.togglePanel('console', 'Console')">Console</MenubarItem>
                             <MenubarItem class="menu-item" @select="layoutStore.togglePanel('inspector', 'Inspector')">Inspector</MenubarItem>
                             <MenubarItem class="menu-item" @select="layoutStore.togglePanel('layers', 'Layers')">Layers</MenubarItem>
                             <MenubarSeparator class="menu-separator" />
                             <MenubarItem class="menu-item" @select="layoutStore.openPanel('tilemap-settings', 'Tilemap Settings')">
                                Tilemap Settings
                            </MenubarItem>
                             <MenubarSeparator class="menu-separator" />
                             <MenubarItem class="menu-item" @select="showSaveLayoutModal = true">Save Layout...</MenubarItem>
                             
                             <MenubarSub>
                                <MenubarSubTrigger class="menu-item flex justify-between items-center">
                                    My Layouts
                                    <span class="ml-auto pl-2">›</span>
                                </MenubarSubTrigger>
                                <MenubarPortal>
                                    <MenubarSubContent class="menu-content" :sideOffset="2" :alignOffset="-5">
                                        <div v-if="Object.keys(projectSettings.settings.layouts || {}).length === 0" class="px-2 py-1.5 text-xs text-text-disabled italic">No saved layouts</div>
                                        <MenubarItem 
                                            v-else
                                            v-for="(_, name) in projectSettings.settings.layouts" 
                                            :key="name" 
                                            class="menu-item" 
                                            @select="layoutStore.restoreNamedLayout(name as string)"
                                        >
                                            {{ name }}
                                        </MenubarItem>
                                    </MenubarSubContent>
                                </MenubarPortal>
                             </MenubarSub>

                             <MenubarSeparator class="menu-separator" />
                             <MenubarItem class="menu-item" @select="onResetLayout">Default Layout</MenubarItem>
                         </MenubarContent>
                    </MenubarPortal>
                </MenubarMenu>

                <!-- Help Menu -->
                 <MenubarMenu>
                    <MenubarTrigger class="menu-trigger">Help</MenubarTrigger>
                    <MenubarPortal>
                        <MenubarContent class="menu-content" align="start" :sideOffset="5">
                            <MenubarItem class="menu-item">About</MenubarItem>
                            <MenubarItem class="menu-item">Documentation</MenubarItem>
                        </MenubarContent>
                    </MenubarPortal>
                </MenubarMenu>
            </MenubarRoot>
        </div>
        
        <div class="flex-1"></div>

        <!-- Right: Icons & Project Info -->
        <div class="flex items-center gap-4">
            <!-- Panel Toggles -->
            <div class="flex items-center gap-1 border-r border-border pr-3 mr-1">
                <!-- Scenes -->
                <button 
                    class="p-1 rounded transition-colors"
                    :class="layoutStore.isPanelOpen('scenes') ? 'text-accent-color bg-bg-selection' : 'text-text-disabled hover:text-text-primary'"
                    @click="layoutStore.togglePanel('scenes', 'Scenes')" 
                    title="Toggle Scenes"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
                </button>
                <!-- Hierarchy -->
                <button 
                    class="p-1 rounded transition-colors"
                    :class="layoutStore.isPanelOpen('hierarchy') ? 'text-accent-color bg-bg-selection' : 'text-text-disabled hover:text-text-primary'"
                    @click="layoutStore.togglePanel('hierarchy', 'Hierarchy')" 
                    title="Toggle Hierarchy"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                </button>
                 <!-- Assets -->
                <button 
                    class="p-1 rounded transition-colors"
                    :class="layoutStore.isPanelOpen('assets') ? 'text-accent-color bg-bg-selection' : 'text-text-disabled hover:text-text-primary'"
                    @click="layoutStore.togglePanel('assets', 'Assets')" 
                    title="Toggle Assets"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                </button>
                <!-- Scene View Removed (Permanent) -->
                <!-- Console -->
                <button 
                    class="p-1 rounded transition-colors"
                    :class="layoutStore.isPanelOpen('console') ? 'text-accent-color bg-bg-selection' : 'text-text-disabled hover:text-text-primary'"
                    @click="layoutStore.togglePanel('console', 'Console')" 
                    title="Toggle Console"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                </button>
                 <!-- Inspector -->
                <button 
                    class="p-1 rounded transition-colors"
                    :class="layoutStore.isPanelOpen('inspector') ? 'text-accent-color bg-bg-selection' : 'text-text-disabled hover:text-text-primary'"
                    @click="layoutStore.togglePanel('inspector', 'Inspector')" 
                    title="Toggle Inspector"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </button>
                <!-- Layers -->
                <button 
                    class="p-1 rounded transition-colors"
                    :class="layoutStore.isPanelOpen('layers') ? 'text-accent-color bg-bg-selection' : 'text-text-disabled hover:text-text-primary'"
                    @click="layoutStore.togglePanel('layers', 'Layers')" 
                    title="Toggle Layers"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                </button>
            </div>

            <!-- Grid Settings Icon -->
            <button class="p-1 hover:text-accent-color rounded text-text-secondary" @click="showGridSettings = true" title="Grid Settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            </button>

            <!-- Project Info -->
            <div class="flex items-center text-xs text-text-disabled">
                <span class="mr-4">{{ projectState.projectName }}</span>
                <span>v0.0.1</span>
            </div>
        </div>
        
        </div>
        
        <GridSettingsModal v-model:open="showGridSettings" />
        <ProjectSettingsModal v-model:open="showProjectSettings" />
        <SaveLayoutModal v-model:open="showSaveLayoutModal" />
    </div>
</template>

<style>
/* Radix/VSCode Styles */
.menu-trigger {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    cursor: default;
    outline: none;
}
.menu-trigger:hover, .menu-trigger[data-state='open'] {
    background-color: var(--bg-hover);
    color: var(--text-primary);
}

.menu-content {
    min-width: 220px;
    background-color: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    z-index: 10000;
}

.menu-item {
    font-size: 13px;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: default;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    outline: none;
}

.menu-item:hover, .menu-item[data-highlighted] {
    background-color: var(--bg-selection);
    color: var(--text-accent);
}

.menu-separator {
    height: 1px;
    background-color: var(--border-color);
    margin: 4px 0;
}
</style>
