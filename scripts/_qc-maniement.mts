/**
 * QC « maniement » : pour chaque CLASSE DE MANIEMENT (un représentant), rend l'IDLE
 * (weaponRest) et l'APEX d'ATTAQUE (weaponAttackClip échantillonné), en FRONT et PROFIL,
 * via les VRAIES fonctions de prod (pas une table dupliquée).
 *   → public/qc/man-<cls>.png (2×2 idle/attaque × front/profil, pour le juge aveugle)
 *   → public/qc/maniement.png (montage de revue)
 * Usage : npx tsx scripts/_qc-maniement.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { addPose, type Pose } from '../src/gameIso/rig/poses';
import { weaponRest, weaponAttackClip } from '../src/gameIso/rig/anim/weaponClips';
import { clipDuration, sampleClip } from '../src/gameIso/rig/anim/clips';
import type { Weapon } from '../src/engine/types';
import type { RigSpeciesId } from '../src/gameIso/rig/appearance';
import { assertWardrobeId } from './_lib-wardrobe';

// Mannequin : ID de garde-robe (carrière ∪ classe ∪ tenue), validé fail-fast — un id qui retombe
// sur « nu » déshabillerait la planche en silence (#1338).
const MANNEQUIN = 'soldat';
assertWardrobeId(MANNEQUIN, 'qc-maniement');

mkdirSync('public/qc', { recursive: true });
const APP = { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.5, seed: 4 } as const;
const wp = (name: string, type: 'melee' | 'ranged' = 'melee'): Weapon => ({ label: name, type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon);

// Un représentant par classe (le libellé résout la classe via la forme).
const REPS: Array<{ cls: string; w: Weapon }> = [
  { cls: 'lame1m', w: wp('Dague') },
  { cls: 'escrime', w: wp('Rapière') },
  { cls: 'lourde2m', w: wp('Zweihänder') },
  { cls: 'hampe', w: wp('Hallebarde') },
  { cls: 'lance_cav', w: wp('Lance de cavalerie') },
  { cls: 'fleau', w: wp("Fléau d'armes") },
  { cls: 'parade', w: wp('Main Gauche') },
  { cls: 'poings', w: wp('Coup-de-poing') },
  { cls: 'arc', w: wp('Arc long', 'ranged') },
  { cls: 'arbalete', w: wp('Arbalète', 'ranged') },
  { cls: 'arme_feu', w: wp('Arquebuse', 'ranged') },
  { cls: 'fronde', w: wp('Fronde', 'ranged') },
  { cls: 'jet', w: wp('Javelot', 'ranged') },
  { cls: 'entraves', w: wp('Fouet', 'ranged') },
  { cls: 'explosif', w: wp('Bombe', 'ranged') },
];

/** Pose d'apex d'attaque = repos + clip échantillonné juste avant le retour au repos. */
function attackApex(w: Weapon): Pose {
  const clip = weaponAttackClip(w);
  const apexT = clipDuration(clip) - clip.steps[clip.steps.length - 1].ms; // début du pas de retour = apex
  return addPose(weaponRest(w), sampleClip(clip, apexT).pose);
}

const draw = (w: Weapon, pose: Pose, view: 'front' | 'profile') =>
  `<rect width="120" height="150" fill="#1d2230"/>${renderToStaticMarkup(
    React.createElement(RigSprite, { appearance: APP, equip: { weapons: [w], armour: [] }, career: MANNEQUIN, pose, view }),
  )}`;

const png = (svgInner: string, w: number, h: number, scale = 2) =>
  new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs>${DEFS}</defs>${svgInner}</svg>`,
    { background: '#11141c', fitTo: { mode: 'width', value: w * scale } }).render().asPng();

// PNG 2×2 par classe : (idle/attaque) × (front/profil)
for (const { cls, w } of REPS) {
  const rest = weaponRest(w), apex = attackApex(w);
  const panes = [
    { p: rest, v: 'front' as const, t: 'idle·F' }, { p: rest, v: 'profile' as const, t: 'idle·P' },
    { p: apex, v: 'front' as const, t: 'atk·F' }, { p: apex, v: 'profile' as const, t: 'atk·P' },
  ];
  const tiles = panes.map((pn, i) => {
    const x = (i % 2) * 124, y = Math.floor(i / 2) * 168;
    return `<g transform="translate(${x},${y})">${draw(w, pn.p, pn.v)}<text x="60" y="164" text-anchor="middle" font-size="11" fill="#9fb">${pn.t}</text></g>`;
  });
  writeFileSync(`public/qc/man-${cls}.png`, png(tiles.join(''), 248, 336, 2));
}

// Montage de revue : 1 ligne par classe = [idle·F, atk·F, idle·P, atk·P]
const COLS = 4, CW = 124, RH = 168;
const rows = REPS.map((r, row) => {
  const rest = weaponRest(r.w), apex = attackApex(r.w);
  const cells = [
    { p: rest, v: 'front' as const }, { p: apex, v: 'front' as const },
    { p: rest, v: 'profile' as const }, { p: apex, v: 'profile' as const },
  ];
  return cells.map((cl, col) =>
    `<g transform="translate(${col * CW},${row * RH})">${draw(r.w, cl.p, cl.v)}${col === 0 ? `<text x="4" y="12" font-size="10" fill="#fd8">${r.cls}</text>` : ''}</g>`,
  ).join('');
});
writeFileSync('public/qc/maniement.png', png(rows.join(''), COLS * CW, REPS.length * RH, 2));

// Galerie IDLE PROPRE (état toujours visible) : 15 classes, [front | profil], 3 paires/ligne.
const PAIRS = 3, PW = 248, PRH = 168;
const idleTiles = REPS.map((r, i) => {
  const rest = weaponRest(r.w);
  const x = (i % PAIRS) * PW, y = Math.floor(i / PAIRS) * PRH;
  return `<g transform="translate(${x},${y})"><g>${draw(r.w, rest, 'front')}</g><g transform="translate(124,0)">${draw(r.w, rest, 'profile')}</g><text x="124" y="164" text-anchor="middle" font-size="11" fill="#fd8">${r.cls}</text></g>`;
});
const irows = Math.ceil(REPS.length / PAIRS);
writeFileSync('public/qc/maniement-idle.png', png(idleTiles.join(''), PAIRS * PW, irows * PRH, 1.6));
console.log(`OK → public/qc/man-*.png (${REPS.length}) + maniement.png + maniement-idle.png`);
