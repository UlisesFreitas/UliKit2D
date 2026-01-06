
export const properties = {
    version: 1
};

export function update(entity, dt) {
    if (Math.random() < 0.01) console.log('HMR Test: Version 1');
    window.__HMR_VERSION__ = 1;
}
