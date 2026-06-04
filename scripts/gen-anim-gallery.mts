/**
 * Galerie QC des ANIMATIONS par arme : pour chaque arme canonique, rend 3 stills
 * (portée / armé / frappe) en composant carryPose + keyframes du clip d'attaque.
 * Lancer : npx tsx scripts/gen-anim-gallery.mts → public/anim-gallery.html
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { addPose } from '../src/gameIso/rig/poses';
import { carryPose, weaponAttackClip, weaponParryClip } from '../src/gameIso/rig/anim/weaponClips';
import type { Appearance } from '../src/gameIso/rig/appearance';
import type { Weapon } from '../src/engine/types';

const app: Appearance = { species: 'Humain', sex: 'M', build: 0.55, seed: 4 };
const wep = (name: string, type: 'melee' | 'ranged' = 'melee'): Weapon =>
  ({ name, type, damage: '+4', qualities: [] } as Weapon);

function still(w: Weapon, pose: Record<string, number>, label: string, bg = '#1d2230') {
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 150', width: 96, height: 120 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: DEFS } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: bg }),
      React.createElement(RigSprite, { appearance: app, equip: { weapons: [w], armour: [] }, career: 'Soldat', pose }),
    ),
  );
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:#bcd;font:10px sans-serif">${label}</figcaption></figure>`;
}

// Une arme canonique par GROUPE (résolution data-driven via subType).
const WEAPONS: [string, 'melee' | 'ranged'][] = [
  ['Dague', 'melee'],          // base
  ['Rapière', 'melee'],        // escrime
  ['Lance de cavalerie', 'melee'], // cavalerie
  ['Grande hache', 'melee'],   // deuxmains
  ['Hallebarde', 'melee'],     // hast
  ["Fléau d'armes", 'melee'],  // fleau
  ['Main Gauche', 'melee'],    // parade
  ['Mains nues', 'melee'],     // bagarre
  ['Arc long', 'ranged'],      // arc
  ['Arbalète', 'ranged'],      // arbalete
  ['Pistolet', 'ranged'],      // poudre
  ['Fronde', 'ranged'],        // fronde
  ['Javelot', 'ranged'],       // lancer
  ['Fouet', 'ranged'],         // entraves
  ['Bombe', 'ranged'],         // explosifs
];

const rows: string[] = [];
for (const [name, type] of WEAPONS) {
  const w = wep(name, type);
  const carry = carryPose(w);
  const atk = weaponAttackClip(w);
  const par = weaponParryClip(w, false);
  const windup = atk.steps[0].pose as Record<string, number>;
  const strike = (atk.steps[1] ?? atk.steps[0]).pose as Record<string, number>;
  const cells = [
    still(w, carry, 'porté'),
    still(w, addPose(carry, windup), 'armé'),
    still(w, addPose(carry, strike), 'frappe', '#2a1d22'),
    still(w, addPose(carry, par.steps[0].pose as Record<string, number>), 'parade', '#1d2a22'),
  ].join('');
  rows.push(`<div style="display:flex;align-items:center;gap:8px;margin:6px 0">
    <div style="width:120px;color:#eee;font:12px sans-serif">${name}</div>
    <div style="display:flex;gap:8px">${cells}</div></div>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Anim QC</title></head>
<body style="background:#11141c;padding:16px">
<h1 style="color:#eee;font:18px sans-serif">Galerie QC des animations par arme (groupe canonique)</h1>
<p style="color:#9ab;font:12px sans-serif">Colonnes : pose portée · armé (keyframe 0) · frappe (keyframe 1) · parade. Famille résolue depuis trappings.subType.</p>
${rows.join('')}
</body></html>`;
writeFileSync('public/anim-gallery.html', html);
console.log(`OK: public/anim-gallery.html (${WEAPONS.length} armes × 4 stills)`);
