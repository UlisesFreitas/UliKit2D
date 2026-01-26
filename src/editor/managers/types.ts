export interface IResourceEntry {
    guid: string;
    path: string; // Relative path (assets/foo.png)
    type: string; // texture, audio, script...
    meta?: any;   // Extra import options
}

export interface ISceneEntry {
    name: string;
    path: string;
}
