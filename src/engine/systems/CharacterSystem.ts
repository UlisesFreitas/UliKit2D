import { world } from '../ecs/ECS';
import { Input } from '../input/InputManager';
import Matter, { Body } from 'matter-js';

export class CharacterSystem {
    update(_deltaTime: number) {
        // Iterate all entities with CharacterController AND RigidBody physics runtime body
        const entities = world.with('characterController', 'physicsBody', 'rigidBody');
        
        for (const entity of entities) {
            const controller = entity.characterController;
            const body = entity.physicsBody as Matter.Body;

            // 1. Movement (Horizontal)
            const hInput = Input.getAxis('Horizontal'); 
            
            // LOGGING
            if (hInput !== 0) {
                 console.log(`[CharacterSystem] Entity ${entity.name}: Moving with input ${hInput}. Speed: ${controller.speed}`);
            }

            const speed = controller.speed;
            const currentVel = body.velocity;
            
            // Allow horizontal control
            if (hInput !== 0) {
                 Body.setVelocity(body, { x: hInput * speed, y: currentVel.y });
            } else {
                 // Stop horizontal movement (crisp controls)
                 // Keeping Y velocity for gravity
                 Body.setVelocity(body, { x: 0, y: currentVel.y });
            }

            // 2. Jumping
            if (Input.isActionJustPressed('Jump')) {
                 console.log(`[CharacterSystem] Jump Pressed!`);
                // Determine if grounded. 
                // Simple logic: check if vertical velocity is near zero?
                // Or check collision?
                // For MVP, simple velocity check (flawed but works for basic test)
                if (Math.abs(currentVel.y) < 0.1) {
                    Body.setVelocity(body, { x: body.velocity.x, y: -controller.jumpForce });
                }
            }
        }
    }
}
