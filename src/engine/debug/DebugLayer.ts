import { Graphics } from 'pixi.js';

export interface DebugLayer {
    name: string;
    enabled: boolean;
    update(g: Graphics): void;
}
