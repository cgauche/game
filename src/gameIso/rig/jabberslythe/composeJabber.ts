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
function wing(far: boolean, view: View): string {
  // aile de libellule COUCHÉE en diagonale vers l'arrière (les ex-pagaies dressées au sommet
  // lisaient « oreilles de lapin », verdict des juges aveugles). Nervures longitudinales +
  // croisées. De face/dos : écartées en éventail de part et d'autre (signe du miroir).
  const op = far ? 0.45 : 0.62;
  const sx = view === 'profile' ? -1 : far ? -1 : 1; // profil : les 2 vers l'arrière ; face : éventail
  const tilt = view === 'profile' ? 0 : -10;
  return `<g opacity="${op}" transform="scale(${sx},1) rotate(${tilt})">` +
    `<path d="M0 0 Q16 -15 34 -19 Q40 -18 38 -12 Q24 -4 2 3 Z" fill="@corpsH" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M3 -1 Q20 -11 36 -16 M7 0 Q22 -7 34 -11" stroke="@corpsO" stroke-width="0.5" opacity="0.7" fill="none"/>` +
    `<path d="M12 -5.5 l1.6 3.6 M20 -9 l1.6 3.6 M28 -12.5 l1.6 3.6" stroke="@corpsO" stroke-width="0.4" opacity="0.6"/>` +
    `</g>`;
}
function neck(): string {
  // cou SINUEUX en S (le trapèze rectiligne lisait « rectangle raide sans articulation »)
  return `<g><path d="M-5 4 Q-8 -8 -2 -17 Q2 -23 -1 -28 L5 -28 Q8 -17 3 -9 Q0 -2 6 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M-3 0 Q-5 -10 0 -18 Q3 -24 1 -27" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.5"/></g>`;
}
function head(p: JabberProps, view: View): string {
  const antlers = p.antlers
    ? `<path d="M-5 -6 q-5 -8 -4 -16 q3 4 3 8 q2 -3 1 -7 M5 -6 q5 -8 4 -16 q-3 4 -3 8 q-2 -3 -1 -7" fill="none" stroke="@cuir" stroke-width="1.6" stroke-linecap="round"/>`
    : '';
  if (view === 'back') return `<g>${antlers}<ellipse cx="0" cy="0" rx="7" ry="7.5" fill="@corpsO"/></g>`;
  // langue-fouet ANCRÉE à la gueule, qui pend EN AVANT du corps (+x) — fini le ruban qui
  // traversait le ventre. Regard fou mais MÉCHANT : pupille fendue + paupière lourde.
  if (view === 'profile') {
    const tongueP = `<path d="M9 5 Q${12 + 9 * p.tongue} ${9 + 7 * p.tongue} ${8 + 11 * p.tongue} ${12 + 13 * p.tongue} Q${5 + 11 * p.tongue} ${15 + 14 * p.tongue} ${7 + 12 * p.tongue} ${16 + 15 * p.tongue}" fill="none" stroke="#c0303a" stroke-width="2.2" stroke-linecap="round"/>`;
    return `<g>${antlers}<ellipse cx="1" cy="2" rx="8.5" ry="7" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M3 3 Q9 1.5 11.5 4 Q9 8.5 3 8.5 Q1 6 3 3 Z" fill="#1a0e08"/>` +
      `<path d="M5 3.4 l0.8 2.4 l1.2 -2.2 M8 3.2 l0.7 2 l1 -1.8" stroke="#efe6cf" stroke-width="0.7"/>` + // crocs
      tongueP +
      `<ellipse cx="2.5" cy="-2.5" rx="3" ry="3.2" fill="#f2e84a"/><ellipse cx="3" cy="-2.2" rx="0.8" ry="2.4" fill="#0a0603"/>` +
      `<path d="M-0.5 -5.4 Q2.5 -7 5.5 -5" stroke="@corpsO" stroke-width="1.1" fill="none"/></g>`;
  }
  const eyes = `<ellipse cx="-4" cy="-2" rx="3.3" ry="3.5" fill="#f2e84a"/><ellipse cx="-4" cy="-1.8" rx="0.9" ry="2.6" fill="#0a0603"/>` +
    `<ellipse cx="4" cy="-2" rx="3.3" ry="3.5" fill="#f2e84a"/><ellipse cx="4" cy="-1.8" rx="0.9" ry="2.6" fill="#0a0603"/>` +
    `<path d="M-7 -4.8 Q-4 -6.6 -1 -4.6 M1 -4.6 Q4 -6.6 7 -4.8" stroke="@corpsO" stroke-width="1.1" fill="none"/>`; // paupières lourdes
  const tongue = `<path d="M0 8 Q${4 + 7 * p.tongue} ${10 + 9 * p.tongue} ${2 + 9 * p.tongue} ${12 + 14 * p.tongue} Q${9 * p.tongue - 2} ${15 + 15 * p.tongue} ${9 * p.tongue + 1} ${17 + 16 * p.tongue}" fill="none" stroke="#c0303a" stroke-width="2.2" stroke-linecap="round"/>`;
  return `<g>${antlers}<ellipse cx="0" cy="2" rx="8" ry="7" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M-7 4 Q0 7.5 7 4 Q5.5 10.5 0 10.8 Q-5.5 10.5 -7 4 Z" fill="#1a0e08"/>` +
    `<path d="M-4.6 5.4 l0.8 2.6 l1.2 -2.2 M0 6.2 l0.8 2.6 l1.2 -2.2 M4 5.6 l0.7 2.2 l1 -2" stroke="#efe6cf" stroke-width="0.7"/>` + // crocs
    `${tongue}${eyes}</g>`;
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
  const art: Record<JabberBoneId, string> = { corps: body(p, view), aileG: wing(true, view), aileD: wing(false, view), cou: neck(), tete: head(p, view) };
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
