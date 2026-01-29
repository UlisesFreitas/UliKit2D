import { World } from 'miniplex';

// Define the component types for our entities
export type Entity = {
  id?: string;
  name?: string; // For Hierarchy
  layer?: string; // Layer ID
  visible?: boolean; // Visibility Flag
  sortIndex?: number; // Explicit Sorting Order (0 = Top, N = Bottom)
  transform?: {
      x: number;
      y: number;
      rotation: number;
      scale: { x: number, y: number };
      zIndex?: number; // Sorting order within the layer
  };
  sprite?: {
      texture: string;
      tint?: number;
      width?: number;
      height?: number;
      anchor?: { x: number, y: number };
  };
  rigidBody?: {
      mass: number;
      isStatic: boolean;
      friction: number;
      restitution: number; // Bounciness
  };
  physicsBody?: any; // Runtime Matter body
  boxCollider?: {
      width: number;
      height: number;
      show?: boolean;
  };
  circleCollider?: {
      radius: number;
      show?: boolean;
  };
  script?: {
      path: string;
      parameters?: Record<string, any>;
  }[];
  camera?: {
      zoom: number;
      isPrimary: boolean;
      backgroundColor?: string;
  };
  audioSource?: {
      clip: string;
      volume: number;
      loop: boolean;
      playOnAwake: boolean;
      channel?: string; // 'Music', 'SFX', etc.
  };
  label?: {
      text: string;
      fontSize: number;
      fontFamily: string;
      color: string;
      align: 'left' | 'center' | 'right';
      width?: number; // Word Wrap Width
      height?: number; // Runtime height for gizmos
      
      // Style
      fontWeight?: 'normal' | 'bold';
      fontStyle?: 'normal' | 'italic';
      
      // Outline
      stroke?: string; // color
      strokeThickness?: number;
      
      // Shadow
      dropShadow?: {
          alpha: number;
          angle: number; // degrees
          blur: number;
          color: string;
          distance: number;
          enabled: boolean;
      }
  };
  bitmapText?: {
      text: string;
      fontName: string;
      fontTexture?: string; // Explicit texture override
      fontSize: number;
      tint: number;
      align: 'left' | 'center' | 'right';
      width?: number; // Max Width
      height?: number; // Runtime height for gizmos
  };
  nineSliceSprite?: {
      texture: string;
      width: number;
      height: number;
      left: number; // Left slice width
      right: number; // Right slice width
      top: number; // Top slice height
      bottom: number; // Bottom slice height
      anchor?: { x: number, y: number };
  };
  polygonCollider?: {
      show: boolean; // Visual debug toggle
      vertices: { x: number, y: number }[]; // Points relative to anchor (Global Fallback)
      // Map: AnimationName -> FrameIndex -> Vertices
      frames?: Record<string, Record<number, { x: number, y: number }[]>>; 
  };
  animator?: {
      currentAnim: string;
      isPlaying: boolean;
      speed: number;
      elapsedTime: number;
      animations: Record<string, {
          frames: string[];
          loop: boolean;
          speed?: number;
      }>;
  };
  characterController?: {
      speed: number;
      jumpForce: number;
  };
};

// Create the unified world
export const world = new World<Entity>();

export function createEntity(name: string = 'Entity') {
    // 1. Strict Normalization: Re-index existing entities to eliminate gaps/ambiguities
    // Sort by current sortIndex to preserve visual order
    const existing = [...world.entities].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
    
    console.log('[ECS] Normalizing Sort Indices. Before:', existing.map(e => `${e.name}=${e.sortIndex}`));

    existing.forEach((entity, index) => {
        if (entity.sortIndex !== index) {
            entity.sortIndex = index;
        }
    });

    console.log('[ECS] After Normalization:', existing.map(e => `${e.name}=${e.sortIndex}`));

    // 2. Append New Entity at the End
    const nextIndex = existing.length;
    console.log('[ECS] Creating Entity at Index:', nextIndex);

    return world.add({
        id: crypto.randomUUID(),
        name,
        layer: 'Base Layer',
        sortIndex: nextIndex,
        transform: { x: 0, y: 0, rotation: 0, scale: { x: 1, y: 1 }, zIndex: 0 }
    });
}
