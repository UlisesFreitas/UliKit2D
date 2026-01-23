export class GameManager {
    private static instance: GameManager;
    
    // Persistent Global State
    public globals: Record<string, any> = {};

    private constructor() {
        // Expose to window for Scripts
        if (!(window as any).Game) {
            (window as any).Game = this;
            console.log('[GameManager] Exposed Game to window');
        }
    }

    public static getInstance(): GameManager {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager();
        }
        return GameManager.instance;
    }

    // API
    public set(key: string, value: any) {
        this.globals[key] = value;
    }

    public get(key: string): any {
        return this.globals[key];
    }
    
    public clear() {
        this.globals = {};
    }
}

export const gameManager = GameManager.getInstance();
