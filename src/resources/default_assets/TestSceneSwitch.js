
// Access global SceneManager
const SceneManager = window.SceneManager;
const Input = window.Input;

export const properties = {
    targetScene: 'assets/scenes/SceneB.json',
    triggerKey: 'KeyL'
};

export function update(entity, dt, params) {
    if (!SceneManager || !Input) return;

    const key = params.triggerKey || 'KeyL';
    const scenePath = params.targetScene;

    if (Input.isKeyDown(key)) {
        console.log('Switching to scene:', scenePath);
        SceneManager.loadSceneFromFile(scenePath);
    }
}
