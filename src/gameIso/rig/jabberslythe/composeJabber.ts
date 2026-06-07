/**
 * Gabarit JABBERSLYTHE (bêtes du Chaos crapaud-dragon-insecte : Jabberslythe générique +
 * variantes nommées Slenderthigh Whiptongue / Fr'hough Mournbreath). Corps bouffi verruqueux sur
 * deux pattes, AILES DE LIBELLULE qui vrombissent, long cou sinueux, petite tête au regard fou +
 * LANGUE-FOUET, bois optionnels. Anim propre : vrombissement + ondulation du cou au repos, bond
 * au déplacement, fouet de langue/cou à l'attaque, effondrement à la mort. Variantes par def
 * (couleur / bois / longueur de langue) → bespoke ANIMÉ, plus de sprite figé.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { JABBER_SPECIES } from '../creatures';

export type JabberBoneId = 'corps' | 'aileG' | 'aileD' | 'cou' | 'tete';
type JBone = FKBone & { z: number };
export interface JabberProps {
  sl: number;
  girth: number;
  antlers: boolean; // bois ramifiés (Mournbreath)
  tongue: number; // longueur de la langue-fouet (× ; Whiptongue = long)
  stored: StoredPalette;
}

function buildSkeleton(): Record<JabberBoneId, JBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 96 }, angle: 0, z: 3 }, // corps bouffi + 2 pattes
    aileG: { parent: 'corps', pivot: { x: -6, y: -14 }, angle: 0, z: 1 }, // aile lointaine (derrière)
    aileD: { parent: 'corps', pivot: { x: 8, y: -15 }, angle: 0, z: 2 }, // aile proche
    cou: { parent: 'corps', pivot: { x: 12, y: -10 }, angle: -16, z: 4 }, // long cou vers l'avant-haut
    tete: { parent: 'cou', pivot: { x: 0, y: -28 }, angle: 12, z: 5 },
  };
}

function body(p: JabberProps, view: View): string {
  const g = p.girth, rx = 20 * g, ry = 18 * g;
  const legs = `<path d="M-12 ${ry - 4} q-8 6 -9 16 q5 2 8 -2 q-1 6 2 9 l4 0 q2 -10 -1 -22 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M12 ${ry - 4} q8 6 9 16 q-5 2 -8 -2 q1 6 -2 9 l-4 0 q-2 -10 1 -22 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>`;
  const ball = `<ellipse cx="0" cy="0" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="-5" cy="-5" rx="${(rx * 0.5).toFixed(1)}" ry="${(ry * 0.45).toFixed(1)}" fill="@corpsH" opacity="0.3"/>`;
  // verrues/pustules (texture chaos)
  const warts = `<circle cx="-9" cy="3" r="2" fill="@corpsO" opacity="0.5"/><circle cx="7" cy="6" r="2.4" fill="@corpsO" opacity="0.45"/><circle cx="-3" cy="9" r="1.6" fill="@corpsO" opacity="0.5"/><circle cx="11" cy="-3" r="1.8" fill="@corpsO" opacity="0.4"/>`;
  if (view === 'back') return `<g>${legs}${ball}${warts}<path d="M0 ${-ry + 4} L0 ${ry - 2}" stroke="@corpsO" stroke-width="1" opacity="0.4"/></g>`;
  return `<g>${legs}${ball}${warts}</g>`;
}
function wing(far: boolean): string {
  // aile de libellule : membrane translucide nervurée, dressée haut-arrière
  const op = far ? 0.45 : 0.6;
  return `<g opacity="${op}">` +
    `<path d="M0 0 Q-10 -22 -8 -40 Q-5 -46 -1 -42 Q2 -26 3 -4 Z" fill="@corpsH" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M0 -2 Q-7 -22 -5 -40 M-6 -8 Q-3 -24 -2 -38" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.7"/>` +
    `</g>`;
}
function neck(): string {
  return `<g><path d="M-5 4 Q-6 -14 -2 -28 L4 -28 Q6 -14 5 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M-4 -2 Q-3 -16 -1 -26 M3 -2 Q3 -16 2 -26" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.5"/></g>`;
}
function head(p: JabberProps, view: View): string {
  const antlers = p.antlers
    ? `<path d="M-5 -6 q-5 -8 -4 -16 q3 4 3 8 q2 -3 1 -7 M5 -6 q5 -8 4 -16 q-3 4 -3 8 q-2 -3 -1 -7" fill="none" stroke="@cuir" stroke-width="1.6" stroke-linecap="round"/>`
    : '';
  if (view === 'back') return `<g>${antlers}<ellipse cx="0" cy="0" rx="7" ry="7.5" fill="@corpsO"/></g>`;
  // petite tête, ÉNORME yeux globuleux fous + large gueule + langue-fouet pendante
  const eyes = `<circle cx="-4" cy="-2" r="3.6" fill="#f2e84a"/><circle cx="-3.4" cy="-1.4" r="1.7" fill="#0a0603"/><circle cx="-2.8" cy="-2.6" r="0.6" fill="#fff"/>` +
    `<circle cx="4" cy="-2" r="3.6" fill="#f2e84a"/><circle cx="4.6" cy="-1.4" r="1.7" fill="#0a0603"/><circle cx="5.2" cy="-2.6" r="0.6" fill="#fff"/>`;
  const tongue = `<path d="M0 6 Q-2 ${6 + 10 * p.tongue} 3 ${8 + 16 * p.tongue} Q6 ${10 + 18 * p.tongue} 4 ${12 + 20 * p.tongue}" fill="none" stroke="#c0303a" stroke-width="2.2" stroke-linecap="round"/>`;
  return `<g>${antlers}<ellipse cx="0" cy="2" rx="8" ry="7" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M-6 5 Q0 8 6 5 Q4 9 0 9 Q-4 9 -6 5 Z" fill="#1a0e08"/>${tongue}${eyes}</g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const JABBER_REST: Record<string, number> = {};
const buzz = (phase: number, amp: number) => Math.sin(phase * Math.PI * 2 * 7) * amp; // ~7 battements/cycle
/** Vrombissement des ailes + ondulation du cou au repos. phase ∈ [0,1). */
export function jabberHover(phase: number): Record<string, number> {
  const b = buzz(phase, 18);
  return { aileD: -b, aileG: b, cou: Math.sin(phase * Math.PI * 2) * 5, tete: -Math.sin(phase * Math.PI * 2) * 3 };
}
/** Bond + vrombissement ample. phase ∈ [0,1). */
export function jabberDart(phase: number): Record<string, number> {
  const b = buzz(phase, 30);
  return { aileD: -b, aileG: b, corps: Math.sin(phase * Math.PI * 2) * 6 };
}
/** Fouet : le cou et la tête (langue) se projettent en avant. phase ∈ [0,1]. */
export function jabberWhip(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { cou: k * 30, tete: k * 26, aileD: -buzz(phase, 22), aileG: buzz(phase, 22) };
}
/** Mort : effondrement (corps penché, cou tombé, ailes affaissées). */
export const JABBER_DEATH: Record<string, number> = { corps: 20, cou: 60, tete: 30, aileD: 40, aileG: -40 };

export function resolveJabberFromProps(
  p: JabberProps,
  view: View = 'front',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<JabberBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const art: Record<JabberBoneId, string> = { corps: body(p, view), aileG: wing(true), aileD: wing(false), cou: neck(), tete: head(p, view) };
  return (Object.keys(sk) as JabberBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    }))
    .sort((a, b) => a.z - b.z);
}

export const JABBER_DEFAULT: JabberProps = {
  sl: 1.15, girth: 1.0, antlers: false, tongue: 1,
  stored: { corps: '#c8682a', corpsO: '#8a4216', corpsH: '#e89a52', cheveux: '#6a3210', cheveuxO: '#3a1c08', cuir: '#caa23a' },
};

export function resolveJabber(species: string, view: View = 'front', pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return resolveJabberFromProps(JABBER_SPECIES[species] ?? JABBER_DEFAULT, view, pose, colors);
}

export const jabberslythePlan: BodyPlan = {
  id: 'jabberslythe',
  resolve: (sp, view, pose, opts) => resolveJabber(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(JABBER_SPECIES),
  restPose: () => JABBER_REST,
  idlePose: jabberHover, // ailes qui vrombissent en continu
  walkPose: jabberDart,
  attackPose: jabberWhip,
  deathPose: () => JABBER_DEATH,
  hasView: () => true,
};

export function jabberSvg(p: JabberProps, view: View, opts: { dead?: boolean; phase?: number; colors?: Palette } = {}): string {
  const pose = opts.dead ? JABBER_DEATH : opts.phase != null ? jabberHover(opts.phase) : {};
  return bonesToSvg(resolveJabberFromProps(p, view, pose, opts.colors));
}
