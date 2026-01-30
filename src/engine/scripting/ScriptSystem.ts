
import { world } from '../ecs/ECS';
import { projectState } from '../../editor/managers/ProjectManager';
import { getFileSystem, type FileChangeEvent } from '../../api/FileSystem';

import { SceneManager } from '../managers/SceneManager';
import { eventBus } from '../core/EventBus';

export class ScriptSystem {
    private scriptCache: Map<string, any> = new Map();
    private resolvedPathCache: Map<string, string> = new Map();
    private pendingPaths: Set<string> = new Set();
    private erroredScripts: Set<string> = new Set();

    constructor() {
        const fs = getFileSystem();
        
        // Expose SceneManager to global scope for scripts
        if (!(window as any).SceneManager) {
            (window as any).SceneManager = SceneManager;
            console.log('[ScriptSystem] Exposed SceneManager to window');
        }

        // Listen for Collision Events from PhysicsSystem
        eventBus.on('collision-start', (payload: any) => {
            this.handleCollisionEvent('onCollisionStart', payload.entityA, payload.entityB);
            this.handleCollisionEvent('onCollisionStart', payload.entityB, payload.entityA);
        });

        eventBus.on('collision-end', (payload: any) => {
            this.handleCollisionEvent('onCollisionEnd', payload.entityA, payload.entityB);
            this.handleCollisionEvent('onCollisionEnd', payload.entityB, payload.entityA);
        });
        
        // Listen for file changes (Hot Reload)
        // ... (rest of constructor)
        if (projectState.currentProjectPath) {
            fs.watchProject(projectState.currentProjectPath, (event: FileChangeEvent) => {
                if (event.event === 'change' || event.event === 'add') {
                     const path = event.path.replace(/\\/g, '/');
                     console.log('[ScriptSystem] File changed:', path);
                     
                     // Invalidate caches for this file
                     if (path.endsWith('.js') || path.endsWith('.ts')) {
                        for (const key of this.scriptCache.keys()) {
                            if (path.includes(key)) {
                                console.log('[ScriptSystem] Hot Reloading:', key);
                                this.scriptCache.delete(key);
                                this.resolvedPathCache.delete(key);
                                this.erroredScripts.delete(key);
                            }
                         }
                     }
                }
            });
        }
    }

    private async handleCollisionEvent(functionName: string, entity: any, other: any) {
        if (!entity || !other || !entity.script) return;

        for (const scriptData of entity.script) {
            if (!scriptData.path) continue;
            
            // Check cache (assume loaded if running)
            // If not in cache, maybe it hasn't loaded yet? 
            // We can try to load, but typically Update loop handles loading. 
            // We'll skip if not ready to avoid async race conditions in event handlers.
            const cacheKey = scriptData.path; 
            const scriptModule = this.scriptCache.get(cacheKey);

            if (scriptModule && typeof scriptModule[functionName] === 'function') {
                try {
                    const params = scriptData.parameters || {};
                    scriptModule[functionName](entity, other, params);
                } catch (e) {
                     console.error(`[ScriptSystem] Error in ${functionName} for ${scriptData.path}:`, e);
                }
            }
        }
    }

    public async update(deltaTime: number) {
        // Query entities with script component
        const entities = world.with('script');

        for (const entity of entities) {
            // DEBUG: Check if we are processing a removed script
            // console.log('[ScriptSystem] Processing Entity:', entity.id, 'Has script component:', !!entity.script);

            if (!entity.script || entity.script.length === 0) continue;

            for (const scriptData of entity.script) {
                if (!scriptData.path) continue;

                const scriptPath = scriptData.path;
                const cacheKey = scriptPath;
                
                // Skip if previously errored to prevent massive console spam
                if (this.erroredScripts.has(cacheKey)) continue;

                const fs = getFileSystem();

                // 1. Resolve Path
                if (!this.resolvedPathCache.has(cacheKey)) {
                    if (!this.pendingPaths.has(cacheKey)) {
                        this.pendingPaths.add(cacheKey);
                        fs.getAssetURL(scriptPath).then(url => {
                            this.resolvedPathCache.set(cacheKey, url);
                            this.pendingPaths.delete(cacheKey);
                        }).catch(err => {
                            console.error(`[ScriptSystem] Failed to resolve script path: ${scriptPath}`, err);
                            this.erroredScripts.add(cacheKey);
                            this.pendingPaths.delete(cacheKey);
                        });
                    }
                    continue; // Skip until resolved
                }

                const importPath = this.resolvedPathCache.get(cacheKey)!;
                let scriptModule = this.scriptCache.get(cacheKey);

                if (!scriptModule) {
                    try {
                        // Dynamic import with cache busting for HMR
                        // Note: Blob URLs (Web) do not support query params and are unique per createObjectURL anyway
                        const isBlob = importPath.startsWith('blob:');
                        const cacheBuster = isBlob ? '' : `?t=${Date.now()}`;
                        
                        // Vite requires /@fs/ or blob URLs to be handled correctly
                        // getAssetURL already provides the correct platform-specific URL
                        // @ts-ignore
                        scriptModule = await import(/* @vite-ignore */ importPath + cacheBuster);
                        this.scriptCache.set(cacheKey, scriptModule);
                        this.erroredScripts.delete(cacheKey);
                    } catch (e) {
                        console.error(`[ScriptSystem] Failed to load script: ${scriptPath}`, e);
                        this.erroredScripts.add(cacheKey);
                        continue;
                    }
                }

                // 2. Execute update function
                if (scriptModule && typeof scriptModule.update === 'function') {
                    try {
                        const params = scriptData.parameters || {};
                        scriptModule.update(entity, deltaTime, params);
                    } catch (e) {
                        console.error(`[ScriptSystem] Error in script ${scriptPath}:`, e);
                        this.erroredScripts.add(cacheKey);
                    }
                }
            }
        }
    }
}
