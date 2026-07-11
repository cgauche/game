/**
 * Gabarit THÉROPODE (grands sauriens prédateurs des Terres du Sud — Cornu, et tout carnosaure
 * bipède) : bête dressée sur deux PATTES ARRIÈRE massives (digitigrades, serres), petits bras
 * avant griffus, longue queue-balancier à crête, cou porté en avant, longue gueule de prédateur
 * hérissée de rangées de dents, cornes recourbées optionnelles (le trait identitaire du Cornu).
 * Anim propre au plan : respiration/balancement de queue au repos, foulée bipède au déplacement,
 * détente du cou + gueule grande ouverte à l'attaque, effondrement en avant à la mort. Réutilise
 * la machinerie (FK générique, palette tokenisée, rendu) — même patron que jabberslythe/squig.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { THEROPOD_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type TheropodBoneId =
  | 'corps' | 'queue' | 'cou' | 'tete' | 'machoire'
  | 'brasG' | 'brasD' | 'jambeG' | 'jambeD';
type TBone = FKBone & { z: number };
export interface TheropodProps {
  sl: number;
  girth: number; // profondeur du torse
  horns: number; // × longueur des cornes recourbées (0 = crâne nu — carnosaure sans cornes)
  muzzle: number; // × longueur de la gueule
  stored: StoredPalette;
}

const TEETH = '#efe6cf';
const MAW = '#2a0e0c';
const TONGUE = '#b03038';
const CLAW = '#15110c';

/** Longueur du museau (repère local de la tête). */
const muzzleLen = (p: TheropodProps): number => 14 + 8 * p.muzzle;

/** Rangée de dents triangulaires (le prédateur en a des DIZAINES, pas 3). `up` = crocs dressés. */
function teethRow(x0: number, x1: number, y: number, h: number, up: boolean): string {
  let d = '';
  for (let x = x0, i = 0; x <= x1; x += 2.9, i++) {
    const hh = i % 2 === 0 ? h : h * 0.7;
    d += `M${x.toFixed(1)} ${y} l1 ${(up ? -hh : hh).toFixed(1)} l1.4 ${(up ? hh : -hh).toFixed(1)} `;
  }
  return `<path d="${d}" fill="${TEETH}"/>`;
}

function buildSkeleton(p: TheropodProps): Record<TheropodBoneId, TBone> {
  void p;
  return {
    corps: { parent: null, pivot: { x: 58, y: 96 }, angle: 0, z: 5 }, // torse penché, hanches massives
    queue: { parent: 'corps', pivot: { x: -18, y: 0 }, angle: 0, z: 3 }, // balancier à crête
    cou: { parent: 'corps', pivot: { x: 15, y: -13 }, angle: 14, z: 6 }, // porté en avant
    tete: { parent: 'cou', pivot: { x: 0, y: -22 }, angle: -8, z: 7 },
    machoire: { parent: 'tete', pivot: { x: 0, y: 1.5 }, angle: 9, z: 8 }, // gueule entrouverte au repos
    brasG: { parent: 'corps', pivot: { x: 11, y: 2 }, angle: 0, z: 2 }, // petit bras lointain
    brasD: { parent: 'corps', pivot: { x: 14, y: 4 }, angle: 0, z: 9 },
    jambeG: { parent: 'corps', pivot: { x: -13, y: 2 }, angle: 4, z: 1 }, // patte lointaine, décalée derrière
    jambeD: { parent: 'corps', pivot: { x: -4, y: 2 }, angle: 0, z: 10 },
  };
}

/** Adapte le squelette à la VUE (comme quadSkeletonForView) : face/dos = composition SYMÉTRIQUE
 *  (cou/tête recentrés, pattes en straddle, queue derrière en face / pendante vers l'œil de dos). */
function skeletonForView(sk: Record<TheropodBoneId, TBone>, view: View): Record<TheropodBoneId, TBone> {
  if (view === 'profile') return sk;
  const front = view === 'front';
  const out = { ...sk };
  out.queue = { ...sk.queue, pivot: { x: front ? 3 : 0, y: 3 }, angle: 0, z: front ? 1 : 8 };
  out.cou = { ...sk.cou, pivot: { x: 0, y: -16 }, angle: 0, z: 6 };
  out.tete = { ...sk.tete, pivot: { x: 0, y: -15 }, angle: 0, z: 7 };
  out.machoire = { ...sk.machoire, pivot: { x: 0, y: 3 }, angle: 0, z: 8 };
  out.brasD = { ...sk.brasD, pivot: { x: 12, y: 0 }, angle: 0, z: front ? 6 : 2 };
  out.brasG = { ...sk.brasG, pivot: { x: -12, y: 0 }, angle: 0, z: front ? 6 : 2 };
  out.jambeD = { ...sk.jambeD, pivot: { x: 10, y: 2 }, angle: 0, z: 4 };
  out.jambeG = { ...sk.jambeG, pivot: { x: -10, y: 2 }, angle: 0, z: 4 };
  return out;
}

function body(p: TheropodProps, view: View): string {
  const g = p.girth;
  if (view !== 'profile') {
    const rx = 15 * g;
    // poitrail vu de bout + mouchetures ; épines d'épaule en silhouette
    const spikes = `<path d="M${-rx + 4} -15 l-3.5 -7 l6.5 2.6 M-3.5 -18 l-1 -7.5 l5 4 M${rx - 7} -16 l2.5 -7 l4 5.5" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
    const chest = `<ellipse cx="0" cy="0" rx="${rx.toFixed(1)}" ry="19" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
    const belly = view === 'front'
      ? `<ellipse cx="0" cy="6" rx="${(rx * 0.58).toFixed(1)}" ry="11" fill="@corpsH" opacity="0.5"/>` +
        `<path d="M-6 -2 q6 2.6 12 0 M-5 4 q5 2.4 10 0 M-4 10 q4 2.2 8 0" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.45"/>`
      : `<path d="M0 -17 L0 17" stroke="@corpsO" stroke-width="1" opacity="0.4"/>` + // sillon dorsal
        `<path d="M-1.5 -13 l-2 -6 l5 2.2 M-1 -6 l-1.5 -6 l4.5 2.4 M-0.5 1 l-1.5 -6 l4.5 2.4 M0 8 l-1.5 -5.5 l4 2.2" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
    const spots = `<circle cx="${-rx + 5}" cy="-6" r="1.9" fill="@corpsO" opacity="0.35"/><circle cx="${rx - 5}" cy="-3" r="1.7" fill="@corpsO" opacity="0.35"/><circle cx="${-rx + 7}" cy="6" r="1.5" fill="@corpsO" opacity="0.3"/><circle cx="${rx - 7}" cy="9" r="1.6" fill="@corpsO" opacity="0.3"/>`;
    return `<g>${chest}${spikes}${belly}${spots}</g>`;
  }
  // PROFIL : torse penché — poitrail avant (+x) haut, masse des hanches à l'arrière
  const torso = `<path d="M-24 4 Q-28 -8 -17 -14 Q-4 -20 9 -15 Q18 -11 19.5 -3 Q20 7 10 12.5 Q-6 18.5 -18 12 Q-23 9 -24 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<circle cx="-13" cy="3" r="${(11.5 * g).toFixed(1)}" fill="@corps"/>`; // cuisse/hanche massive
  const belly = `<path d="M-17 10 Q-2 17.5 12 7.5 Q9 13 -3 14.8 Q-13 14 -17 10 Z" fill="@corpsH" opacity="0.55"/>`;
  const scales = `<path d="M-15 -6 q6 3 12 1 M-9 0 q6 3 12 1 M-2 -8 q5 3 10 1 M3 -2 q5 2.6 9 0.6" stroke="@corpsO" stroke-width="0.55" fill="none" opacity="0.5"/>`;
  const spots = `<circle cx="-7" cy="-8" r="2.1" fill="@corpsO" opacity="0.35"/><circle cx="4" cy="-10" r="1.7" fill="@corpsO" opacity="0.35"/><circle cx="-17" cy="-3" r="1.9" fill="@corpsO" opacity="0.3"/><circle cx="11" cy="-6" r="1.5" fill="@corpsO" opacity="0.3"/>`;
  const crest = `<path d="M-21 -8.5 l-2.5 -7.5 l6 3.4 M-12 -12.5 l-1.5 -8.5 l6 4 M-3 -16 l0 -8.5 l5.5 4.8 M7 -14 l1.5 -8 l5 5.4" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
  return `<g>${torso}${belly}${scales}${spots}${crest}</g>`;
}

function tail(view: View): string {
  if (view !== 'profile') {
    if (view === 'front') // pointe qui dépasse sur le flanc
      return `<g opacity="0.95"><path d="M0 5 Q14 9 23 4 Q27 1 23.5 -1 Q16 2 5 1 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/></g>`;
    // DOS : la queue pend vers l'œil, crête visible
    return `<g><path d="M-4 -2 Q-6 12 -3 24 Q0 33 6.5 37.5 Q10 39.5 8 34 Q4.5 25 4.5 12 Q4.5 3 4 -2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
      `<path d="M-3.5 4 l-4.5 -1 l3 4.2 M-3.5 12 l-4.5 -0.6 l3 4 M-2.5 20 l-4.2 0 l3 3.6 M0 28 l-4 0.6 l3.4 3" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/></g>`;
  }
  // PROFIL : balancier épais qui s'effile, pointe retroussée (artwork), crête d'épines sur l'arête
  const mass = `<path d="M2 -7 C-14 -11 -28 -9 -38 -17 Q-41.5 -19.5 -39 -14 C-33 -4 -18 3.5 2 7.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  const light = `<path d="M-8 4.5 Q-22 1.5 -33 -6" stroke="@corpsH" stroke-width="0.9" fill="none" opacity="0.5"/>`;
  const spikes = `<path d="M-7 -9 l-2 -6.5 l5.5 2.8 M-16 -9.8 l-2.5 -6 l5.8 2.4 M-25 -9.5 l-3 -5.5 l6 2 M-33 -12 l-3.5 -5 l5.8 1.4" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
  return `<g>${mass}${spikes}${light}</g>`;
}

function neck(view: View): string {
  if (view !== 'profile') {
    return `<g><path d="M-6.5 3 Q-7.5 -8 -5 -16 L5 -16 Q7.5 -8 6.5 3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      (view === 'front' ? `<path d="M-3 -12 Q0 2 3 -12" stroke="@corpsH" stroke-width="1.6" fill="none" opacity="0.5"/>`
        : `<path d="M-0.5 -14 l-1.5 -5 l4 2 M0 -8 l-1.5 -5 l4 2.2" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`) + `</g>`;
  }
  // colonne musclée penchée en avant, base évasée noyée dans le torse, gorge claire, épines de nuque
  return `<g><path d="M-9.5 8 Q-9.8 -7 -4.5 -22 L6 -22 Q9 -8 9.5 8 Q0 12 -9.5 8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<path d="M4.5 -18 Q6.5 -6 5.5 4" stroke="@corpsH" stroke-width="1.4" fill="none" opacity="0.55"/>` + // gorge
    `<path d="M-6.5 -2 l-5.5 -3.2 l6.3 -2 M-6 -9.5 l-5 -3.8 l6.3 -1.4 M-5 -16.5 l-4.5 -4.2 l6 -1" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/></g>`;
}

function head(p: TheropodProps, view: View): string {
  const hl = p.horns;
  if (view === 'back') {
    const horns = hl > 0
      ? `<path d="M-4 -8 Q${-9 - 6 * hl} ${-11 - 5 * hl} ${-10 - 9 * hl} ${-4 - 2 * hl} q-0.6 2.6 1.8 1 Q${-4 - 5 * hl} ${-7 - 3 * hl} -1.5 -9.5 Z M4 -8 Q${9 + 6 * hl} ${-11 - 5 * hl} ${10 + 9 * hl} ${-4 - 2 * hl} q0.6 2.6 -1.8 1 Q${4 + 5 * hl} ${-7 - 3 * hl} 1.5 -9.5 Z" fill="@cuir" stroke="@corpsO" stroke-width="0.6"/>`
      : '';
    return `<g>${horns}<path d="M-6.5 -5 Q-6.5 -12 0 -12 Q6.5 -12 6.5 -5 Q6.5 1 4.5 3.5 L-4.5 3.5 Q-6.5 1 -6.5 -5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
      `<path d="M-0.8 -11 l0 -4.5 l3 2.6 M2 -9.5 l1.2 -4 l2.4 3.2" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/></g>`;
  }
  if (view === 'front') {
    const horns = hl > 0 // croissants : sortent en dehors puis remontent en crochet (pas des oreilles droites)
      ? `<path d="M-4 -9.5 Q${-11 - 6 * hl} ${-9 - 2 * hl} ${-11 - 7 * hl} ${-17 - 6 * hl} q-0.4 -3.2 2.4 -1.2 Q${-6 - 5 * hl} ${-12 - 3 * hl} -1.5 -11.5 Z M4 -9.5 Q${11 + 6 * hl} ${-9 - 2 * hl} ${11 + 7 * hl} ${-17 - 6 * hl} q0.4 -3.2 -2.4 -1.2 Q${6 + 5 * hl} ${-12 - 3 * hl} 1.5 -11.5 Z" fill="@cuir" stroke="@corpsO" stroke-width="0.6"/>`
      : '';
    const skull = `<path d="M-7 -6 Q-7 -13 0 -13 Q7 -13 7 -6 Q7 0 4.5 2.5 L-4.5 2.5 Q-7 0 -7 -6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
    const crest = `<path d="M-1.2 -12.6 l0 -4.6 l3 2.6 M2.4 -11.8 l1.2 -4.2 l2.6 3.4" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
    const eyes = `<ellipse cx="-3.5" cy="-6.5" rx="1.9" ry="2.2" fill="#e8c53a"/><ellipse cx="-3.5" cy="-6.3" rx="0.6" ry="1.7" fill="#0a0603"/>` +
      `<ellipse cx="3.5" cy="-6.5" rx="1.9" ry="2.2" fill="#e8c53a"/><ellipse cx="3.5" cy="-6.3" rx="0.6" ry="1.7" fill="#0a0603"/>` +
      `<path d="M-5.8 -8.6 Q-3.5 -10 -1.2 -8.4 M1.2 -8.4 Q3.5 -10 5.8 -8.6" stroke="@corpsO" stroke-width="0.9" fill="none"/>`;
    const maw = `<path d="M-5 0.6 Q0 -1 5 0.6 Q5.4 7.6 0 9.5 Q-5.4 7.6 -5 0.6 Z" fill="${MAW}"/>` +
      `<path d="M-4.4 0.8 l0.8 3.2 l1.1 -3 M-1.9 0.2 l0.8 3.4 l1.1 -3.2 M0.6 0.3 l0.8 3.3 l1.1 -3.1 M3 0.9 l0.8 2.9 l1 -2.7" fill="${TEETH}"/>`;
    return `<g>${horns}${skull}${crest}${eyes}${maw}</g>`;
  }
  // PROFIL : longue gueule de prédateur, arcade marquée, corne(s) recourbée(s) vers l'arrière
  const mz = muzzleLen(p);
  const hornFar = hl > 0
    ? `<path d="M-6 -8.5 Q${-11 - 8 * hl} ${-11 - 8 * hl} ${-9 - 14 * hl} ${-3 - 4 * hl} q0 2.8 2.2 0.8 Q${-4 - 8 * hl} ${-8 - 5 * hl} -3.5 -9.5 Z" fill="@cuir" opacity="0.75" stroke="@corpsO" stroke-width="0.5"/>`
    : '';
  const hornNear = hl > 0
    ? `<path d="M-3 -10 Q${-8 - 9 * hl} ${-13 - 9 * hl} ${-5 - 16 * hl} ${-5 - 5 * hl} q0.4 3 2.4 0.6 Q${-1 - 9 * hl} ${-10 - 6 * hl} 0.5 -10.8 Z" fill="@cuir" stroke="@corpsO" stroke-width="0.6"/>`
    : '';
  const skull = `<path d="M-9 2 Q-11 -6 -5 -10.5 Q1 -13.5 6 -10.5 Q10 -8.5 ${(mz * 0.55).toFixed(1)} -7 Q${mz} -4.5 ${mz + 1} -1 Q${mz} 1.6 ${mz - 2} 1.6 L-6 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  const brow = `<path d="M-5 -8.6 Q-0.5 -10.2 3.5 -8.2" stroke="@corpsO" stroke-width="1.1" fill="none"/>`;
  const eye = `<ellipse cx="-0.5" cy="-6.2" rx="2" ry="2.3" fill="#e8c53a"/><ellipse cx="0" cy="-6" rx="0.65" ry="1.8" fill="#0a0603"/>`;
  const nostril = `<circle cx="${(mz - 2.5).toFixed(1)}" cy="-2.8" r="0.8" fill="@corpsO"/>`;
  const crest = `<path d="M-7.5 -7.5 l-3 -5.5 l5.5 1.6" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`;
  const teeth = teethRow(2, mz - 1.5, 1.4, 4.4, false);
  return `<g>${hornFar}${skull}${crest}${brow}${eye}${nostril}${teeth}${hornNear}</g>`;
}

function jaw(p: TheropodProps, view: View): string {
  if (view === 'back') return '';
  if (view === 'front') {
    return `<g><path d="M-5 0 Q0 -1.2 5 0 Q5.6 6.4 0 8 Q-5.6 6.4 -5 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-1.6 3 Q0 2.3 1.6 3 Q0.9 5.1 0 5.3 Q-0.9 5.1 -1.6 3 Z" fill="${TONGUE}"/>` +
      `<path d="M-4.2 0.4 l0.8 -3 l1.1 3.2 M-1.7 0 l0.8 -3.3 l1.1 3.1 M0.8 0 l0.8 -3.2 l1.1 3 M3.2 0.4 l0.7 -2.8 l1 3" fill="${TEETH}"/></g>`;
  }
  // PROFIL : mâchoire inférieure longue, langue rouge, crocs dressés
  const mz = muzzleLen(p);
  const bone = `<path d="M-1.5 0 Q${(mz * 0.5).toFixed(1)} 2.5 ${(mz * 0.82).toFixed(1)} 4.5 Q${(mz * 0.55).toFixed(1)} 9 2 7.5 Q-3.5 5 -1.5 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  const tongue = `<path d="M2.5 3 Q${(mz * 0.38).toFixed(1)} 3.6 ${(mz * 0.52).toFixed(1)} 5.2 Q${(mz * 0.32).toFixed(1)} 6.6 3 5.6 Z" fill="${TONGUE}"/>`;
  const teeth = teethRow(1.5, mz * 0.74, 1.6, 3.6, true);
  return `<g>${bone}${tongue}${teeth}</g>`;
}

function arm(view: View, far: boolean): string {
  if (view === 'back') return '';
  if (view === 'front') {
    const sx = far ? -1 : 1; // bras G/D recentrés en miroir
    return `<g transform="scale(${sx},1)"><path d="M0 -2 Q4 3 3 9 Q2.5 13 -1 14.5 L-2.5 12 Q0.5 10 0.5 6 Q0 1 -2 -1 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<path d="M-1 14 l-1 3 M-2.4 12.6 l-2.6 2.2" stroke="${CLAW}" stroke-width="1.1" stroke-linecap="round"/></g>`;
  }
  const op = far ? ' opacity="0.85"' : '';
  // petit bras avant : humérus court vers le bas, avant-bras en avant, deux griffes
  return `<g${op}><path d="M-2.5 -2.5 Q-5.5 5 0 9.5 Q5.5 12.5 9.5 11 L9 7.8 Q4.5 8.6 1.5 5.6 Q-0.8 2 1 -1.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M9.2 9.4 l3.6 1.6 M8.2 11 l2.8 2.8" stroke="${CLAW}" stroke-width="1.2" stroke-linecap="round"/></g>`;
}

function leg(p: TheropodProps, view: View, far: boolean): string {
  const g = p.girth;
  if (view !== 'profile') {
    const sx = far ? -1 : 1;
    // pilier digitigrade vu de bout : cuisse large, canon, pied à 3 serres
    return `<g transform="scale(${sx},1)"><path d="M-7 -2 Q-12 10 -9 24 Q-7 34 -6 40 L5 40 Q8 24 5 6 Q4 -2 1 -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
      `<path d="M-8 40 L-10 46.5 L10 46.5 L8 40 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M-7 46.5 l-1 3.4 M-1.5 46.5 l0 3.8 M4 46.5 l1 3.4 M8 46.5 l2 2.8" stroke="${CLAW}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<path d="M-8 6 q4 4 10 3" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.5"/></g>`;
  }
  const op = far ? ' opacity="0.85"' : '';
  // PROFIL : patte arrière en Z (cuisse-pilon massive, jarret haut, canon, pied à serres + ergot)
  const thigh = `<ellipse cx="1" cy="12" rx="${(9.5 * g).toFixed(1)}" ry="15" transform="rotate(-14 1 12)" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  const shank = `<path d="M6 22 Q9.5 28 7 34 Q5 39 -1 41.5 L-4.5 39.5 Q0.5 34 -0.5 27 Q-1 23.5 -3.5 21 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  const foot = `<path d="M-5 40 Q3 42 11.5 43.5 L12.5 47.5 L-7 47.5 Q-9 43.5 -5 40 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  const claws = `<path d="M12 45 l5 1.6 -4.2 2.6 M6 47.5 l3.2 3.4 M0 47.5 l2 3.8 M-6.5 46 l-2.8 2.4" stroke="${CLAW}" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
  const scales = `<path d="M-5 6 q5 4 11 2.6 M-6 13 q5.5 4 11.5 2.4" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.5"/>`;
  const light = `<path d="M-4 19 Q1 22 5 19.5" stroke="@corpsH" stroke-width="1" fill="none" opacity="0.5"/>`;
  return `<g${op}>${thigh}${scales}${light}${shank}${foot}${claws}</g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const THEROPOD_REST: Record<string, number> = {};
/** Respiration : balancement de queue, dodelinement du cou, gueule qui s'entrouvre. phase ∈ [0,1). */
export function theroBreathe(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { queue: s * 4, cou: s * 2, tete: -s * 1.5, machoire: (s + 1) * 2, brasD: s * 2, brasG: -s * 2 };
}
/** Foulée bipède : pattes en opposition, torse qui tangue, queue-balancier en contre. phase ∈ [0,1). */
export function theroStride(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { jambeD: s * 16, jambeG: -s * 16, corps: Math.sin(phase * Math.PI * 4) * 2.5, queue: -s * 6, cou: -s * 2.5, brasD: -s * 5, brasG: s * 5 };
}
/** Bond (trait) : ramassé puis détente, pattes repliées, queue tendue. phase ∈ [0,1). */
export function theroPounce(phase: number): Record<string, number> {
  const k = (Math.sin(phase * Math.PI * 2) + 1) / 2;
  return { corps: -4 - 5 * k, jambeD: 20 * k, jambeG: 20 * k, queue: -10 * k, cou: 5 * k };
}
/** Morsure : le corps plonge, le cou se détend, la gueule s'ouvre en grand. phase ∈ [0,1]. */
export function theroBite(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { corps: k * 5, cou: k * 15, tete: k * 9, machoire: k * 30, brasD: -k * 10, brasG: -k * 10, queue: -k * 8 };
}
/** Mort : effondrement en avant (torse basculé, cou tombé, gueule molle, pattes fauchées). */
export const THEROPOD_DEATH: Record<string, number> = {
  corps: 78, cou: 44, tete: 22, machoire: 16, jambeD: 26, jambeG: 12, brasD: 18, brasG: 8, queue: -22,
};

export function resolveTheropodFromProps(
  p: TheropodProps,
  view: View = 'front',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = skeletonForView(buildSkeleton(p), view);
  const world = worldTransformsG(sk, pose) as Record<TheropodBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const art: Record<TheropodBoneId, string> = {
    corps: body(p, view), queue: tail(view), cou: neck(view), tete: head(p, view), machoire: jaw(p, view),
    brasG: arm(view, true), brasD: arm(view, false), jambeG: leg(p, view, true), jambeD: leg(p, view, false),
  };
  return sortByZ((Object.keys(sk) as TheropodBoneId[])
    .filter((id) => art[id])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const THEROPOD_DEFAULT: TheropodProps = {
  sl: 1.1, girth: 1.0, horns: 1.0, muzzle: 1.0,
  stored: { corps: '#55703c', corpsO: '#28381d', corpsH: '#a3bd68', cheveux: '#39502a', cheveuxO: '#1c2a13', cuir: '#7a755c' },
};

export function resolveTheropod(species: string, view: View = 'front', pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return resolveTheropodFromProps(THEROPOD_SPECIES[species] ?? THEROPOD_DEFAULT, view, pose, colors);
}

export const theropodPlan: BodyPlan = {
  id: 'theropode',
  resolve: (sp, view, pose, opts) => resolveTheropod(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(THEROPOD_SPECIES),
  restPose: () => THEROPOD_REST,
  idlePose: theroBreathe,
  walkPose: theroStride,
  leapPose: theroPounce,
  attackPose: theroBite,
  deathPose: () => THEROPOD_DEATH,
  portraitBox: '52 26 60 60', // cadre la tête haute-avant (cou porté en avant + cornes)
  hasView: () => true,
};

export function theropodSvg(p: TheropodProps, view: View, opts: { dead?: boolean; phase?: number; colors?: Palette } = {}): string {
  const pose = opts.dead ? THEROPOD_DEATH : opts.phase != null ? theroBreathe(opts.phase) : {};
  return bonesToSvg(resolveTheropodFromProps(p, view, pose, opts.colors));
}
