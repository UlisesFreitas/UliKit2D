---
description: Initialize the UliKit2D Game Engine Project
---

This workflow initializes a new Vite + Vue + TypeScript project, configures Electron, and installs necessary dependencies.

// turbo-all
1.  Initialize Vite Project
    ```bash
    npm create vite@latest . -- --template vue-ts
    ```

2.  Install Development Dependencies (Electron, Tailwind, Types)
    ```bash
    npm install -D electron electron-builder wait-on concurrently tailwindcss postcss autoprefixer @types/node
    ```

3.  Install Core Dependencies (PixiJS, Logic, UI)
    ```bash
    npm install pixi.js @pixi/events matter-js miniplex pinia vue-router dockview @vueuse/core
    ```

4.  Initialize Tailwind CSS
    ```bash
    npx tailwindcss init -p
    ```

5.  Create Project Structure
    ```bash
    mkdir -p electron src/editor src/engine src/assets
    ```
