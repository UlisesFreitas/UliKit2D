import { world } from '../ecs/ECS';

export class AnimationSystem {
    
    public update(dt: number) {
        // Query entities with animator and sprite (since we need a target sprite to update)
        const entities = world.with('animator', 'sprite');

        for (const entity of entities) {
            const animator = entity.animator;
            const sprite = entity.sprite;

            if (!animator.isPlaying || !animator.currentAnim) continue;

            const animData = animator.animations[animator.currentAnim];
            if (!animData || !animData.frames || animData.frames.length === 0) continue;

            // Determines playback speed (frames per second)
            // Use animation specific speed if set, otherwise global animator speed
            // Default to 12 FPS if neither is set properly (though they should be)
            const fps = (animData.speed !== undefined ? animData.speed : animator.speed) || 12;

            // Increment elapsed time
            animator.elapsedTime += dt;

            // Calculate Frame Index
            const totalFrames = animData.frames.length;
            let frameIndex = Math.floor(animator.elapsedTime * fps);

            if (animData.loop) {
                frameIndex = frameIndex % totalFrames;
            } else {
                if (frameIndex >= totalFrames) {
                    frameIndex = totalFrames - 1;
                    animator.isPlaying = false; // Stop at end
                    // Optional: Emit 'onAnimationComplete'?
                }
            }

            // Update Sprite Texture path
            if (frameIndex >= 0 && frameIndex < totalFrames) {
                const texturePath = animData.frames[frameIndex];
                if (texturePath && sprite.texture !== texturePath) {
                    sprite.texture = texturePath;
                }
            }
        }
    }

    public play(entityId: string, animName: string) {
        const entity = world.where(e => e.id === entityId).first;
        if (!entity || !entity.animator) return;

        if (entity.animator.animations[animName]) {
            entity.animator.currentAnim = animName;
            entity.animator.isPlaying = true;
            entity.animator.elapsedTime = 0;
        }
    }

    public stop(entityId: string) {
        const entity = world.where(e => e.id === entityId).first;
        if (entity && entity.animator) {
            entity.animator.isPlaying = false;
        }
    }
}
