<template>
    <div class="welcome-screen h-full w-full flex flex-col items-center justify-center bg-[#1e1e1e] text-white select-none">
        
        <div class="bg-[#252526] p-8 rounded-lg shadow-xl border border-[#333] w-[400px] flex flex-col items-center">
            <!-- Logo / Icon -->
            <div class="mb-6 text-6xl font-bold text-blue-500">U</div>
            
            <h1 class="text-2xl font-bold mb-2">UliKit2D Engine</h1>
            <p class="text-gray-500 mb-8 text-sm">Version 0.0.1</p>
            
            <!-- Actions -->
            <div class="w-full space-y-3">
                <button 
                    @click="ProjectManager.createProject()" 
                    class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors flex items-center justify-center gap-2"
                >
                    <span>+</span> Create New Project
                </button>
                
                <button 
                    @click="ProjectManager.openProject()" 
                    class="w-full py-2 px-4 bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white rounded transition-colors border border-[#454545] flex items-center justify-center gap-2"
                >
                    <span>📂</span> Open Project
                </button>
            </div>
            
            <!-- Optional: Recent Projects List could go here -->
            <div class="mt-8 text-xs text-gray-600">
                UliKit2D - Agentic Game Engine
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ProjectManager } from '../managers/ProjectManager';
</script>

<style scoped>
.welcome-screen {
    background-image: radial-gradient(circle at center, #2a2a2a 0%, #1e1e1e 100%);
}
</style>
