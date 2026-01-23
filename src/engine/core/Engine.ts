import { PhysicsSystem } from '../physics/PhysicsSystem';
// import { PhysicsDebugSystem } from '../systems/PhysicsDebugSystem';
import { ScriptSystem } from '../scripting/ScriptSystem';
import { AudioSystem } from '../audio/AudioSystem';
import { AnimationSystem } from '../systems/AnimationSystem';
import { RenderSystem } from '../systems/RenderSystem';
import { EditorDebugSystem } from '../systems/EditorDebugSystem';
import { EditorTilemapSystem } from '../../editor/systems/EditorTilemapSystem';
import { Input } from '../input/InputManager';
import { Application } from 'pixi.js';
import { CharacterSystem } from '../systems/CharacterSystem';

export class Engine {
    public app: Application;
    private isRunning: boolean = false;
    private isSimulationRunning: boolean = false;
    private lastTime: number = 0;
    private physicsSystem: PhysicsSystem;
    private scriptSystem: ScriptSystem;
    private audioSystem: AudioSystem;
    private animationSystem: AnimationSystem;
    private characterSystem: CharacterSystem; // Added
    public renderSystem: RenderSystem;
    public editorDebugSystem: EditorDebugSystem;
    public editorTilemapSystem: EditorTilemapSystem;

    public onUpdate: ((deltaTime: number) => void) | null = null;
    public onRender: (() => void) | null = null;


    constructor() {
        this.app = new Application();
        this.physicsSystem = new PhysicsSystem();
        this.scriptSystem = new ScriptSystem();
        this.audioSystem = new AudioSystem();
        this.animationSystem = new AnimationSystem();
        this.characterSystem = new CharacterSystem(); // Added
        this.renderSystem = new RenderSystem(this.app);
        this.editorDebugSystem = new EditorDebugSystem(this.app);
        this.editorTilemapSystem = new EditorTilemapSystem(this.app);
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

    public configureInput(settings: { actions: Record<string, string[]>, axes: Record<string, any> }) {
        Input.loadConfig(settings);
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
        // Input.reset(); 
        this.audioSystem.start();
    }

    public stopSimulation() {
        this.isSimulationRunning = false;
        // Input.reset();
        this.audioSystem.stopAll();
    }

    public getPhysics() {
        return this.physicsSystem;
    }

    // Time Settings
    public timeScale: number = 1.0;
    
    public setTimeSettings(settings: { fixedTimestep: number, maxAllowedTimestep: number, timeScale: number }) {
        this.timeScale = settings.timeScale;
        // Optionally pass fixedTimestep to PhysicsSystem if managed there
        // this.physicsSystem.setTimeSettings(settings);
    }

    private gameLoop = (time: number) => {
        if (!this.isRunning) return;

        const rawDelta = time - this.lastTime;
        this.lastTime = time;
        
        // Apply Time Scale
        const deltaTime = rawDelta * this.timeScale;

        // Input Update (Always run to clear frame flags)
        Input.update();
        if (this.isSimulationRunning) {
            this.physicsSystem.update(deltaTime);
            this.characterSystem.update(deltaTime); // Added
            this.scriptSystem.update(deltaTime);
            this.animationSystem.update(deltaTime / 1000);
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
        // this.physicsDebugSystem.update();
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
