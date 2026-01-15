import { Container, Graphics, Application, Color } from 'pixi.js';

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

    private getThemeColor(varName: string, fallback: number | string): number {
        // Try to read CSS variable
        const style = getComputedStyle(document.body);
        const cssVal = style.getPropertyValue(varName).trim();
        
        try {
            if (cssVal && cssVal !== '') {
                return new Color(cssVal).toNumber();
            }
        } catch (e) {
            // Ignore parse error
        }
        
        // Fallback
        try {
            return new Color(fallback).toNumber();
        } catch (e) {
            return 0x000000;
        }
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
        g.visible = true;
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

        // --- DRAW GRID LINES ---
        // DRAW FIRST, THEN STROKE
        
        const startN_X = Math.floor((startWorldX - offX) / cellW);
        const endN_X = Math.ceil((endWorldX - offX) / cellW);
        
        for (let i = startN_X; i <= endN_X; i++) {
            const x = i * cellW + offX;
            g.moveTo(x, startWorldY);
            g.lineTo(x, endWorldY);
        }

        const startN_Y = Math.floor((startWorldY - offY) / cellH);
        const endN_Y = Math.ceil((endWorldY - offY) / cellH);
        
        for (let i = startN_Y; i <= endN_Y; i++) {
            const y = i * cellH + offY;
            g.moveTo(startWorldX, y);
            g.lineTo(endWorldX, y);
        }

        // Apply Stroke for Lines
        // Note: In PixiJS, stroke() applies to the path constructed so far.
        let strokeColor: number;
        try {
            strokeColor = new Color(options.color || '#7ad3ff').toNumber();
        } catch (e) {
            strokeColor = new Color('#7ad3ff').toNumber();
        }
        g.stroke({ width: 1 / scale, color: strokeColor, alpha: 0.5 });

        // --- DRAW AXES ---
        
        let hasAxis = false;
        
        if (startWorldX <= 0 && endWorldX >= 0) {
            g.moveTo(0, startWorldY);
            g.lineTo(0, endWorldY);
            hasAxis = true;
        }
        
        if (startWorldY <= 0 && endWorldY >= 0) {
            g.moveTo(startWorldX, 0);
            g.lineTo(endWorldX, 0);
            hasAxis = true;
        }

        // Apply Stroke for Axes
        if (hasAxis) {
            const axisColor = this.getThemeColor('--grid-axis', 0x666666);
            g.stroke({ width: 2 / scale, color: axisColor, alpha: 0.8 });
        }
    }
}
