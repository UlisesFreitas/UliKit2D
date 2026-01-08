import { World } from 'miniplex';

// Define the component types for our entities
export type Entity = {
  id?: string;
  name?: string; // For Hierarchy
  visible?: boolean; // Visibility Flag
  transform?: {
      x: number;
      y: number;
      rotation: number;
      scale: { x: number, y: number };
  };
  sprite?: {
      texture: string;
      tint?: number;
      width?: number;
      height?: number;
  };
  rigidBody?: {
      mass: number;
      isStatic: boolean;
      friction: number;
      restitution: number; // Bounciness
  };
  boxCollider?: {
      width: number;
      height: number;
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
  };
  label?: {
      text: string;
      fontSize: number;
      fontFamily: string;
      color: string;
      align: 'left' | 'center' | 'right';
      width?: number; // Runtime width for gizmos
      height?: number; // Runtime height for gizmos
  };
  bitmapText?: {
      text: string;
      fontName: string;
      fontTexture?: string; // Explicit texture override
      fontSize: number;
      tint: number;
      align: 'left' | 'center' | 'right';
      width?: number; // Runtime width for gizmos
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

  // Runtime only
  physicsBody?: any; // Matter.js body declaration
};

// Create the unified world
export const world = new World<Entity>();

export function createEntity(name: string = 'Entity') {
    return world.add({
        id: crypto.randomUUID(),
        name,
        transform: { x: 0, y: 0, rotation: 0, scale: { x: 1, y: 1 } }
    });
}
