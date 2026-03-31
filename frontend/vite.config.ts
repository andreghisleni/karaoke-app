import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      generatedRouteTree: './src/route-tree.gen.ts',
      routesDirectory: './src/pages',
      routeToken: 'layout',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // 1. Joga os arquivos compilados direto na pasta do Java
    outDir: '../src/main/resources/public',

    // 2. Limpa a pasta do Java sempre que fizer um novo build
    emptyOutDir: true,
  },
  server: {
    // Mantive o seu ngrok caso precise, mas adicionei o Proxy!
    allowedHosts: ['1ed5f08d712d.ngrok-free.app'],

    // 3. Redireciona tudo que começar com /api para o Javalin
    proxy: {
      '/api': {
        target: 'http://localhost:7000',
        changeOrigin: true,
      }
    }
  }
});