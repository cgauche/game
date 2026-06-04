/**
 * Galerie QC des vues directionnelles du bestiaire (F2) : pour chaque créature
 * ayant des vues générées, rend front / dos / profil (+ profil miroir).
 * Lancer : npx tsx scripts/gen-bestiary-views-gallery.mts → public/bestiary-views.html
 */
import { writeFileSync } from 'node:fs';
import creatureViews from '../src/gameIso/creatureViews.json';
import { creatureView } from '../src/gameIso/sprites';
import { DEFS } from '../src/gameIso/sprites';

function cell(label: string, view: 'front' | 'back' | 'profile', mirror = false) {
  const inner = creatureView(label, view);
  const m = mirror ? '<g transform="translate(160,0) scale(-1,1)">' : '<g>';
  const svg =
    `<svg viewBox="0 0 160 160" width="104" height="104"><defs>${DEFS}</defs>` +
    `<rect x="0" y="0" width="160" height="160" fill="#171b26"/>${m}${inner}</g></svg>`;
  const tag = view + (mirror ? '↔' : '');
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:#bcd;font:10px sans-serif">${tag}</figcaption></figure>`;
}

const keys = Object.keys(creatureViews as Record<string, unknown>).sort();
const rows = keys.map((k) =>
  `<div style="display:flex;align-items:center;gap:8px;margin:5px 0;border-bottom:1px solid #222">
     <div style="width:170px;color:#eee;font:12px sans-serif">${k}</div>
     <div style="display:flex;gap:6px">${cell(k, 'front')}${cell(k, 'profile')}${cell(k, 'profile', true)}${cell(k, 'back')}</div>
   </div>`,
);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bestiaire — vues</title></head>
<body style="background:#11141c;padding:16px">
<h1 style="color:#eee;font:18px sans-serif">Bestiaire — vues directionnelles (F2) — ${keys.length} créatures</h1>
<p style="color:#9ab;font:12px sans-serif">Colonnes : face · profil (droite) · profil miroir (gauche) · dos. Généré par workflow best-of-2 + juge.</p>
${rows.join('')}
</body></html>`;
writeFileSync('public/bestiary-views.html', html);
console.log(`OK: public/bestiary-views.html (${keys.length} créatures × 4 vues)`);
