<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Entity } from '../../engine/ecs/ECS';

const props = defineProps<{
  entity: Entity
}>();

const x = ref(0);
const y = ref(0);
const rotation = ref(0);
const scaleX = ref(1);
const scaleY = ref(1);

// Sync local refs with entity
const syncFromEntity = () => {
    if (!props.entity.transform) return;
    x.value = props.entity.transform.x;
    y.value = props.entity.transform.y;
    rotation.value = props.entity.transform.rotation;
    scaleX.value = props.entity.transform.scale.x;
    scaleY.value = props.entity.transform.scale.y;
};

// Initial sync
watch(() => props.entity, syncFromEntity, { immediate: true });

// Apply changes
const apply = () => {
    if (!props.entity.transform) return;
    props.entity.transform.x = x.value;
    props.entity.transform.y = y.value;
    props.entity.transform.rotation = rotation.value;
    props.entity.transform.scale.x = scaleX.value;
    props.entity.transform.scale.y = scaleY.value;
};
</script>

<template>
  <div v-if="entity.transform" class="component-editor">
    <div class="header">Transform</div>
    
    <div class="row">
        <label>Position</label>
        <div class="inputs">
            <span class="label">X</span>
            <input type="number" v-model.number="x" @input="apply" />
            <span class="label">Y</span>
            <input type="number" v-model.number="y" @input="apply" />
        </div>
    </div>

    <div class="row">
        <label>Rotation</label>
        <div class="inputs">
            <input type="number" step="0.1" v-model.number="rotation" @input="apply" />
        </div>
    </div>

    <div class="row">
        <label>Scale</label>
        <div class="inputs">
            <span class="label">X</span>
            <input type="number" step="0.1" v-model.number="scaleX" @input="apply" />
            <span class="label">Y</span>
            <input type="number" step="0.1" v-model.number="scaleY" @input="apply" />
        </div>
    </div>
  </div>
</template>

<style scoped>
.component-editor {
    background: #252526;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 8px;
}
.header {
    font-weight: bold;
    margin-bottom: 8px;
    color: #eee;
    padding-bottom: 4px;
    border-bottom: 1px solid #333;
}
.row {
    display: flex;
    flex-direction: column;
    margin-bottom: 8px;
}
.row label {
    font-size: 11px;
    color: #aaa;
    margin-bottom: 2px;
}
.inputs {
    display: flex;
    gap: 8px;
    align-items: center;
}
input {
    background: #1e1e1e;
    border: 1px solid #333;
    color: white;
    padding: 4px;
    border-radius: 3px;
    width: 60px;
    font-size: 12px;
}
input:focus {
    border-color: #007acc;
    outline: none;
}
.label {
    font-size: 10px;
    color: #666;
}
</style>
