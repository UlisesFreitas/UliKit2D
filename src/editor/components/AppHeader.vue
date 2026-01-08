<script setup lang="ts">

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

import { world } from '../../engine/ecs/ECS';

const editorStore = useEditorStore();

// Menu Actions
const onNewProject = () => ProjectManager.createProject();
const onOpenProject = () => ProjectManager.openProject();
const onSaveProject = () => ProjectManager.saveProject();
const onExit = () => window.close(); // Simple mock

const createAsset = (type: 'Empty' | 'Sprite' | 'Camera' | 'Text' | 'Animator' | 'BitmapText' | 'NineSliceSprite' | 'CircleObject' | 'BoxObject') => {
    const id = crypto.randomUUID();
    let data: any = {
        id,
        name: type === 'Empty' ? 'New Entity' : `New ${type}`,
        visible: true,
        transform: { x: 0, y: 0, rotation: 0, scale: { x: 1, y: 1 }, zIndex: 0 }
    };

    if (type === 'Sprite') {
        data.sprite = { texture: '' };
    } else if (type === 'Camera') {
        data.camera = { zoom: 1, isPrimary: false, backgroundColor: '#000000' };
    } else if (type === 'Text') {
        data.label = { 
            text: 'New Text', 
            fontSize: 24, 
            fontFamily: 'Arial', 
            color: '#ffffff', 
            align: 'center' 
        };
    } else if (type === 'Animator') {
        data.sprite = { texture: '' };
        data.animator = {
            currentAnim: '',
            isPlaying: true,
            speed: 1,
            elapsedTime: 0,
            animations: {}
        };
    } else if (type === 'BitmapText') {
        data.bitmapText = {
            text: 'Bitmap Text',
            fontName: '',
            fontSize: 32,
            tint: 0xffffff,
            align: 'left'
        };
    } else if (type === 'NineSliceSprite') {
        data.nineSliceSprite = {
            texture: '',
            width: 100, 
            height: 100,
            left: 10, right: 10, top: 10, bottom: 10
        };
    } else if (type === 'CircleObject') {
        data.name = 'Circle Physics';
        data.rigidBody = { mass: 1, isStatic: false, friction: 0.5, restitution: 0.5 };
        data.circleCollider = { radius: 25 };
    } else if (type === 'BoxObject') {
        data.name = 'Box Physics';
        data.rigidBody = { mass: 1, isStatic: false, friction: 0.5, restitution: 0.5 };
        data.boxCollider = { width: 50, height: 50 };
    }

    world.add(data);
    editorStore.selectEntity(id);
};

</script>

<template>
    <div class="app-header h-10 flex items-center justify-between px-4 bg-bg-header border-b border-border select-none text-text-primary">
        
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
                            <MenubarItem class="menu-item">Toggle Sidebar</MenubarItem>
                            <MenubarItem class="menu-item">Toggle Panel</MenubarItem>
                             <MenubarSeparator class="menu-separator" />
                             <MenubarItem class="menu-item" @select="editorStore.zoomIn">Zoom In</MenubarItem>
                             <MenubarItem class="menu-item" @select="editorStore.zoomOut">Zoom Out</MenubarItem>
                             <MenubarItem class="menu-item" @select="editorStore.resetZoom">Reset Zoom</MenubarItem>
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

        <!-- Right: Project Info -->
        <div class="flex items-center text-xs text-gray-500">
            <span class="mr-4">{{ projectState.projectName }}</span>
            <span>v0.0.1</span>
        </div>
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
