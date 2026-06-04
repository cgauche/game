/** Galerie QC des sprites de créatures générés (public/sprites-gallery.html). */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const map = JSON.parse(readFileSync(resolve(ROOT, 'src/gameIso/creatureSprites.json'), 'utf8'));

const DEFS = `
  <linearGradient id="g_steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e8edf5"/><stop offset="45%" stop-color="#9aa6b8"/><stop offset="100%" stop-color="#5a6376"/></linearGradient>
  <linearGradient id="g_steelD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b94a6"/><stop offset="100%" stop-color="#444b5a"/></linearGradient>
  <linearGradient id="g_cloak" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a8323a"/><stop offset="100%" stop-color="#5e1418"/></linearGradient>
  <linearGradient id="g_robe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3a3f7a"/><stop offset="100%" stop-color="#171a36"/></linearGradient>
  <radialGradient id="g_glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#bdf3ff"/><stop offset="55%" stop-color="#4ec3e0" stop-opacity="0.7"/><stop offset="100%" stop-color="#4ec3e0" stop-opacity="0"/></radialGradient>
  <linearGradient id="g_coat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#30303a"/><stop offset="100%" stop-color="#141419"/></linearGradient>
  <linearGradient id="g_hVest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6f7e3a"/><stop offset="100%" stop-color="#46521f"/></linearGradient>
  <linearGradient id="g_mut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c9152"/><stop offset="100%" stop-color="#39501f"/></linearGradient>
  <linearGradient id="g_mutD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5d7540"/><stop offset="100%" stop-color="#2a3c18"/></linearGradient>
  <linearGradient id="g_flesh" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8b88e"/><stop offset="100%" stop-color="#b07a52"/></linearGradient>
  <linearGradient id="g_crest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff7a1a"/><stop offset="100%" stop-color="#c43f0a"/></linearGradient>
  <linearGradient id="g_axe" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#dfe6ef"/><stop offset="100%" stop-color="#6a7384"/></linearGradient>
  <radialGradient id="g_eye" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffe14a"/><stop offset="70%" stop-color="#d88a1a"/><stop offset="100%" stop-color="#7a3a08"/></radialGradient>`;

const entries = Object.entries(map);
const COLS = 8,
  CW = 152,
  CH = 196;
const rows = Math.ceil(entries.length / COLS);
let cells = '';
entries.forEach(([label, svg], i) => {
  const col = i % COLS,
    row = Math.floor(i / COLS);
  const x = col * CW + 16,
    y = row * CH + 12;
  cells +=
    `<rect x="${x}" y="${y}" width="${CW - 12}" height="${CH - 12}" rx="8" fill="#1d1726" stroke="#3a2f4a"/>` +
    `<ellipse cx="${x + 70}" cy="${y + 158}" rx="34" ry="9" fill="#000" opacity="0.4"/>` +
    `<g transform="translate(${x + 10},${y + 6})">${svg}</g>` +
    `<text x="${x + 70}" y="${y + 180}" text-anchor="middle" fill="#cbb" font-size="12" font-family="sans-serif">${label}</text>`;
});

const W = COLS * CW + 16,
  H = rows * CH + 40;
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Galerie sprites</title>
<style>body{margin:0;background:#0a0810;color:#e8e0f0;font-family:sans-serif}h1{color:#d8a93b;margin:14px 20px}</style></head>
<body><h1>Bestiaire — ${entries.length} sprites générés depuis l'art officiel</h1>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs>${cells}</svg></body></html>`;

writeFileSync(resolve(ROOT, 'public/sprites-gallery.html'), html, 'utf8');
console.log(`public/sprites-gallery.html : ${entries.length} sprites`);
