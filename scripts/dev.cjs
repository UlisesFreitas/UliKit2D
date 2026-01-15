const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Load Config
const configPath = path.resolve(__dirname, '../ukit.config.json');
let port = 9222; // Default

try {
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.server && config.server.port) {
            port = config.server.port;
        }
    }
} catch (e) {
    console.warn('Failed to read ukit.config.json, using default port', port);
}

console.log(`[DevScript] Starting dev server on port ${port}...`);

const viteCmd = 'vite';
const electronCmd = `wait-on tcp:${port} && npm run build:electron && electron dist/electron/main.js --dev --remote-debugging-port=9333`;

// Use npx (or npm exec) to run concurrently
const args = [
    'concurrently',
    '-k',
    '-p', '[{name}]',
    '-n', 'Vite,Electron',
    '-c', 'cyan.bold,blue.bold',
    `"${viteCmd}"`,
    `"${electronCmd}"`
];

const child = spawn('npx', args, {
    stdio: 'inherit',
    shell: true,
    cwd: path.resolve(__dirname, '..')
});

child.on('exit', (code) => {
    process.exit(code);
});
