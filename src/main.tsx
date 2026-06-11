import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { useGame } from './state/store';
import { initAudioWiring } from './audio/wiring';
import './ui/styles.css';

// DEV uniquement : expose le store aux recettes navigateur (Playwright lit l'état sans fouiller le DOM).
if (import.meta.env.DEV) (window as unknown as { __game?: typeof useGame }).__game = useGame;

initAudioWiring(); // sons CC0 branchés sur le bus (dés/impacts/pas/gong) — Jalon 8

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
