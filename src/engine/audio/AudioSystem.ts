import { world } from '../ecs/ECS';
import type { Entity } from '../ecs/ECS';
import { getFileSystem } from '../../api/FileSystem';

export class AudioSystem {
    private activeAudio = new Map<string, HTMLAudioElement>();
    
    // Default Settings
    private settings = {
        masterVolume: 1.0,
        channels: {
            'Music': { volume: 1.0, muted: false },
            'SFX': { volume: 1.0, muted: false }
        } as Record<string, { volume: number, muted: boolean }>
    };

    public setSettings(newSettings: any) {
        if (!newSettings) return;
        this.settings = newSettings;
        this.updateVolumes();
    }

    private getChannelMultiplier(channelName?: string): number {
        const master = this.settings.masterVolume;
        if (!channelName) return master;

        const channel = this.settings.channels[channelName];
        if (!channel) return master; // Fallback to just master if channel not found
        
        if (channel.muted) return 0;
        return master * channel.volume;
    }

    private updateVolumes() {
        this.activeAudio.forEach((audio, entityId) => {
            const entity = world.where(e => e.id === entityId).first;
            if (entity && entity.audioSource) {
                 const baseVol = Math.max(0, Math.min(1, entity.audioSource.volume));
                 const multiplier = this.getChannelMultiplier(entity.audioSource.channel || 'SFX');
                 audio.volume = baseVol * multiplier;
            }
        });
    }

    // Called when Play Mode starts
    public async start() {
        const entities = world.with('audioSource');
        
        for (const entity of entities) {
            if (entity.audioSource?.playOnAwake && entity.audioSource.clip) {
                this.play(entity);
            }
        }
    }

    // Called when Play Mode stops
    public stopAll() {
        this.activeAudio.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        this.activeAudio.clear();
    }

    public async play(entity: Entity) {
        if (!entity.audioSource || !entity.audioSource.clip) return;
        
        const path = entity.audioSource.clip;
        
        try {
            const fs = getFileSystem();
            const url = await fs.getAssetURL(path);
            
            const audio = new Audio(url);
            
            // Calculate Volume
            const baseVol = Math.max(0, Math.min(1, entity.audioSource.volume));
            const multiplier = this.getChannelMultiplier(entity.audioSource.channel || 'SFX');
            audio.volume = baseVol * multiplier;
            
            audio.loop = entity.audioSource.loop;
            
            // Track specific instance by entity ID if possible, 
            // or just track generally. Entity ID is safer.
            if (entity.id) {
                // If already playing for this entity, stop previous?
                if (this.activeAudio.has(entity.id)) {
                    this.activeAudio.get(entity.id)?.pause();
                }
                this.activeAudio.set(entity.id, audio);
            }

            audio.play().catch(e => console.warn('Audio play failed (user interaction?):', e));
            
            // Cleanup on end if not looping
            audio.onended = () => {
                if (!entity.audioSource?.loop && entity.id) {
                    this.activeAudio.delete(entity.id);
                }
            };
            
        } catch (e) {
            console.error('Failed to play audio:', path, e);
        }
    }

    public stop(entity: Entity) {
        if (entity.id && this.activeAudio.has(entity.id)) {
            const audio = this.activeAudio.get(entity.id);
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
            this.activeAudio.delete(entity.id);
        }
    }
}
