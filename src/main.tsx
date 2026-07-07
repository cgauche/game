import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { initAudioWiring } from './audio/wiring';
import { initCombatAuto } from './state/combatAuto';
import '@fontsource/grenze-gotisch/latin-600.css'; // display de la charte (titres) — embarquée, zéro réseau
import '@fontsource/grenze-gotisch/latin-800.css';
import './ui/styles.css';

// DEV uniquement : outils de recette navigateur (store brut + CARTOGRAPHIE + accès direct aux
// entités) sur `window.__wfrp` — Playwright pilote le jeu sans chasser les coordonnées. Cf. devtools.ts.
if (import.meta.env.DEV) import('./state/devtools').then((m) => m.installDevtools());

// DEV uniquement : contrat de donnée (#176) — plante au démarrage si un src/data/*.json hand-édité
// diverge de son schéma zod (SCHEMA_DEFS). En prod, le JSON a déjà passé la porte CI : zéro coût runtime.
if (import.meta.env.DEV) import('./data/dev-validate').then((m) => m.validateDataOnLoad());

initAudioWiring(); // sons CC0 branchés sur le bus (dés/impacts/pas/gong) — Jalon 8
initCombatAuto(); // Cadence de combat (Rapide/Auto) : auto-résolution des modales pilotée par l'état

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
