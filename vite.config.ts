import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Dépendances stables (React/Zustand…) → chunk vendor bien caché.
        // L'éditeur et le rendu de jeu sortent déjà en chunks async (React.lazy, ui/App.tsx).
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          // Tables de règles générées (~1 Mo) : chunk séparé, cacheable indépendamment du
          // code applicatif (changer le code ne réinvalide pas les données). Encore chargées
          // au démarrage (le moteur pur les importe) — le découplage paresseux reste à faire.
          if (id.includes('/src/data/') && id.endsWith('.json')) return 'gamedata';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
