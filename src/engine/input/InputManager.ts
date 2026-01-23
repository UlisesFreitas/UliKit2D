export class InputManager {
    private static instance: InputManager;
    private canvas: HTMLCanvasElement | null = null;
    
    // Keyboard State
    private keys: Set<string> = new Set();
    private keysDown: Set<string> = new Set(); // Frame-based: Pressed this frame
    private keysUp: Set<string> = new Set();   // Frame-based: Released this frame

    // Mouse State
    private mouseButtons: Set<number> = new Set();
    private mouseButtonsDown: Set<number> = new Set();
    private mouseButtonsUp: Set<number> = new Set();
    private mousePosition: { x: number, y: number } = { x: 0, y: 0 };
    private mouseWheel: number = 0; // Frame-based

    private constructor() {
        // Private constructor for Singleton
    }

    public static getInstance(): InputManager {
        if (!InputManager.instance) {
            InputManager.instance = new InputManager();
            (window as any).Input = InputManager.instance;
            console.log('[InputManager] Initialized and exposed as window.Input');
        }
        return InputManager.instance;
    }

    public initialize(canvas: HTMLCanvasElement) {
        if (this.canvas) this.cleanup();
        this.canvas = canvas;

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp); 
        canvas.addEventListener('wheel', this.onWheel);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    public cleanup() {
        if (this.canvas) {
            window.removeEventListener('keydown', this.onKeyDown);
            window.removeEventListener('keyup', this.onKeyUp);
            this.canvas.removeEventListener('mousemove', this.onMouseMove);
            this.canvas.removeEventListener('mousedown', this.onMouseDown);
            window.removeEventListener('mouseup', this.onMouseUp);
            this.canvas.removeEventListener('wheel', this.onWheel);
            this.canvas = null;
        }
        this.reset();
    }

    public reset() {
        this.keys.clear();
        this.keysDown.clear();
        this.keysUp.clear();
        this.mouseButtons.clear();
        this.mouseButtonsDown.clear();
        this.mouseButtonsUp.clear();
        this.mouseWheel = 0;
    }

    // Called at the START of the frame to clear 1-frame states
    public update() {
        this.keysDown.clear();
        this.keysUp.clear();
        this.mouseButtonsDown.clear();
        this.mouseButtonsUp.clear();
        this.mouseWheel = 0;
    }

    // --- Events ---

    private onKeyDown = (e: KeyboardEvent) => {
        // Prevent default browser actions for game keys if needed (like arrow scrolling)
        // Global Input Prevention (Stop Scrolling / Stop Native Button Clicks)
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            const target = e.target as HTMLElement;
            // Allow typing in Inputs/Textareas
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            
            if (!isInput) {
                e.preventDefault();
            }
        }
        
        if (!this.keys.has(e.code)) {
            this.keysDown.add(e.code); // First press
        }
        this.keys.add(e.code);
    };

    private onKeyUp = (e: KeyboardEvent) => {
        this.keys.delete(e.code);
        this.keysUp.add(e.code);
    };

    private onMouseMove = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.mousePosition.x = e.clientX - rect.left;
        this.mousePosition.y = e.clientY - rect.top;
    };

    private onMouseDown = (e: MouseEvent) => {
        if (!this.mouseButtons.has(e.button)) {
            this.mouseButtonsDown.add(e.button);
        }
        this.mouseButtons.add(e.button);
    };

    private onMouseUp = (e: MouseEvent) => {
        if (this.mouseButtons.has(e.button)) {
            this.mouseButtonsUp.add(e.button);
            this.mouseButtons.delete(e.button);
        }
    };

    private onWheel = (e: WheelEvent) => {
        this.mouseWheel = e.deltaY;
        // e.preventDefault(); // Prevent page scroll
    };

    // --- API ---

    // Configuration
    private actions: Record<string, string[]> = {};
    private axes: Record<string, { negative: string; positive: string; altNegative?: string; altPositive?: string; gravity: number; sensitivity: number; dead: number }> = {};
    
    // Axis State (for smoothing) - TODO: Implement gravity/sensitivity
    // For now we use raw Digital input for Axes until time delta is threaded through Input or updated.

    public loadConfig(config: { actions: Record<string, string[]>, axes: Record<string, any> }) {
        this.actions = config.actions || {};
        this.axes = config.axes || {};
        console.log('[InputManager] Configuration loaded', this.actions, this.axes);
    }

    // --- API ---

    // Keys (e.code preferred: "Space", "KeyW", "ArrowUp")
    public isKeyDown(keyCode: string): boolean {
        return this.keys.has(keyCode);
    }

    public isKeyPressed(keyCode: string): boolean {
        return this.keysDown.has(keyCode);
    }

    public isKeyReleased(keyCode: string): boolean {
        return this.keysUp.has(keyCode);
    }

    public get activeKeys(): string[] {
        return Array.from(this.keys);
    }

    // Actions
    public isActionPressed(actionName: string): boolean {
        const keys = this.actions[actionName];
        if (!keys) return false;
        return keys.some(k => this.isKeyDown(k) || (k.startsWith('Mouse') && this.checkMouseAction(k)));
    }
    
    public isActionJustPressed(actionName: string): boolean {
        const keys = this.actions[actionName];
        if (!keys) return false;
        return keys.some(k => this.isKeyPressed(k) || (k.startsWith('Mouse') && this.checkMouseActionJust(k)));
    }

    public isActionJustReleased(actionName: string): boolean {
        const keys = this.actions[actionName];
        if (!keys) return false;
        return keys.some(k => this.isKeyReleased(k) || (k.startsWith('Mouse') && this.checkMouseActionUp(k)));
    }

    // Helper for Mouse Strings (Mouse0, MouseLeft, etc)
    private checkMouseAction(key: string): boolean {
        if (key === 'MouseLeft' || key === 'Mouse0') return this.mouseButtons.has(0);
        if (key === 'MouseMiddle' || key === 'Mouse1') return this.mouseButtons.has(1);
        if (key === 'MouseRight' || key === 'Mouse2') return this.mouseButtons.has(2);
        return false;
    }
    
    private checkMouseActionJust(key: string): boolean {
        if (key === 'MouseLeft' || key === 'Mouse0') return this.mouseButtonsDown.has(0);
        if (key === 'MouseMiddle' || key === 'Mouse1') return this.mouseButtonsDown.has(1);
        if (key === 'MouseRight' || key === 'Mouse2') return this.mouseButtonsDown.has(2);
        return false;
    }

    private checkMouseActionUp(key: string): boolean {
        if (key === 'MouseLeft' || key === 'Mouse0') return this.mouseButtonsUp.has(0);
        if (key === 'MouseMiddle' || key === 'Mouse1') return this.mouseButtonsUp.has(1);
        if (key === 'MouseRight' || key === 'Mouse2') return this.mouseButtonsUp.has(2);
        return false;
    }

    // Mouse (0: Left, 1: Middle, 2: Right)
    public getMouseButton(button: number): boolean {
        return this.mouseButtons.has(button);
    }

    public getMouseButtonDown(button: number): boolean {
        return this.mouseButtonsDown.has(button);
    }

    public getMouseButtonUp(button: number): boolean {
        return this.mouseButtonsUp.has(button);
    }

    public getMousePosition(): { x: number, y: number } {
        return { ...this.mousePosition };
    }

    public getMouseScroll(): number {
        return this.mouseWheel;
    }

    // Axes
    public getAxis(axisName: string): number {
        const config = this.axes[axisName];
        if (!config) return 0;

        let value = 0;
        
        // Positive
        if (this.isKeyDown(config.positive) || (config.altPositive && this.isKeyDown(config.altPositive))) {
            value += 1;
        }
        
        // Negative
        if (this.isKeyDown(config.negative) || (config.altNegative && this.isKeyDown(config.altNegative))) {
            value -= 1;
        }

        return value;
    }
}

export const Input = InputManager.getInstance();
