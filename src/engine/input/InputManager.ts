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
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            // Check if focus is on canvas (optional, but good for editor)
             // e.preventDefault(); 
             // EDIT: better not prevent default globally in editor
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

    // Helpers
    public getAxis(axis: 'Horizontal' | 'Vertical'): number {
        let value = 0;
        if (axis === 'Horizontal') {
            if (this.isKeyDown('ArrowRight') || this.isKeyDown('KeyD')) value += 1;
            if (this.isKeyDown('ArrowLeft') || this.isKeyDown('KeyA')) value -= 1;
        } else if (axis === 'Vertical') {
            if (this.isKeyDown('ArrowDown') || this.isKeyDown('KeyS')) value += 1;
            if (this.isKeyDown('ArrowUp') || this.isKeyDown('KeyW')) value -= 1;
        }
        return value;
    }
}

export const Input = InputManager.getInstance();
