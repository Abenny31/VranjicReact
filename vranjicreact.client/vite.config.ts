import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [react()],

    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '~': path.resolve(__dirname, 'src'),
        },
    },

    build: {
        outDir: '../VranjicReact.Server/wwwroot',
        emptyOutDir: true,
    },
    server: {
        port: 5173,
        strictPort: true,
    },
});
