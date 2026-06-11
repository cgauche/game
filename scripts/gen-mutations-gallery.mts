/**
 * Galerie QC des MUTATIONS physiques (LDB 19) : chaque mutation rendue sur le rig
 * (calques/morpho/peau/membres remplacés), vues directionnelles, collisions avec
 * l'armure équipée, et mutants ennemis tirés au seed.
 * Lancer : npx tsx scripts/gen-mutations-gallery.mts → public/mutations-gallery.html
 */
import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { mutationOverlaysFor, mutationAppearance, randomMutationOverlays } from '../src/gameIso/rig/parts/mutations';
import { injuryOverlaysFor } from '../src/gameIso/rig/parts/injuries';
import { LABELS_PHYSIQUES } from '../src/data/mutations';
import type { Mutation } from '../src/engine/corruption';
import type { Combatant, Trauma } from '../src/engine/types';
import type { Appearance } from '../src/gameIso/rig/appearance';
import type { EquipCtx } from '../src/gameIso/rig/parts/equipment';
import type { RigOverlay } from '../src/gameIso/rig/bones';
import type { View } from '../src/gameIso/rig/facing';
import type { ItemInstance, Weapon } from '../src/engine/types';

const APP: Appearance = { species: 'Humain', sex: 'M', build: 0.5, seed: 4 };
const NU: EquipCtx = { weapons: [], armour: [] };
const mut = (label: string): Mutation => ({ label, kind: 'physique', roll: 1 });

function cell(label: string, app: Appearance, overlays: RigOverlay[], opts: { view?: View; equip?: EquipCtx; career?: string; bg?: string; tint?: string } = {}): string {
  const svg = renderToStaticMarkup(
    React.createElement('svg', { viewBox: '0 0 120 150', width: 110, height: 138 },
      React.createElement('defs', { dangerouslySetInnerHTML: { __html: DEFS } }),
      React.createElement('rect', { x: 0, y: 0, width: 120, height: 150, fill: opts.bg ?? '#1d2230' }),
      React.createElement(RigSprite, { appearance: app, equip: opts.equip ?? NU, career: opts.career ?? 'Mendiant', view: opts.view ?? 'front', overlays }),
    ),
  );
  return `<figure style="margin:0;text-align:center"><div>${svg}</div><figcaption style="color:${opts.tint ?? '#cdd'};font:11px sans-serif">${label}</figcaption></figure>`;
}

const mutCell = (label: string, opts: Parameters<typeof cell>[3] = {}) =>
  cell(opts.view ? `${label} — ${opts.view}` : label, mutationAppearance(APP, [mut(label)]), mutationOverlaysFor([mut(label)]), opts);

const sections: string[] = [];
const section = (title: string, cells: string[]) =>
  sections.push(`<h2 style="color:#eee;font:15px sans-serif;margin:22px 0 8px">${title}</h2>`
    + `<div style="display:grid;grid-template-columns:repeat(auto-fill,120px);gap:14px">${cells.join('')}</div>`);

// 1) La table physique complète, de face.
section('Tableau de Corruption physique (LDB 19) — vue de face', LABELS_PHYSIQUES.map((l) => mutCell(l)));

// 2) Vues directionnelles : détails de visage (face seule), membres remplacés, morpho.
const VUES = ['Groin poilu', 'Visage inversé', 'Cornes asymétriques', 'Tentacule épais', 'Pattes d’animaux', 'Plumes éparses', 'Court sur pattes', 'Corpulent', 'Émacié'];
section('Vues — les détails de visage disparaissent de dos/profil', VUES.flatMap((l) =>
  (['front', 'profile', 'back'] as View[]).map((view) => mutCell(l, { view }))));

// 3) Collisions avec l'armure équipée + arme en main (Soldat cuirassé).
const piece = (uid: string, pa: number, locs: ItemInstance['locs']): ItemInstance =>
  ({ uid, name: `Protection (${locs![0]})`, kind: 'armor', qualities: [], pa, locs, enc: 0, equipped: true });
const ARMOUR: ItemInstance[] = [piece('a1', 3, ['corps']), piece('a2', 2, ['tete']), piece('a3', 1, ['brasG', 'brasD']), piece('a4', 1, ['jambeG', 'jambeD'])];
const EPEE: Weapon = { name: 'Épée', type: 'melee', damage: '+4', qualities: [] };
const SOLDAT: Parameters<typeof cell>[3] = { equip: { weapons: [EPEE], armour: ARMOUR }, career: 'Soldat', bg: '#222a24', tint: '#be9' };
section('Sur armure équipée (épée en main)', [
  'Suintement de pus', 'Bouche supplémentaire', 'Écailles épineuses', 'Plumes éparses', 'Peau d’acier',
  'Tentacule épais', 'Doigts distendus', 'Pattes d’animaux', 'Cornes asymétriques',
].map((l) => mutCell(l, SOLDAT)));

// 4) Mutants ennemis : visuels tirés au seed du même registre (chemin enemyProfile).
section('Mutants ennemis — tirage déterministe au seed', [0, 1, 7, 42, 1234, 77].map((seed) =>
  cell(`Mutant seed ${seed}`, { ...APP, seed }, randomMutationOverlays(seed), { bg: '#2a1d22', tint: '#e9b' })));

// 5) Amputations & prothèses (LDB 18/73, injuries.ts) : séquelle nue puis prothèse portée.
const trauma = (over: Partial<Trauma>): Trauma => ({ label: 'x', location: 'tete', note: '', ...over });
const wounded = (traumas: Trauma[], prosthesis?: string): Combatant =>
  ({ id: 'g', name: 'G', kind: 'hero', traumas, items: prosthesis ? [{ uid: 'p', name: prosthesis, kind: 'misc', qualities: [], enc: 0, equipped: true }] : [] }) as unknown as Combatant;
const MAIN_D = trauma({ label: 'Main/bras amputé (brasD)', location: 'brasD', noTwoHanded: true });
const JAMBE_G = trauma({ label: 'Membre inférieur amputé (jambeG)', location: 'jambeG', movementHalved: true });
const INJ: { label: string; c: Combatant }[] = [
  { label: 'Main amputée (moignon)', c: wounded([MAIN_D]) },
  { label: 'Crochet porté', c: wounded([MAIN_D], 'Crochet') },
  { label: 'Merveille d’ingénierie', c: wounded([MAIN_D], "Merveille d'ingénierie") },
  { label: 'Fausse jambe', c: wounded([JAMBE_G], 'Fausse jambe') },
  { label: 'Œil perdu', c: wounded([trauma({ label: 'Œil perdu' })]) },
  { label: 'Cache-œil', c: wounded([trauma({ label: 'Œil perdu' })], 'Cache-œil') },
  { label: 'Œil de verre', c: wounded([trauma({ label: 'Œil perdu' })], 'Œil de verre') },
  { label: 'Cécité (bandage)', c: wounded([trauma({ label: 'Cécité' })]) },
  { label: 'Nez amputé', c: wounded([trauma({ label: 'Nez amputé' })]) },
  { label: 'Nez doré', c: wounded([trauma({ label: 'Nez amputé' })], 'Nez doré') },
];
section('Amputations &amp; prothèses (LDB 18 / 73)', INJ.map(({ label, c }) =>
  cell(label, APP, injuryOverlaysFor(c), { career: 'Soldat', bg: '#241f2a', tint: '#caf' })));

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mutations QC</title></head>
<body style="background:#11141c;padding:16px">
<h1 style="color:#eee;font:18px sans-serif">Galerie QC — mutations physiques (LDB 19) sur le rig</h1>
${sections.join('')}
</body></html>`;

writeFileSync('public/mutations-gallery.html', html);
console.log('OK: public/mutations-gallery.html');
