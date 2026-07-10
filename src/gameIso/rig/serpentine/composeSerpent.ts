/**
 * Gabarit SERPENTIN (serpent / sangsue) — limbless. Pas de pattes : un corps LOVÉ (mound de
 * boucles empilées, statique) + un cou dressé et une tête qui ONDULENT (FK générique). C'est
 * l'anim propre au plan : balancement de cobra au repos, lunge à l'attaque, tête affaissée à la
 * mort. Réutilise INTÉGRALEMENT la machinerie (FK worldTransformsG, palette tokenisée, rendu).
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { SERPENT_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type SerpentBoneId = 'corps' | 'cou' | 'tete';
type SBone = FKBone & { z: number };
export interface SerpentProps {
  sl: number; // échelle token (taille relative en jeu)
  girth: number; // épaisseur du corps lové
  hood: boolean; // capuchon de cobra (déployé derrière la tête)
  stored: StoredPalette; // robe par défaut (corps/corpsO/corpsH…)
}

function buildSkeleton(): Record<SerpentBoneId, SBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 118 }, angle: 0, z: 2 },
    cou: { parent: 'corps', pivot: { x: 6, y: -14 }, angle: -8, z: 3 },
    tete: { parent: 'cou', pivot: { x: 0, y: -38 }, angle: 6, z: 4 },
  };
}

// --- art (repère LOCAL de l'os) -------------------------------------------
function coil(p: SerpentProps): string {
  const g = p.girth;
  // Boucles DÉCALÉES qui se chevauchent (croissants d'ombre = sens d'enroulement) + QUEUE qui
  // émerge du lové — les ellipses concentriques empilées lisaient « pile de pneus / poterie »
  // (verdict des juges aveugles, lot 4).
  return `<g>` +
    `<ellipse cx="0" cy="27" rx="${(36 * g).toFixed(1)}" ry="14" fill="@corpsO" opacity="0.9"/>` +
    `<ellipse cx="-4" cy="18" rx="${(33 * g).toFixed(1)}" ry="13.5" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<path d="M${(20 * g).toFixed(1)} 22 Q${(34 * g).toFixed(1)} 24 ${(42 * g).toFixed(1)} 17 Q${(45 * g).toFixed(1)} 14 ${(42 * g).toFixed(1)} 12.5 Q${(36 * g).toFixed(1)} 16 ${(26 * g).toFixed(1)} 14 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // pointe de queue émergente
    `<ellipse cx="${(7 * g).toFixed(1)}" cy="8" rx="${(25 * g).toFixed(1)}" ry="10.5" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<path d="M${(-16 * g).toFixed(1)} 12.5 Q7 18 ${(28 * g).toFixed(1)} 9.5 Q7 13.5 ${(-14 * g).toFixed(1)} 9 Z" fill="@corpsO" opacity="0.5"/>` + // croissant : la boucle médiane passe DEVANT
    `<ellipse cx="-1" cy="-1" rx="${(16 * g).toFixed(1)}" ry="7.5" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<path d="M${(-12 * g).toFixed(1)} 2.5 Q2 6.5 ${(18 * g).toFixed(1)} 1 Q2 3 ${(-11 * g).toFixed(1)} -1 Z" fill="@corpsO" opacity="0.45"/>` +
    `<ellipse cx="-7" cy="15" rx="${(19 * g).toFixed(1)}" ry="5.2" fill="@corpsH" opacity="0.3"/>` +
    `<ellipse cx="${(9 * g).toFixed(1)}" cy="5.5" rx="${(13 * g).toFixed(1)}" ry="3.8" fill="@corpsH" opacity="0.28"/>` +
    `</g>`;
}
function neck(): string {
  // cou FUSELÉ en S (large à la base, fin vers la tête) — le tube rigide lisait « périscope ».
  return `<g>` +
    `<path d="M-7 5 Q-9 -10 -4 -22 Q-1 -31 -2.5 -40 L3 -40 Q6 -27 3.5 -17 Q2 -6 7 5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<path d="M-4.5 2 Q-6 -12 -1.5 -24 Q1 -32 0 -38" stroke="@corpsH" stroke-width="1.1" fill="none" opacity="0.4"/>` +
    `<path d="M-6.5 -3 Q-1 0 4.5 -3 M-5 -15 Q-1 -12 3.5 -15.5 M-3.5 -27 Q-0.5 -24.5 2.5 -28" stroke="@corpsO" stroke-width="0.7" fill="none" opacity="0.5"/>` +
    `</g>`;
}
function headProfile(p: SerpentProps): string {
  const hood = p.hood
    ? `<path d="M-5 4 Q-19 -4 -15 -21 Q-7 -14 -1 -9 Z" fill="@corpsO" opacity="0.8"/><path d="M5 4 Q19 -4 15 -21 Q7 -14 1 -9 Z" fill="@corpsO" opacity="0.8"/>`
    : '';
  return `<g>${hood}` +
    `<path d="M-5 3 Q-6 -8 0 -11 Q10 -12 16 -7 Q19 -4 16 -1 Q8 -2 2 0 Q-3 2 -5 3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="3" cy="-6" rx="2" ry="2.3" fill="#d8b020"/><ellipse cx="3" cy="-6" rx="0.5" ry="2.1" fill="#0a0603"/>` +
    `<path d="M3 -1.5 Q9 -2 15 -1" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.6"/>` +
    `<path d="M15 -2 q5 -1.5 9 -0.5 M15 -1 q5 0.5 8 2.5" stroke="#b83030" stroke-width="0.8" fill="none" stroke-linecap="round"/>` +
    `</g>`;
}
function headFront(p: SerpentProps): string {
  const hood = p.hood
    ? `<path d="M-4 2 Q-20 -2 -18 -20 Q-9 -12 -2 -8 Z" fill="@corpsO" opacity="0.8"/><path d="M4 2 Q20 -2 18 -20 Q9 -12 2 -8 Z" fill="@corpsO" opacity="0.8"/>`
    : '';
  return `<g>${hood}` +
    `<path d="M-6 -8 Q-7 4 0 9 Q7 4 6 -8 Q0 -11 -6 -8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="-3" cy="-4" rx="1.7" ry="2" fill="#d8b020"/><ellipse cx="-3" cy="-4" rx="0.9" ry="0.6" fill="#0a0603"/>` +
    `<ellipse cx="3" cy="-4" rx="1.7" ry="2" fill="#d8b020"/><ellipse cx="3" cy="-4" rx="0.9" ry="0.6" fill="#0a0603"/>` +
    `<path d="M-2 8 q2 1.5 4 0 M0 9 l-1.5 5 M0 9 l1.5 5" stroke="#b83030" stroke-width="0.8" fill="none" stroke-linecap="round"/>` +
    `</g>`;
}
function headBack(p: SerpentProps): string {
  const hood = p.hood
    ? `<path d="M-4 2 Q-20 -2 -18 -20 Q-9 -12 -2 -8 Z" fill="@corpsO"/><path d="M4 2 Q20 -2 18 -20 Q9 -12 2 -8 Z" fill="@corpsO"/>`
    : '';
  return `<g>${hood}<path d="M-6 -8 Q-7 4 0 9 Q7 4 6 -8 Q0 -11 -6 -8 Z" fill="@corpsO" stroke="@corpsO" stroke-width="0.8"/><path d="M0 -9 L0 7" stroke="@corps" stroke-width="0.6" opacity="0.4"/></g>`;
}

function headFor(p: SerpentProps, view: View): string {
  return view === 'front' ? headFront(p) : view === 'back' ? headBack(p) : headProfile(p);
}

// --- poses (DELTA additif sur l'angle de repos) ---------------------------
export const SERPENT_REST: Record<string, number> = {};
/** Balancement de cobra : le cou ondule, la tête contre-balance. phase ∈ [0,1). */
export function serpentSway(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { cou: s * 7, tete: -s * 5 };
}
/** Lunge d'attaque : le cou se projette en avant, la gueule s'ouvre. phase ∈ [0,1]. */
export function serpentStrike(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI); // 0→1→0
  return { cou: k * 34, tete: k * 18 };
}
/** Mort : tête et cou affaissés sur le côté. */
export const SERPENT_DEATH: Record<string, number> = { cou: 74, tete: 36 };

// --- compose --------------------------------------------------------------
export function resolveSerpentFromProps(
  p: SerpentProps,
  view: View = 'profile',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<SerpentBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const art: Record<SerpentBoneId, string> = { corps: coil(p), cou: neck(), tete: headFor(p, view) };
  return sortByZ((Object.keys(sk) as SerpentBoneId[])
    .map((id) => ({
      id,
      matrix: world[id],
      scale: [1, 1] as [number, number],
      z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

/** Props par défaut (serpent générique) — repli si une espèce n'est pas dans le registre. */
export const SERPENT_DEFAULT: SerpentProps = {
  sl: 1.0, girth: 1.0, hood: true,
  stored: { corps: '#5a7a44', corpsO: '#37502a', corpsH: '#82a05e', cheveux: '#2c3a20', cheveuxO: '#1a2410', cuir: '#caa23a' },
};

/** (espèce, vue, pose, couleurs) → os résolus, depuis la table d'espèces du registre. */
export function resolveSerpent(species: string, view: View = 'profile', pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return resolveSerpentFromProps(SERPENT_SPECIES[species] ?? SERPENT_DEFAULT, view, pose, colors);
}
/** Gabarit serpentin enregistrable. L'ondulation de cobra est l'IDLE du plan (animée en continu
 *  par AnimatedPlanToken) ; la marche reprend l'ondulation amplifiée. */
export const serpentinePlan: BodyPlan = {
  id: 'serpentine',
  resolve: (sp, view, pose, opts) => resolveSerpent(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(SERPENT_SPECIES),
  restPose: () => SERPENT_REST,
  idlePose: (phase) => serpentSway(phase * 0.5), // ondulation douce au repos
  walkPose: serpentSway, // ondulation ample en déplacement
  attackPose: serpentStrike,
  deathPose: () => SERPENT_DEATH,
  hasView: () => true,
};

/** SVG (string, boîte 120×150) d'un serpent prêt à injecter — pose mort/sway intégrée. */
export function serpentSvg(
  p: SerpentProps,
  view: View,
  opts: { dead?: boolean; swayPhase?: number; colors?: Palette } = {},
): string {
  const pose = opts.dead ? SERPENT_DEATH : opts.swayPhase != null ? serpentSway(opts.swayPhase) : {};
  return bonesToSvg(resolveSerpentFromProps(p, view, pose, opts.colors));
}
