# Referencia Técnica: Sistema de Animación (Animator System)
**Fecha:** 06/01/2025
**Contexto:** Refactorización del Animator y fixes de Runtime.

Este documento detalla las decisiones técnicas y la arquitectura implementada para que el agente (o desarrollador futuro) pueda entender y modificar el sistema sin romper funcionalidades críticas.

---

## 1. Arquitectura de Componentes (Editor)

### `AnimatorModal.vue`
Es el núcleo de la edición.
- **Gestión de Estado**: No usa `v-model` directo para todo. Modifica el objeto `animator` de la entidad por referencia.
- **Reactividad de Frames**: 
    - *Problema*: Vue 3 a veces pierde reactividad en arrays anidados profundos (`entity.animator.animations[name].frames`).
    - *Solución*: Al modificar frames (drop o delete), **reemplazamos la referencia del array completo** en lugar de usar `.push/splice`.
    ```typescript
    // Ejemplo
    anim.frames = [...anim.frames, newFrame]; // Correcto, dispara reactividad
    ```
- **Zoom**: Implementado transformando el estilo CSS `transform: scale(...)` del contenedor del canvas de preview.

### `InspectorPanel.vue` (Dependency Guard)
- **Lógica de Protección**:
    - El `SpriteComponent` es una dependencia dura del `AnimatorComponent`.
    - En el template, el botón de eliminar (`✕`) del Sprite tiene una condición extra:
    ```html
    v-if="item.key !== 'transform' && !(item.key === 'sprite' && (selectedEntity as any).animator)"
    ```
    - **Nota**: Si se requiere eliminar el Sprite, el usuario primero debe eliminar el Animator.

---

## 2. Motor y Runtime (`src/engine`)

### `RenderSystem.ts` (Critical: Blob Loading)
La carga de texturas tiene un "camino rápido" para URLs de tipo `blob:` (usadas en el editor web/electron para previsualización inmediata sin guardar a disco a veces).

- **Estrategia Antigua (Fallida)**: Usar `Assets.load(url)` directamente. PixiJS fallaba detectando el tipo MIME o parseando el blob.
- **Estrategia Actual (Robusta)**:
    - Detectamos si es `blob:` o `data:`.
    - Creamos manualmente un `new Image()`.
    - Esperamos a `img.decode()`.
    - Creamos la textura con `Texture.from(img)`.
    
    ```typescript
    if (url.startsWith('blob:') || url.startsWith('data:')) {
        const img = new Image();
        img.src = url;
        await img.decode(); 
        return Texture.from(img);
    }
    ```
    *No tocar esto a menos que PixiJS actualice su loader de blobs significativamente.*

### `AnimationSystem.ts`
- Se encarga de **intercambiar la textura** del componente Sprite.
- **No renderiza**, solo lógica.
- Modifica `sprite.texture = framePath`.
- El `RenderSystem` detecta el cambio en el siguiente ciclo y actualiza la textura en GPU.

---

## 3. Estructura de Datos (ECS)
El componente `animator` tiene esta forma:
```typescript
{
    currentAnim: string;       // Nombre de la animación actual
    isPlaying: boolean;        // Flag de reproducción
    speed: number;             // Multiplicador global de velocidad
    elapsedTime: number;       // Acumulador de tiempo (segundos)
    animations: {
        [name: string]: {
            frames: string[];  // Array de paths (URLs)
            speed: number;     // Speed local (FPS)
            loop: boolean;     // Loop flag
        }
    }
}
```

## 4. Known Issues / Future Work
- **Persistencia**: Asegurar que al guardar el proyecto, los `blob:` URLs se conviertan a rutas relativas de assets (`assets/...`) si no lo hacen ya. Actualmente el `FilePicker` devuelve la ruta resuelta, pero hay que vigilar la serialización en `ProjectManager`.
