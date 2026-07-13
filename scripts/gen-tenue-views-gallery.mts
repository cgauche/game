/**
 * Galerie QC des vues de TENUE : rend le RIG COMPLET en front/profil/dos pour chaque tenue
 * SPÉCIFIQUE du registre `defs/`, pour valider le torse dos/profil en contexte.
 * Lancer : npx tsx scripts/gen-tenue-views-gallery.mts → public/tenue-views.html
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { SPECIFIC_TENUE_NAMES } from '../src/gameIso/rig/parts/tenues';
import type { Appearance, RigSpeciesId } from '../src/gameIso/rig/appearance';

const app: Appearance = { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.55, seed: 4 };
const careers = SPECIFIC_TENUE_NAMES.slice().sort((a, b) => a.localeCompare(b, 'fr'));

function cell(career: string, view: 'front' | 'profile' | 'back') {
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 150', width: 92, height: 115 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: DEFS } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: view === 'back' ? '#241a1a' : '#1b1f2b' }),
      React.createElement(RigSprite, { appearance: app, equip: { weapons: [], armour: [] }, career, view }),
    ),
  );
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:#bcd;font:10px sans-serif">${view}</figcaption></figure>`;
}

const rows = careers.map((c) =>
  `<div style="display:flex;align-items:center;gap:10px;margin:4px 0;border-bottom:1px solid #222">
     <div style="width:140px;color:#eee;font:12px sans-serif">${c}</div>
     <div style="display:flex;gap:8px">${cell(c, 'front')}${cell(c, 'profile')}${cell(c, 'back')}</div>
   </div>`,
);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Tenues — vues</title></head>
<body style="background:#11141c;padding:16px">
<h1 style="color:#eee;font:18px sans-serif">Tenues — vues dos/profil — ${careers.length} tenues</h1>
<p style="color:#9ab;font:12px sans-serif">Rig complet (Humain M) en face/profil/dos. Le torse de dos doit être cohérent (sans détails de face), le profil plus étroit.</p>
${rows.join('')}
</body></html>`;
writeFileSync('public/tenue-views.html', html);
console.log(`OK: public/tenue-views.html (${careers.length} carrières × 3 vues)`);
