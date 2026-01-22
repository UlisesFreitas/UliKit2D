import { Application, Container, Graphics } from 'pixi.js';
import type { DebugLayer } from '../debug/DebugLayer';
import { PlaceholderDebugLayer } from '../debug/layers/PlaceholderDebugLayer';
import { PhysicsDebugLayer } from '../debug/layers/PhysicsDebugLayer';
import { CameraFrustumDebugLayer } from '../debug/layers/CameraFrustumDebugLayer';

export class EditorDebugSystem {
    private app: Application;
    private container: Container;
    private graphics: Graphics;
    public layers: DebugLayer[] = [];

    constructor(app: Application) {
        this.app = app;
        this.container = new Container();
        this.container.zIndex = 999999; // Ensure Above Everything
        this.container.label = 'EditorDebugSystem';
        
        this.graphics = new Graphics();
        this.container.addChild(this.graphics);
        
        this.app.stage.addChild(this.container);
        this.app.stage.sortableChildren = true; // Ensure zIndex works

        // Initialize Layers
        this.layers.push(new PlaceholderDebugLayer());
        this.layers.push(new PhysicsDebugLayer());
        this.layers.push(new CameraFrustumDebugLayer(this.app));
    }

    public update() {
        this.graphics.clear();
        
        // Single Graphics Context Interaction
        // Pros: One draw call (batching depends on Pixi)
        // Cons: Layers can't easily have different z-indices relative to each other 
        // without multiple Graphics objects. For Debug, usually fine.
        
        for (const layer of this.layers) {
            if (layer.enabled) {
                layer.update(this.graphics);
            }
        }
    }

    public toggleLayer(name: string, enabled: boolean) {
        const layer = this.layers.find(l => l.name === name);
        if (layer) {
            layer.enabled = enabled;
        }
    }

    public dispose() {
        this.app.stage.removeChild(this.container);
        this.container.destroy({ children: true });
    }
}
