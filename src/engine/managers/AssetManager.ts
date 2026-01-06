import { Assets } from 'pixi.js';

export class AssetManager {
    static async loadBundle(bundleId: string, assets: Record<string, string>) {
        Assets.addBundle(bundleId, assets);
        return await Assets.loadBundle(bundleId);
    }

    static async loadSingle(alias: string, src: string) {
        Assets.add({ alias, src });
        return await Assets.load(alias);
    }
}
