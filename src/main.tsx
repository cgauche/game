import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { initAudioWiring } from './audio/wiring';
import { initCombatAuto } from './state/combatAuto';
import { installErrorCollector, setErrorContextProvider, wfrpErrorsApi } from './ui/errorCollector';
import { useGame } from './state/store';
import '@fontsource/grenze-gotisch/latin-600.css'; // display de la charte (titres) — embarquée, zéro réseau
import '@fontsource/grenze-gotisch/latin-800.css';
import './ui/styles.css';

// #304 : collecteur d'erreurs local (zéro réseau) — DEV ET PROD, pour que les erreurs vécues en
// soirée de playtest remontent même sans bandeau visible (export via `window.__wfrp.errors()`).
setErrorContextProvider(() => ({ scene: useGame.getState().scene?.id ?? null, seed: null }));
installErrorCollector();

// DEV uniquement : outils de recette navigateur (store brut + CARTOGRAPHIE + accès direct aux
// entités) sur `window.__wfrp` — Playwright pilote le jeu sans chasser les coordonnées. Cf. devtools.ts.
// `installDevtools` RÉASSIGNE `window.__wfrp` en bloc — la fusion des helpers d'erreurs se refait
// APRÈS pour ne pas être écrasée (installErrorCollector avait déjà posé la sienne avant ce chargement
// async, insuffisant si ce module résout après).
if (import.meta.env.DEV) import('./state/devtools').then((m) => {
  m.installDevtools();
  const w = window as unknown as { __wfrp?: Record<string, unknown> };
  w.__wfrp = { ...w.__wfrp, ...wfrpErrorsApi };
});

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
