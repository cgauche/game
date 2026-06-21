/**
 * Galerie QC EXHAUSTIVE des armes : chaque arme du Livre de base (+ ADE) tenue par
 * un soldat humain riggé, groupée par Groupe canonique (WFRP4), étiquetée avec sa
 * FORME d'art résolue (weaponFamily). Permet de vérifier que TOUTE arme a un visuel
 * lisible. Lancer : npx tsx scripts/gen-weapon-gallery.mts → public/weapon-gallery.html
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { weaponFamily } from '../src/gameIso/rig/parts/equipment';
import trappings from '../src/data/trappings.json';
import type { Weapon } from '../src/engine/types';

const GROUPS = [
  'Base', 'Escrime', 'Cavalerie', 'Deux-mains', "Armes d'hast", 'Fléau', 'Parade', 'Bagarre',
  'Arc', 'Arbalète', 'Poudre noire', 'Poudre noire et ingénierie', 'Fronde', 'Lancer', 'Entraves', 'Explosifs', 'Ingénierie',
];
const RANGED = new Set(['Arc', 'Arbalète', 'Poudre noire', 'Poudre noire et ingénierie', 'Fronde', 'Lancer', 'Explosifs', 'Ingénierie']);
type Trapping = { label: string; type?: string; subType?: string };
const all = (trappings as Trapping[]).filter((t) => t.subType && GROUPS.includes(t.subType));

function fig(w: Weapon, shield = false) {
  const equip = shield
    ? { weapons: [], armour: [], shield: { name: w.name, qualities: ['Bouclier'] } as unknown as Weapon }
    : { weapons: [w], armour: [] };
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 150', width: 92, height: 115 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: DEFS } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: '#1d2230' }),
      React.createElement(RigSprite, { appearance: { species: 'Humain', sex: 'M', build: 0.5, seed: 4 }, equip, career: 'Soldat' }),
    ),
  );
  const fam = shield ? 'bouclier' : weaponFamily(w) || '(mains nues)';
  return `<figure style="margin:0;text-align:center"><div>${svg}</div>
    <figcaption style="color:#cdd;font:10.5px sans-serif">${w.name}<br><span style="color:#8a93a6">[${fam}]</span></figcaption></figure>`;
}

let body = '';
for (const g of GROUPS) {
  const ws = all.filter((t) => t.subType === g);
  if (!ws.length) continue;
  const cells = ws
    .map((t) => {
      const isShield = /bouclier/i.test(t.label);
      const type = (RANGED.has(g) ? 'ranged' : 'melee') as 'melee' | 'ranged';
      return fig({ name: t.label, type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon, isShield);
    })
    .join('');
  body += `<h2 style="color:#d8a93b;font:14px sans-serif;margin:18px 0 6px">${g} <span style="color:#6a7384;font-size:11px">(${ws.length})</span></h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,100px);gap:10px">${cells}</div>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Armes QC</title></head>
<body style="background:#11141c;padding:16px">
<h1 style="color:#eee;font:18px sans-serif">Galerie QC des armes — ${all.length} armes (LDB + ADE), par Groupe canonique</h1>
<p style="color:#8a93a6;font:12px sans-serif">Chaque arme tenue par un soldat humain. <b>[forme]</b> = visuel d'art résolu (familles partagées par Groupe). Les munitions/projectiles (Flèche, Carreau, Balle…) n'ont pas d'arme dessinée → repli.</p>
${body}
</body></html>`;
writeFileSync('public/weapon-gallery.html', html);
console.log(`OK: public/weapon-gallery.html (${all.length} armes)`);
