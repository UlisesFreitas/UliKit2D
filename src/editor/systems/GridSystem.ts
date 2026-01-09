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

    public draw(cameraX: number = 0, cameraY: number = 0, scale: number = 1) {
        const g = this.gridGraphics;
        g.clear();
        
        const screenWidth = this.app.screen.width;
        const screenHeight = this.app.screen.height;
        
        // Grid spacing in world units (e.g. 50px)
        const gridSize = 50; 
        
        // Calculate the visible world bounds based on camera
        // World = (Screen - CameraPos) / Zoom
        const startWorldX = (0 - cameraX) / scale;
        const startWorldY = (0 - cameraY) / scale;
        const endWorldX = (screenWidth - cameraX) / scale;
        const endWorldY = (screenHeight - cameraY) / scale;

        // Snap start to grid size to ensure alignment
        const startGridX = Math.floor(startWorldX / gridSize) * gridSize;
        const startGridY = Math.floor(startWorldY / gridSize) * gridSize;

        g.stroke({ width: 1 / scale, color: 0x333333, alpha: 0.5 }); // Keep lines thin regardless of zoom

        // Draw Vertical Lines
        for (let x = startGridX; x < endWorldX + gridSize; x += gridSize) {
            g.moveTo(x, startWorldY);
            g.lineTo(x, endWorldY);
        }

        // Draw Horizontal Lines
        for (let y = startGridY; y < endWorldY + gridSize; y += gridSize) {
             g.moveTo(startWorldX, y);
             g.lineTo(endWorldX, y);
        }
        
        // Draw Origin Axes (Thicker/Brighter)
        g.stroke({ width: 2 / scale, color: 0x666666, alpha: 0.8 });
        
        // Y Axis (x=0)
        if (startWorldX <= 0 && endWorldX >= 0) {
            g.moveTo(0, startWorldY);
            g.lineTo(0, endWorldY);
        }
        
        // X Axis (y=0)
        if (startWorldY <= 0 && endWorldY >= 0) {
            g.moveTo(startWorldX, 0);
            g.lineTo(endWorldX, 0);
        }
    }
}
