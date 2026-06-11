import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { initAudioWiring } from './audio/wiring';
import '@fontsource/grenze-gotisch/latin-600.css'; // display de la charte (titres) — embarquée, zéro réseau
import '@fontsource/grenze-gotisch/latin-800.css';
import './ui/styles.css';

// DEV uniquement : outils de recette navigateur (store brut + CARTOGRAPHIE + accès direct aux
// entités) sur `window.__wfrp` — Playwright pilote le jeu sans chasser les coordonnées. Cf. devtools.ts.
if (import.meta.env.DEV) import('./state/devtools').then((m) => m.installDevtools());

initAudioWiring(); // sons CC0 branchés sur le bus (dés/impacts/pas/gong) — Jalon 8

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
