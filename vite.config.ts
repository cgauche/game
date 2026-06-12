import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
// @ts-expect-error - generateur ESM JS (pas de types)
import { genAll, REGISTRIES } from './scripts/gen-registry.mjs';

/** Auto-génération des registres « dépose un fichier → intégré » : régénère l'index explicite
 *  au démarrage et à chaque ajout/suppression dans un dossier `defs/` (HMR récupère ensuite). */
function registryGen() {
  const dirs = (REGISTRIES as { dir: string }[]).map((r) => r.dir.replace(/\\/g, '/'));
  const touched = (f: string) => dirs.some((d) => f.replace(/\\/g, '/').includes(d));
  return {
    name: 'registry-gen',
    buildStart() { genAll(); },
    configureServer(server: { watcher: { on(e: string, cb: (f: string) => void): void } }) {
      const on = (f: string) => { if (touched(f)) genAll(); };
      server.watcher.on('add', on);
      server.watcher.on('unlink', on);
    },
  };
}

export default defineConfig({
  plugins: [registryGen(), react()],
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
    include: ['src/**/*.test.{ts,tsx}', 'server/src/**/*.test.ts'],
  },
});
