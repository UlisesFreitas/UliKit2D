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
