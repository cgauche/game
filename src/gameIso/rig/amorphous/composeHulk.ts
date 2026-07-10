/**
 * Gabarit AMORPHE / HULK (bête des marais, et futurs golems de boue / oozes / fenbeasts / spawn
 * informes). Masse BOURSOUFLÉE irrégulière qui tremblote + visage à plusieurs yeux asymétriques +
 * gueule, deux moignons de bras, bas qui dégouline. Anim propre au plan : tremblotement/pulsation
 * au repos, embardée au déplacement, abattage des bras à l'attaque, affaissement à la mort.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { HULK_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type HulkBoneId = 'corps' | 'brasG' | 'brasD';
type HBone = FKBone & { z: number };
export interface HulkProps {
  sl: number;
  girth: number; // ampleur de la masse
  stored: StoredPalette;
}

function buildSkeleton(): Record<HulkBoneId, HBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 92 }, angle: 0, z: 3 },
    brasG: { parent: 'corps', pivot: { x: -19, y: -2 }, angle: 0, z: 2 },
    brasD: { parent: 'corps', pivot: { x: 19, y: -2 }, angle: 0, z: 4 },
  };
}

function blob(p: HulkProps, view: View): string {
  const g = p.girth;
  const W = (n: number) => (n * g).toFixed(1);
  // masse bosselée (contour irrégulier) + grumeaux clairs/sombres + dégoulinures au bas
  const mass = `<path d="M${W(-24)} 8 Q${W(-29)} -8 ${W(-18)} -19 Q${W(-9)} -27 0 -25 Q${W(12)} -28 ${W(20)} -18 Q${W(29)} -8 ${W(24)} 8 Q${W(27)} 21 ${W(13)} 27 Q0 31 ${W(-14)} 27 Q${W(-27)} 21 ${W(-24)} 8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  const lumps = `<circle cx="${W(-12)}" cy="-11" r="6" fill="@corpsH" opacity="0.28"/><circle cx="${W(10)}" cy="-7" r="7" fill="@corpsH" opacity="0.22"/>` +
    `<circle cx="${W(-9)}" cy="13" r="5" fill="@corpsO" opacity="0.4"/><circle cx="${W(14)}" cy="11" r="6" fill="@corpsO" opacity="0.32"/><circle cx="${W(2)}" cy="-18" r="3.4" fill="@corpsO" opacity="0.3"/>`;
  const drips = `<path d="M${W(-15)} 25 q-1 7 1 11 q2 -1 2 -5 q1 5 3 6 q1 -2 0 -7 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path d="M${W(9)} 26 q1 8 -1 12 q-2 -1 -2 -6 q-1 4 -3 5 q-1 -3 1 -8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>`;
  // « Vaguement humanoïde » (canon) : BOSSE DE TÊTE émergeant de la masse + épaulements —
  // l'ovale uniforme lisait « blob-patate » (verdict des juges aveugles, lot 4).
  const dome = `<path d="M${W(-9)} -24 Q${W(-7)} -33 ${W(1)} -33.5 Q${W(9)} -33 ${W(10)} -24 Q${W(4)} -27.5 ${W(-3)} -27.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M${W(-20)} -19 q-3 -4 -1 -7 M${W(20)} -18 q3 -4 1 -7" stroke="@corpsO" stroke-width="1.4" fill="none" opacity="0.6"/>`; // épaulements de boue
  if (view === 'back') return `<g>${drips}${mass}${dome}${lumps}<path d="M0 -22 Q3 0 0 24" stroke="@corpsO" stroke-width="1" opacity="0.35" fill="none"/></g>`;
  // visage : 3 yeux asymétriques (luisants jaunâtres) + gueule édentée — décalés vers l'AVANT
  // (+x) au profil pour donner une lecture d'orientation.
  const fx = view === 'profile' ? 6 : 0;
  const eyes = `<g transform="translate(${fx},0)"><circle cx="-8" cy="-5" r="3.6" fill="#e8e0c8"/><circle cx="-7.4" cy="-4" r="1.9" fill="#1a0e08"/>` +
    `<circle cx="8" cy="-7" r="3" fill="#e8e0c8"/><circle cx="8.6" cy="-6" r="1.5" fill="#1a0e08"/>` +
    `<circle cx="2" cy="1" r="2.3" fill="#e8e0c8"/><circle cx="2" cy="1.6" r="1.1" fill="#1a0e08"/></g>`;
  const maw = view === 'profile'
    ? `<path d="M0 13 Q8 17 ${W(17)} 11 Q${W(13)} 19 4 19 Q0 17 0 13 Z" fill="#190d08"/>` + // gueule fendue vers l'avant
      `<path d="M4 14 l1 3 l1.6 -2.8 M10 14.4 l0.9 3 l1.5 -2.8" stroke="#cabfa8" stroke-width="0.6" fill="none"/>`
    : `<path d="M-11 13 Q0 18 12 12 Q7 20 0 20 Q-7 20 -11 13 Z" fill="#190d08"/>` +
      `<path d="M-7 13.6 l1 3.4 l1.6 -3 M-1 14.6 l0.8 3.6 l1.6 -3.4 M5 13.8 l1 3.2 l1.4 -3" stroke="#cabfa8" stroke-width="0.6" fill="none"/>`;
  return `<g>${drips}${mass}${dome}${lumps}${eyes}${maw}</g>`;
}
function arm(sx: number): string {
  // moignon grumeleux qui pend (repère épaule)
  return `<path d="M0 -2 Q${sx * 9} 2 ${sx * 8} 14 Q${sx * 9} 22 ${sx * 3} 24 Q${sx * 6} 16 ${sx * 4} 8 Q${sx * 2} 2 0 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<circle cx="${sx * 6}" cy="8" r="2.4" fill="@corpsO" opacity="0.4"/>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const HULK_REST: Record<string, number> = {};
/** Tremblotement : la masse oscille, les moignons ballottent en opposition. phase ∈ [0,1). */
export function hulkWobble(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { corps: s * 3, brasG: s * 9, brasD: -s * 9 };
}
/** Embardée : la masse se balance d'avant en arrière. phase ∈ [0,1). */
export function hulkLurch(phase: number): Record<string, number> {
  return { corps: Math.sin(phase * Math.PI * 2) * 8, brasG: 6, brasD: -6 };
}
/** Abattage : les deux moignons se projettent en avant. phase ∈ [0,1]. */
export function hulkSlam(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { corps: k * 8, brasG: k * 30, brasD: k * 30 };
}
/** Mort : affaissement (masse penchée, moignons retombés). */
export const HULK_DEATH: Record<string, number> = { corps: 16, brasG: 46, brasD: 46 };

export function resolveHulkFromProps(
  p: HulkProps,
  view: View = 'front',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<HulkBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const art: Record<HulkBoneId, string> = { corps: blob(p, view), brasG: arm(-1), brasD: arm(1) };
  return sortByZ((Object.keys(sk) as HulkBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const HULK_DEFAULT: HulkProps = {
  sl: 1.1, girth: 1.0,
  stored: { corps: '#5a5236', corpsO: '#362f1e', corpsH: '#7c7150', cheveux: '#2a2416', cheveuxO: '#181206', cuir: '#3a3320' },
};

export function resolveHulk(species: string, view: View = 'front', pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return resolveHulkFromProps(HULK_SPECIES[species] ?? HULK_DEFAULT, view, pose, colors);
}

export const amorphousPlan: BodyPlan = {
  id: 'amorphous',
  resolve: (sp, view, pose, opts) => resolveHulk(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(HULK_SPECIES),
  restPose: () => HULK_REST,
  idlePose: hulkWobble, // tremblotement en continu
  walkPose: hulkLurch,
  attackPose: hulkSlam,
  deathPose: () => HULK_DEATH,
  hasView: () => true,
};

export function hulkSvg(p: HulkProps, view: View, opts: { dead?: boolean; phase?: number; colors?: Palette } = {}): string {
  const pose = opts.dead ? HULK_DEATH : opts.phase != null ? hulkWobble(opts.phase) : {};
  return bonesToSvg(resolveHulkFromProps(p, view, pose, opts.colors));
}
