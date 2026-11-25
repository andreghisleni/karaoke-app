import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/**
 * O catálogo dos convidados é a segunda frente do app de karaokê: compila aqui e o Java serve o
 * resultado em `http://<ip-da-festa>:7000/p/`.
 *
 * - `base: '/p/'` → os `<script>`/`<link>` do index já saem apontando para dentro de /p, então a
 *   build funciona servida pelo Java em qualquer IP, contanto que a rota seja /p.
 * - `outDir` cai em `src/main/resources/convidado`, **pasta separada do painel**. O build do
 *   `frontend/` escreve em `src/main/resources/public` com `emptyOutDir: true`; se as duas frentes
 *   compartilhassem a pasta, um `bun run build` apagaria a tela do convidado.
 * - nada de service worker: o acervo vem da API em runtime, e cache de HTML na rede da festa é
 *   receita para mostrar fila velha para 20 celulares.
 */
export default defineConfig({
  base: '/p/',
  build: {
    outDir: '../src/main/resources/convidado',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // bun run dev apontando para o Java que já está de pé na porta 7000
    port: 5174,
    proxy: {
      '/api': 'http://localhost:7000',
      '/ws': { target: 'ws://localhost:7000', ws: true },
    },
  },
})
