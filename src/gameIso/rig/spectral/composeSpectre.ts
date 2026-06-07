/**
 * Gabarit SPECTRAL (spectre / fantôme / banshee) — mort-vivant immatériel : buste flottant
 * TRANSLUCIDE qui se dissout en volutes vaporeuses (pas de jambes), bras flottants, tête à
 * regard luisant (capuche / visage hurlant / crâne). Anim propre au plan : flottement/ondulation
 * des volutes au repos, ruée spectrale à l'attaque, dissipation à la « mort ». Réutilise la
 * machinerie (FK générique, palette tokenisée, rendu) ; translucidité bakée dans l'art.
 */
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, StoredPalette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { SPECTRE_SPECIES } from '../creatures';

export type SpectreBoneId = 'corps' | 'tete' | 'brasG' | 'brasD';
type SBone = FKBone & { z: number };
export interface SpectreProps {
  sl: number;
  hood: boolean; // capuche dressée (spectre/banshee) vs tête nue translucide (fantôme)
  face: 'crane' | 'cri' | 'morne'; // crâne / bouche hurlante / visage éteint
  stored: StoredPalette;
}

function buildSkeleton(): Record<SpectreBoneId, SBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 66 }, angle: 0, z: 3 }, // buste + volutes
    tete: { parent: 'corps', pivot: { x: 0, y: -20 }, angle: 0, z: 5 },
    brasG: { parent: 'corps', pivot: { x: -12, y: -12 }, angle: 0, z: 4 },
    brasD: { parent: 'corps', pivot: { x: 12, y: -12 }, angle: 0, z: 2 },
  };
}

// --- art (translucide, repère LOCAL) --------------------------------------
function body(): string {
  // buste qui descend en volutes (bord bas déchiqueté en 4 langues vaporeuses)
  return `<g opacity="0.82">` +
    `<path d="M-13 -16 Q0 -21 13 -16 L16 12 Q13 22 15 34 Q10 28 8 40 Q5 30 2.5 44 Q0 32 -2.5 44 Q-5 30 -8 40 Q-10 28 -15 34 Q-13 22 -16 12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M0 -18 Q3 6 1 40" stroke="@corpsH" stroke-width="1" opacity="0.4" fill="none"/>` +
    `<path d="M-9 -10 Q-11 8 -10 26 M9 -10 Q11 8 10 26" stroke="@corpsH" stroke-width="0.7" opacity="0.3" fill="none"/>` +
    `</g>`;
}
function head(p: SpectreProps): string {
  const eyes = `<ellipse cx="-3" cy="0" rx="1.5" ry="1.9" fill="#cfe8ff"/><ellipse cx="3" cy="0" rx="1.5" ry="1.9" fill="#cfe8ff"/>` +
    `<circle cx="-3" cy="0" r="0.7" fill="#6fb0e8"/><circle cx="3" cy="0" r="0.7" fill="#6fb0e8"/>`;
  if (p.hood) // capuche dressée : voile sombre + cavité noire + regard luisant
    return `<g opacity="0.9"><path d="M-9 6 Q-12 -13 0 -15 Q12 -13 9 6 Q4 9 0 9 Q-4 9 -9 6 Z" fill="@corpsO" stroke="@corpsO" stroke-width="0.5"/>` +
      `<ellipse cx="0" cy="0" rx="6" ry="7.5" fill="#0a0e14"/>${eyes}</g>`;
  if (p.face === 'crane') // crâne translucide
    return `<g opacity="0.85"><path d="M-7 4 Q-9 -11 0 -12 Q9 -11 7 4 Q5 8 2 8 L2 11 Q0 13 -2 11 L-2 8 Q-5 8 -7 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<ellipse cx="-3.2" cy="0" rx="2.4" ry="2.8" fill="#0a0e14"/><ellipse cx="3.2" cy="0" rx="2.4" ry="2.8" fill="#0a0e14"/>${eyes}` +
      `<path d="M-2 8 L2 8 M-1 7 L-1 11 M1 7 L1 11" stroke="@corpsO" stroke-width="0.5"/></g>`;
  // visage nu (fantôme) : crâne mou translucide, bouche hurlante (cri) ou éteinte (morne)
  const mouth = p.face === 'cri'
    ? `<ellipse cx="0" cy="6" rx="2.6" ry="3.8" fill="#0a0e14"/>`
    : `<path d="M-3 7 Q0 9 3 7" stroke="@corpsO" stroke-width="0.9" fill="none"/>`;
  return `<g opacity="0.82"><path d="M-8 2 Q-9 -12 0 -13 Q9 -12 8 2 Q7 9 0 11 Q-7 9 -8 2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>${eyes}${mouth}</g>`;
}
function arm(sx: number): string {
  // manche flottante qui se termine en volute (pas de main nette)
  return `<g opacity="0.78"><path d="M0 -2 Q${sx * 11} 2 ${sx * 13} 14 Q${sx * 14} 22 ${sx * 10} 26 Q${sx * 12} 20 ${sx * 8} 16 Q${sx * 9} 24 ${sx * 5} 24 Q${sx * 7} 16 ${sx * 4} 8 Q${sx * 3} 2 0 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/></g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const SPECTRE_REST: Record<string, number> = {};
/** Flottement : le corps ondule doucement, les bras dérivent en opposition. phase ∈ [0,1). */
export function spectreFloat(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { corps: s * 3, brasG: s * 7, brasD: -s * 7, tete: -s * 2 };
}
/** Ruée spectrale : le buste et les bras se projettent en avant. phase ∈ [0,1]. */
export function spectreLunge(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { corps: k * 16, brasG: k * 26, brasD: k * 26 };
}
/** Dissipation : le spectre s'affaisse et se replie. */
export const SPECTRE_DEATH: Record<string, number> = { corps: 18, brasG: 40, brasD: 40, tete: 24 };

export function resolveSpectreFromProps(
  p: SpectreProps,
  view: View = 'front',
  pose: Record<string, number> = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<SpectreBoneId, Matrix>;
  const tmap = buildTokenMap(p.stored, colors ?? {});
  const back = view === 'back';
  const art: Record<SpectreBoneId, string> = {
    corps: body(),
    tete: back ? `<g opacity="0.82"><path d="M-8 2 Q-9 -12 0 -13 Q9 -12 8 2 Q7 9 0 11 Q-7 9 -8 2 Z" fill="@corpsO"/></g>` : head(p),
    brasG: arm(-1),
    brasD: arm(1),
  };
  return (Object.keys(sk) as SpectreBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    }))
    .sort((a, b) => a.z - b.z);
}

export const SPECTRE_DEFAULT: SpectreProps = {
  sl: 0.95, hood: false, face: 'morne',
  stored: { corps: '#9fb8c8', corpsO: '#5a7282', corpsH: '#d8e8f0', cheveux: '#3a4a54', cheveuxO: '#222e34', cuir: '#7a90a0' },
};

export function resolveSpectre(species: string, view: View = 'front', pose: Record<string, number> = {}, colors?: Palette): ResolvedBone[] {
  return resolveSpectreFromProps(SPECTRE_SPECIES[species] ?? SPECTRE_DEFAULT, view, pose, colors);
}

export const spectralPlan: BodyPlan = {
  id: 'spectral',
  resolve: (sp, view, pose, opts) => resolveSpectre(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(SPECTRE_SPECIES),
  restPose: () => SPECTRE_REST,
  idlePose: spectreFloat, // flottement en continu
  walkPose: spectreFloat, // glisse = flottement
  attackPose: spectreLunge,
  deathPose: () => SPECTRE_DEATH,
  hasView: () => true,
};

export function spectreSvg(
  p: SpectreProps,
  view: View,
  opts: { dead?: boolean; floatPhase?: number; colors?: Palette } = {},
): string {
  const pose = opts.dead ? SPECTRE_DEATH : opts.floatPhase != null ? spectreFloat(opts.floatPhase) : {};
  return bonesToSvg(resolveSpectreFromProps(p, view, pose, opts.colors));
}
