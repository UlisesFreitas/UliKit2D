import { Container, Graphics, Application } from 'pixi.js';

export class GridSystem {
    private container: Container;
    private gridGraphics: Graphics;
    private app: Application;

    constructor(app: Application) {
        this.app = app;
        this.container = new Container();
        // Grid should be an overlay to be visible above the Base Layer background
        this.container.zIndex = 1000; 
        
        this.app.stage.addChild(this.container);
        
        this.gridGraphics = new Graphics();
        this.container.addChild(this.gridGraphics);
    }

    public draw(
        cameraX: number, 
        cameraY: number, 
        scale: number, 
        options: { 
            width: number; 
            height: number; 
            color: string; 
            offsetX: number; 
            offsetY: number; 
            isIsometric: boolean;
        }
    ) {
        const g = this.gridGraphics;
        g.clear();
        
        const screenWidth = this.app.screen.width;
        const screenHeight = this.app.screen.height;
        
        // Use provided options or defaults
        const cellW = Math.max(1, options.width || 32);
        const cellH = Math.max(1, options.height || 32);
        const offX = options.offsetX || 0;
        const offY = options.offsetY || 0;
        
        // World Bounds
        const startWorldX = (0 - cameraX) / scale;
        const startWorldY = (0 - cameraY) / scale;
        const endWorldX = (screenWidth - cameraX) / scale;
        const endWorldY = (screenHeight - cameraY) / scale;

        g.stroke({ width: 1 / scale, color: options.color || '#333333', alpha: 0.5 });

        // Calculate Alignment with Offset
        // We want lines at: N * cell + offset
        
        // Vertical Lines (X)
        // Find first X:  N * cellW + offX >= startWorldX
        // N * cellW >= startWorldX - offX
        // N >= (startWorldX - offX) / cellW
        const startN_X = Math.floor((startWorldX - offX) / cellW);
        const endN_X = Math.ceil((endWorldX - offX) / cellW);
        
        for (let i = startN_X; i <= endN_X; i++) {
            const x = i * cellW + offX;
            g.moveTo(x, startWorldY);
            g.lineTo(x, endWorldY);
        }

        // Horizontal Lines (Y)
        const startN_Y = Math.floor((startWorldY - offY) / cellH);
        const endN_Y = Math.ceil((endWorldY - offY) / cellH);
        
        for (let i = startN_Y; i <= endN_Y; i++) {
            const y = i * cellH + offY;
            g.moveTo(startWorldX, y);
            g.lineTo(endWorldX, y);
        }
        
        // Origin Axes (Thicker)
        g.stroke({ width: 2 / scale, color: 0x666666, alpha: 0.8 });
        
        if (startWorldX <= 0 && endWorldX >= 0) {
            g.moveTo(0, startWorldY);
            g.lineTo(0, endWorldY);
        }
        
        if (startWorldY <= 0 && endWorldY >= 0) {
            g.moveTo(startWorldX, 0);
            g.lineTo(endWorldX, 0);
        }
    }
}
