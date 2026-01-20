import type { ICommand } from './ICommand';
import { world, type Entity } from '../../engine/ecs/ECS';
import { SceneManager } from '../../engine/managers/SceneManager';
import { eventBus } from '../../engine/core/EventBus';
import { useEditorStore } from '../../stores/useEditorStore';

export class PasteCommand implements ICommand {
    public id: string;
    public timestamp: number;
    public description: string;

    private newEntitiesData: Entity[];
    private createdEntityIds: string[] = [];

    constructor(entitiesData: Entity[]) {
        this.id = crypto.randomUUID();
        this.timestamp = Date.now();
        this.description = `Paste ${entitiesData.length} Entities`;
        this.newEntitiesData = entitiesData; // Expects ALREADY CLONED and ID-REGENERATED data
    }

    execute(): void {
        this.createdEntityIds = [];
        const editorStore = useEditorStore();

        this.newEntitiesData.forEach(data => {
            world.add(data);
            SceneManager.registerEntity(data.id!, data.layer || 'Base Layer');
            if (data.id) this.createdEntityIds.push(data.id);
        });

        // Select the new entities
        if (this.createdEntityIds.length > 0) {
            // Wait a frame for systems to pick up? usually safe within same tick for selection
            setTimeout(() => {
                 editorStore.selectEntity(this.createdEntityIds[0] || null);
            }, 10);
        }
    }

    undo(): void {
        this.createdEntityIds.forEach(id => {
            const entity = world.with('id').where(e => e.id === id).first;
            if (entity) {
                world.remove(entity);
                SceneManager.unregisterEntity(id, entity.layer || 'Base Layer');
            }
        });
        
        const editorStore = useEditorStore();
        editorStore.clearSelection();
        
        // Force UI update
        eventBus.emit('entity-updated');
    }
}
