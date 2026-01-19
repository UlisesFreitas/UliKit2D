import { PhysicsSystem } from '../physics/PhysicsSystem';
import { PhysicsDebugSystem } from '../systems/PhysicsDebugSystem';
import { ScriptSystem } from '../scripting/ScriptSystem';
import { AudioSystem } from '../audio/AudioSystem';
import { AnimationSystem } from '../systems/AnimationSystem';
import { RenderSystem } from '../systems/RenderSystem';
import { EditorDebugSystem } from '../systems/EditorDebugSystem';
import { EditorTilemapSystem } from '../../editor/systems/EditorTilemapSystem';
import { Input } from '../input/InputManager';
import { Application } from 'pixi.js';

export class Engine {
    public app: Application;
    private isRunning: boolean = false;
    private isSimulationRunning: boolean = false;
    private lastTime: number = 0;
    private physicsSystem: PhysicsSystem;
    private scriptSystem: ScriptSystem;
    private audioSystem: AudioSystem;
    private animationSystem: AnimationSystem;
    public renderSystem: RenderSystem;
    public editorDebugSystem: EditorDebugSystem;
    public physicsDebugSystem: PhysicsDebugSystem;
    public editorTilemapSystem: EditorTilemapSystem; // Added

    public onUpdate: ((deltaTime: number) => void) | null = null;
    public onRender: (() => void) | null = null;

    constructor() {
        this.app = new Application();
        this.physicsSystem = new PhysicsSystem();
        this.scriptSystem = new ScriptSystem();
        this.audioSystem = new AudioSystem();
        this.animationSystem = new AnimationSystem();
        // RenderSystem initialized later or passed app reference? 
        // We need app to be init first usually, but we can pass existing instance.
        // Actually app is created in constructor, so we can pass it.
        this.renderSystem = new RenderSystem(this.app);
        this.editorDebugSystem = new EditorDebugSystem(this.app);
        this.physicsDebugSystem = new PhysicsDebugSystem(this.app);
        this.editorTilemapSystem = new EditorTilemapSystem(this.app); // Added
    }

    public async init(container: HTMLElement) {
        await this.app.init({
            resizeTo: container,
            backgroundAlpha: 0,
            preference: 'webgpu',
        });
        container.appendChild(this.app.canvas);
        Input.initialize(this.app.canvas);
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.gameLoop);
    }

    public stop() {
        this.isRunning = false;
        this.isSimulationRunning = false;
    }

    public resize() {
        this.app.resize();
    }

    public startSimulation() {
        this.isSimulationRunning = true;
        Input.reset();
        this.audioSystem.start();
    }

    public stopSimulation() {
        this.isSimulationRunning = false;
        Input.reset();
        this.audioSystem.stopAll();
    }

    public getPhysics() {
        return this.physicsSystem;
    }

    private gameLoop = (time: number) => {
        if (!this.isRunning) return;

        const deltaTime = time - this.lastTime;
        this.lastTime = time;

        if (this.isSimulationRunning) {
            this.physicsSystem.update(deltaTime);
            Input.update(); // Update input state (clears frame-based flags)
            this.scriptSystem.update(deltaTime);
            this.animationSystem.update(deltaTime / 1000); // Pass seconds
        }

        // Custom Logic Update
        if (this.onUpdate) {
            this.onUpdate(deltaTime);
        }


        // Render Update (Syncs ECS to Pixi)
        this.renderSystem.update();
        if (this.editorTilemapSystem) {
             this.editorTilemapSystem.update(); // Added
        }
        this.physicsDebugSystem.update();
        if (this.editorDebugSystem) {
             this.editorDebugSystem.update();
        }

        if (this.onRender) {
            this.onRender();
        }

        requestAnimationFrame(this.gameLoop);
    }
}

export const instance = new Engine();
