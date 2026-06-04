/**
 * Galerie QC du rig : compose RigSprite pour un panel d'espèces × sexe (+ variantes
 * d'équipement) et écrit public/rig-gallery.html. Lancer : npx tsx scripts/gen-rig-gallery.mts
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import type { Appearance } from '../src/gameIso/rig/appearance';
import type { EquipCtx } from '../src/gameIso/rig/parts/equipment';
import type { Weapon, ItemInstance } from '../src/engine/types';

const SPECIES = ['Humain', 'Halfling', 'Nain', 'Gnome', 'Ogre', 'Haut-Elfe', 'Elfe sylvain'];
const wep = (name: string, type: 'melee' | 'ranged'): Weapon => ({ name, type, damage: '+4', qualities: [] } as Weapon);
const plate: ItemInstance = { uid: '1', name: 'Plastron de plaque', kind: 'armor', qualities: [], pa: 4, locs: ['corps'], enc: 1, equipped: true };
const helm: ItemInstance = { uid: '2', name: 'Heaume', kind: 'armor', qualities: [], pa: 2, locs: ['tete'], enc: 1, equipped: true };

function cell(label: string, app: Appearance, equip: EquipCtx, career: string) {
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 150', width: 110, height: 138 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: DEFS } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: '#1d2230' }),
      React.createElement(RigSprite, { appearance: app, equip, career }),
    ),
  );
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:#cdd;font:11px sans-serif">${label}</figcaption></figure>`;
}

const cells: string[] = [];
for (const sp of SPECIES) {
  for (const sex of ['M', 'F'] as const) {
    cells.push(cell(`${sp} ${sex}`, { species: sp, sex, build: 0.5, seed: 7 }, { weapons: [], armour: [] }, 'Soldat'));
  }
}
// variantes d'équipement (Humain M)
cells.push(cell('Humain M + épée', { species: 'Humain', sex: 'M', build: 0.5, seed: 3 }, { weapons: [wep('Épée', 'melee')], armour: [] }, 'Soldat'));
cells.push(cell('Humain M + hache+bouclier', { species: 'Humain', sex: 'M', build: 0.6, seed: 3 }, { weapons: [wep('Hache', 'melee')], armour: [], shield: { name: 'Bouclier', qualities: ['Bouclier'] } as unknown as Weapon }, 'Soldat'));
cells.push(cell('Humain M + plaque+heaume', { species: 'Humain', sex: 'M', build: 0.6, seed: 3 }, { weapons: [wep('Épée', 'melee')], armour: [plate, helm] }, 'Soldat'));
cells.push(cell('Humain F Sorcier + bâton', { species: 'Humain', sex: 'F', build: 0.4, seed: 5 }, { weapons: [wep('Bâton', 'melee')], armour: [] }, 'Sorcier'));
cells.push(cell('Nain M + hache', { species: 'Nain', sex: 'M', build: 0.7, seed: 9 }, { weapons: [wep('Hache', 'melee')], armour: [] }, 'Soldat'));

// Tenues par carrière (sans équipement → la tenue de la carrière s'affiche).
for (const car of ['Garde', 'Noble', 'Répurgateur', 'Tueur', 'Médecin', 'Voleur', 'Flagellant', 'Sorcier', 'Chevalier', 'Mendiant', 'Nonne', 'Batelier']) {
  cells.push(cell(car, { species: 'Humain', sex: 'M', build: 0.55, seed: 4 }, { weapons: [], armour: [] }, car));
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rig QC</title></head>
<body style="background:#11141c;padding:16px">
<h1 style="color:#eee;font:18px sans-serif">Galerie QC du rig — espèces × sexe + équipement</h1>
<div style="display:grid;grid-template-columns:repeat(auto-fill,120px);gap:14px">${cells.join('')}</div>
</body></html>`;

writeFileSync('public/rig-gallery.html', html);

// Échantillons .svg autonomes (pour inspection directe).
function standalone(app: Appearance, equip: EquipCtx, career: string) {
  return renderToStaticMarkup(
    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 120 150', width: 240, height: 300 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: DEFS } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: '#2a3142' }),
      React.createElement(RigSprite, { appearance: app, equip, career }),
    ),
  );
}
writeFileSync('public/rig-sample-humain.svg', standalone({ species: 'Humain', sex: 'M', build: 0.55, seed: 3 }, { weapons: [wep('Épée', 'melee')], armour: [], shield: { name: 'Bouclier', qualities: ['Bouclier'] } as unknown as Weapon }, 'Soldat'));
writeFileSync('public/rig-sample-nain.svg', standalone({ species: 'Nain', sex: 'M', build: 0.7, seed: 9 }, { weapons: [wep('Hache', 'melee')], armour: [] }, 'Soldat'));
console.log(`OK: public/rig-gallery.html (${cells.length} cellules) + 2 svg autonomes`);
