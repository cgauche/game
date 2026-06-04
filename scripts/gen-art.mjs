/**
 * Génère public/art-proof.html : une scène isométrique en SVG statique
 * (tuiles, murs ombrés, ombres portées, brouillard) + sprites de personnages.
 * Sert de preuve d'art avant de construire le vrai moteur de rendu iso.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const TW = 58, TH = 29, OX = 430, OY = 70;
const iso = (x, y) => [OX + (x - y) * TW, OY + (x + y) * TH];

function diamond(x, y, fill, stroke = 'rgba(0,0,0,0.18)') {
  const [cx, cy] = iso(x, y);
  return `<path d="M${cx},${cy} l${TW},${TH} l${-TW},${TH} l${-TW},${-TH} z" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
}

function wall(x, y, h, lit) {
  const [cx, cy] = iso(x, y);
  const top = `M${cx},${cy - h} l${TW},${TH} l${-TW},${TH} l${-TW},${-TH} z`;
  const left = `M${cx - TW},${cy - h + TH} l${TW},${TH} l0,${h} l${-TW},${-TH} z`;
  const right = `M${cx + TW},${cy - h + TH} l${-TW},${TH} l0,${h} l${TW},${-TH} z`;
  return (
    `<path d="${left}" fill="${lit ? '#bdae8e' : '#9b8e72'}" stroke="rgba(0,0,0,0.3)"/>` +
    `<path d="${right}" fill="${lit ? '#8a7d63' : '#6f6450'}" stroke="rgba(0,0,0,0.3)"/>` +
    `<path d="${top}" fill="#d8cbae" stroke="rgba(0,0,0,0.25)"/>`
  );
}

function shadow(x, y) {
  const [cx, cy] = iso(x, y);
  return `<ellipse cx="${cx}" cy="${cy + TH}" rx="26" ry="13" fill="#000" opacity="0.38"/>`;
}

// --- Sprites (réutilisés du proof) ---------------------------------------
function soldier() {
  return `<g>
    <path d="M58 95 Q40 150 52 200 L85 188 L118 200 Q130 150 112 95 Z" fill="url(#cloak)"/>
    <path d="M72 150 L70 196 L82 196 L84 152 Z" fill="#3a2c22"/><path d="M98 150 L100 196 L88 196 L86 152 Z" fill="#46362a"/>
    <path d="M66 196 h20 l2 8 h-26 z" fill="#241a12"/><path d="M104 196 h-20 l-2 8 h26 z" fill="#1c140e"/>
    <path d="M62 92 Q85 78 108 92 L112 150 Q85 162 58 150 Z" fill="url(#steel)" stroke="#3a4150" stroke-width="1.5"/>
    <path d="M85 92 L85 150" stroke="#5a6478" stroke-width="1.4"/><path d="M66 104 Q85 116 104 104" stroke="#5a6478" stroke-width="1.4" fill="none"/>
    <path d="M60 96 Q44 110 46 138 L58 140 Q60 116 70 102 Z" fill="url(#steelDark)"/>
    <circle cx="44" cy="138" r="22" fill="#8a4030" stroke="#d8a93b" stroke-width="3"/><circle cx="44" cy="138" r="6" fill="#d8a93b"/>
    <path d="M110 96 Q126 104 122 70 L114 50" stroke="#9aa6b8" stroke-width="9" fill="none" stroke-linecap="round"/>
    <rect x="110" y="20" width="6" height="40" rx="2" fill="url(#steel)" transform="rotate(8 113 40)"/>
    <ellipse cx="63" cy="92" rx="13" ry="9" fill="url(#steelDark)" stroke="#3a4150"/><ellipse cx="107" cy="92" rx="13" ry="9" fill="url(#steelDark)" stroke="#3a4150"/>
    <circle cx="85" cy="66" r="15" fill="#e2b48c"/>
    <path d="M70 64 Q85 44 100 64 L100 56 Q85 40 70 56 Z" fill="url(#steel)" stroke="#3a4150"/>
    <rect x="83" y="58" width="4" height="20" rx="2" fill="#7a8496"/>
    <circle cx="79" cy="67" r="1.6" fill="#1a1a2a"/><circle cx="91" cy="67" r="1.6" fill="#1a1a2a"/>
  </g>`;
}
function mutant() {
  return `<g>
    <path d="M74 150 L66 198 L84 198 L84 152 Z" fill="url(#mutDark)"/><path d="M98 150 L110 196 L92 198 L88 152 Z" fill="url(#mutDark)"/>
    <path d="M64 132 L60 162 L72 156 L80 166 L90 154 L100 164 L110 158 L106 132 Z" fill="#5a4632"/>
    <path d="M58 100 Q78 82 110 92 Q124 112 116 140 Q92 152 64 142 Q50 122 58 100 Z" fill="url(#mut)"/>
    <circle cx="74" cy="116" r="4" fill="#aac47a"/><circle cx="96" cy="124" r="5" fill="#aac47a"/>
    <path d="M112 100 Q140 110 138 150" stroke="url(#mut)" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M138 150 l-6 14 m6 -14 l4 16 m-4 -16 l10 10" stroke="#cdd9a0" stroke-width="4" stroke-linecap="round"/>
    <path d="M60 104 Q44 112 46 128" stroke="url(#mutDark)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M70 64 Q86 50 104 64 Q108 82 96 90 Q84 94 74 88 Q66 80 70 64 Z" fill="url(#mut)"/>
    <ellipse cx="80" cy="70" rx="4" ry="5" fill="url(#eye)"/><circle cx="80" cy="70" r="1.6" fill="#1a1a08"/>
    <ellipse cx="95" cy="70" rx="4" ry="5" fill="url(#eye)"/><circle cx="95" cy="70" r="1.6" fill="#1a1a08"/>
    <ellipse cx="88" cy="58" rx="3.5" ry="4" fill="url(#eye)"/><circle cx="88" cy="58" r="1.4" fill="#1a1a08"/>
    <path d="M74 82 Q88 92 100 82 L96 86 L92 81 L88 87 L84 81 L80 86 Z" fill="#2a160f"/>
  </g>`;
}
function place(sprite, x, y, scale = 0.62) {
  const [cx, cy] = iso(x, y);
  return `<g transform="translate(${cx - 85 * scale},${cy + TH - 204 * scale}) scale(${scale})">${sprite}</g>`;
}

// --- Construction de la scène --------------------------------------------
const W = 9, H = 7;
const parts = [];
// Sol (peint par tuile), ordre lignes croissantes
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    let fill = 'url(#grass)';
    if (y >= 5) fill = 'url(#road)';
    else if (x >= 2 && x <= 5 && y >= 1 && y <= 4) fill = 'url(#wood)';
    parts.push(diamond(x, y, fill));
  }
// Murs (mur arrière en L) — dessinés du fond vers l'avant
const walls = [[2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [1, 2], [1, 3], [1, 4]];
walls.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
for (const [x, y] of walls) parts.push(wall(x, y, 46, x > y));
// Personnages (ombre + sprite), triés par profondeur
const actors = [
  { s: soldier(), x: 4, y: 4 },
  { s: mutant(), x: 6, y: 5 },
  { s: mutant(), x: 7, y: 6 },
];
actors.sort((a, b) => a.x + a.y - (b.x + b.y));
for (const a of actors) {
  parts.push(shadow(a.x, a.y));
  parts.push(place(a.s, a.x, a.y));
}

const defs = `
  <radialgradient id="ground" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#2a2236"/><stop offset="100%" stop-color="#0e0b14"/></radialgradient>
  <lineargradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e8edf5"/><stop offset="45%" stop-color="#9aa6b8"/><stop offset="100%" stop-color="#5a6376"/></lineargradient>
  <lineargradient id="steelDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b94a6"/><stop offset="100%" stop-color="#444b5a"/></lineargradient>
  <lineargradient id="cloak" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a8323a"/><stop offset="100%" stop-color="#5e1418"/></lineargradient>
  <lineargradient id="mut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8fae6a"/><stop offset="100%" stop-color="#46612f"/></lineargradient>
  <lineargradient id="mutDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6f8a4d"/><stop offset="100%" stop-color="#33491f"/></lineargradient>
  <radialgradient id="eye" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffe14a"/><stop offset="70%" stop-color="#d88a1a"/><stop offset="100%" stop-color="#7a3a08"/></radialgradient>
  <lineargradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4d7a38"/><stop offset="100%" stop-color="#365827"/></lineargradient>
  <lineargradient id="road" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a58c5c"/><stop offset="100%" stop-color="#8a7348"/></lineargradient>
  <lineargradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8a6638"/><stop offset="100%" stop-color="#6a4d28"/></lineargradient>
  <radialgradient id="warm" cx="55%" cy="20%" r="75%"><stop offset="0%" stop-color="#ffd98a" stop-opacity="0.22"/><stop offset="100%" stop-color="#ffd98a" stop-opacity="0"/></radialgradient>
  <radialgradient id="vig" cx="50%" cy="45%" r="65%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.65"/></radialgradient>`;

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<title>Preuve d'art — iso</title>
<style>body{margin:0;background:#0a0810;color:#e8e0f0;font-family:'Segoe UI',sans-serif}
h1{color:#d8a93b;font-size:20px;margin:18px 24px 8px}
.cap{color:#a99fbd;font-size:13px;margin:8px 24px}</style></head><body>
<h1>⚔️ La Diligence — rendu isométrique SVG (preuve d'art)</h1>
<svg width="900" height="560" viewBox="0 0 900 560">
<defs>${defs}</defs>
<rect width="900" height="560" fill="#0a0810"/>
${parts.join('\n')}
<rect width="900" height="560" fill="url(#warm)"/>
<rect width="900" height="560" fill="url(#vig)"/>
</svg>
<p class="cap">Décor + personnages 100% SVG dessinés/calculés, projection isométrique, ombres portées, lumière chaude et brouillard. C'est ce style qui remplacera les carrés.</p>
</body></html>`;

mkdirSync(resolve(ROOT, 'public'), { recursive: true });
writeFileSync(resolve(ROOT, 'public/art-proof.html'), html, 'utf8');
console.log('public/art-proof.html généré (' + html.length + ' octets)');
