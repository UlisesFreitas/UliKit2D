import type { ICommand } from './ICommand';
import { world, type Entity } from '../../engine/ecs/ECS';
import { SceneManager } from '../../engine/managers/SceneManager';
import { eventBus } from '../../engine/core/EventBus';
import { useEditorStore } from '../../stores/useEditorStore';

export class DeleteCommand implements ICommand {
    public id: string;
    public timestamp: number;
    public description: string;

    private entityIds: string[];
    private backupEntities: Map<string, Entity> = new Map();

    constructor(entityIds: string[]) {
        this.id = crypto.randomUUID();
        this.timestamp = Date.now();
        this.description = `Delete ${entityIds.length} Entities`;
        this.entityIds = entityIds;

        // Backup state immediately
        this.entityIds.forEach(id => {
            const entity = world.with('id').where(e => e.id === id).first;
            if (entity) {
                // Deep clone to prevent reference issues later? 
                // Miniplex entities are plain objects, but some props might be nested.
                // Simple JSON clone for now (Warning: functions/circular refs issues, but we don't have those in ECS usually)
                this.backupEntities.set(id, JSON.parse(JSON.stringify(entity)));
            }
        });
    }

    execute(): void {
        const store = useEditorStore();
        
        console.log('[DeleteCommand] Executing delete for IDs:', this.entityIds);

        this.entityIds.forEach(id => {
             const entity = world.with('id').where(e => e.id === id).first;
             if (entity) {
                 world.remove(entity);
                 SceneManager.unregisterEntity(id, entity.layer || 'Base Layer');
             } else {
                 console.warn(`[DeleteCommand] Entity ${id} not found in world to delete.`);
             }
        });
        
        store.clearSelection();
        eventBus.emit('entity-updated');
    }

    undo(): void {
        console.log('[DeleteCommand] Undo delete, restoring IDs:', this.entityIds);

         this.entityIds.forEach(id => {
             const data = this.backupEntities.get(id);
             if (data) {
                 world.add(data);
                 SceneManager.registerEntity(id, data.layer || 'Base Layer');
             } else {
                 console.error(`[DeleteCommand] No backup found for entity ${id}!`);
             }
         });
         
         // Restore selection? Maybe select the restored entities.
         // const store = useEditorStore();
         // store.selectEntities(this.entityIds);
         
         eventBus.emit('entity-updated');
    }
}
