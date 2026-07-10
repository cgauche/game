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
import { sortByZ } from '../composite';

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
// Yeux SANS pupille : orbes luisants + halo — le couple « iris+pupille » lisait peluche
// mignonne (verdict des juges aveugles, lot 4). Le regard vide et lumineux fait le spectre.
const glowEyes = (x1: number, x2: number | null, y = 0): string =>
  [x1, x2].filter((x): x is number => x !== null)
    .map((x) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="2.2" fill="#bfe6ff" opacity="0.3"/><ellipse cx="${x}" cy="${y}" rx="1.3" ry="1.7" fill="#eaf7ff"/>`)
    .join('');
function body(view: View): string {
  if (view === 'profile') {
    // drapé de PROFIL : bord d'attaque net vers l'avant (+x), traîne de volutes derrière (-x)
    return `<g>` +
      `<path opacity="0.85" d="M-9 -16 Q3 -22 13 -14 Q16 -2 14 12 L-13 12 Q-15 -4 -9 -16 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<path opacity="0.5" d="M-13 12 L14 12 Q13 22 11 32 Q7 26 4 38 Q1 28 -2 40 Q-5 28 -9 34 Q-12 24 -13 12 Z" fill="@corps"/>` +
      `<path opacity="0.25" d="M11 32 Q10 38 8 42 M4 38 Q3 43 2 46 M-2 40 Q-3 44 -3 47 M-9 34 Q-11 39 -12 42" stroke="@corps" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M9 -12 Q12 0 11 14" stroke="@corpsH" stroke-width="0.9" opacity="0.4" fill="none"/>` +
      `</g>`;
  }
  // buste (presque opaque) → jupe de volutes (semi) → langues vaporeuses (faibles) : le
  // FONDU vers la transparence vend l'immatériel — l'aplat uniforme lisait « drap opaque ».
  return `<g>` +
    `<path opacity="0.85" d="M-13 -16 Q0 -21 13 -16 L16 12 L-16 12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path opacity="0.5" d="M-16 12 L16 12 Q13 22 15 34 Q10 28 8 40 Q5 30 2.5 44 Q0 32 -2.5 44 Q-5 30 -8 40 Q-10 28 -15 34 Q-13 22 -16 12 Z" fill="@corps"/>` +
    `<path opacity="0.25" d="M15 34 Q14 39 12 43 M8 40 Q7 44 6 47 M2.5 44 Q2 47 1.5 50 M-2.5 44 Q-3 47 -3.5 50 M-8 40 Q-9 44 -10 47 M-15 34 Q-16 39 -14 43" stroke="@corps" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    `<path d="M0 -18 Q3 6 1 36" stroke="@corpsH" stroke-width="1" opacity="0.4" fill="none"/>` +
    `<path d="M-9 -10 Q-11 8 -10 26 M9 -10 Q11 8 10 26" stroke="@corpsH" stroke-width="0.7" opacity="0.3" fill="none"/>` +
    `</g>`;
}
function head(p: SpectreProps, view: View): string {
  const prof = view === 'profile';
  const eyes = prof ? glowEyes(3.5, null) : glowEyes(-3, 3);
  if (p.hood) { // capuche : voile sombre + cavité noire + regard luisant
    if (prof) // de profil : bec de capuche ouvert vers l'avant (+x), UN œil dans l'ombre
      return `<g opacity="0.92"><path d="M-8 7 Q-12 -12 -1 -15 Q9 -14 10 -4 Q10.5 2 8 7 Q0 10 -8 7 Z" fill="@corpsO" stroke="@corpsO" stroke-width="0.5"/>` +
        `<path d="M8 -6 Q10 0 7.5 6 Q3 7.5 1 6 Q0 -2 3 -7 Q6 -8 8 -6 Z" fill="#0a0e14"/>${eyes}</g>`;
    return `<g opacity="0.92"><path d="M-9 6 Q-12 -13 0 -15 Q12 -13 9 6 Q4 9 0 9 Q-4 9 -9 6 Z" fill="@corpsO" stroke="@corpsO" stroke-width="0.5"/>` +
      `<ellipse cx="0" cy="0" rx="6" ry="7.5" fill="#0a0e14"/>${eyes}</g>`;
  }
  if (p.face === 'crane') { // crâne translucide
    if (prof)
      return `<g opacity="0.85"><path d="M-7 2 Q-9 -11 1 -12 Q9 -10 9 -2 Q9 3 5 4 L6 8 Q3 11 1 8 L0 5 Q-4 6 -7 2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
        `<ellipse cx="4" cy="-1" rx="2.4" ry="2.8" fill="#0a0e14"/>${eyes}` +
        `<path d="M1 8 L6 8 M3 5 L3.6 10" stroke="@corpsO" stroke-width="0.5"/></g>`;
    return `<g opacity="0.85"><path d="M-7 4 Q-9 -11 0 -12 Q9 -11 7 4 Q5 8 2 8 L2 11 Q0 13 -2 11 L-2 8 Q-5 8 -7 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
      `<ellipse cx="-3.2" cy="0" rx="2.4" ry="2.8" fill="#0a0e14"/><ellipse cx="3.2" cy="0" rx="2.4" ry="2.8" fill="#0a0e14"/>${eyes}` +
      `<path d="M-2 8 L2 8 M-1 7 L-1 11 M1 7 L1 11" stroke="@corpsO" stroke-width="0.5"/></g>`;
  }
  // visage nu (fantôme) : crâne mou translucide, bouche hurlante (cri) ou éteinte (morne)
  if (prof) {
    const mouthP = p.face === 'cri'
      ? `<path d="M5 4 Q9 5.5 8.5 8.5 Q5.5 10 4 8 Z" fill="#0a0e14"/>` // gueule béante ouverte vers l'avant
      : `<path d="M4 7 Q6.5 8 8 6.6" stroke="@corpsO" stroke-width="0.9" fill="none"/>`;
    return `<g opacity="0.82"><path d="M-7 2 Q-9 -12 1 -13 Q9 -11 8.5 0 Q8 8 1 10 Q-6 9 -7 2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>${eyes}${mouthP}</g>`;
  }
  const mouth = p.face === 'cri'
    ? `<path d="M-2.8 3.5 Q0 2.5 2.8 3.5 Q3.4 8 0 10.5 Q-3.4 8 -2.8 3.5 Z" fill="#0a0e14"/>` // hurlement déchiré (plus le petit « o » surpris)
    : `<path d="M-3 7 Q0 9 3 7" stroke="@corpsO" stroke-width="0.9" fill="none"/>`;
  return `<g opacity="0.82"><path d="M-8 2 Q-9 -12 0 -13 Q9 -12 8 2 Q7 9 0 11 Q-7 9 -8 2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>${eyes}${mouth}</g>`;
}
function arm(sx: number): string {
  // manche flottante qui se termine en volute (pas de main nette) — pointe FONDUE (op. dégradée)
  return `<g opacity="0.7"><path d="M0 -2 Q${sx * 11} 2 ${sx * 13} 14 Q${sx * 14} 22 ${sx * 10} 26 Q${sx * 12} 20 ${sx * 8} 16 Q${sx * 9} 24 ${sx * 5} 24 Q${sx * 7} 16 ${sx * 4} 8 Q${sx * 3} 2 0 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path opacity="0.4" d="M${sx * 10} 26 Q${sx * 11} 30 ${sx * 9} 33 M${sx * 5} 24 Q${sx * 5.5} 28 ${sx * 4.5} 31" stroke="@corps" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`;
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
  const prof = view === 'profile';
  const art: Record<SpectreBoneId, string> = {
    corps: body(view),
    tete: back ? `<g opacity="0.82"><path d="M-8 2 Q-9 -12 0 -13 Q9 -12 8 2 Q7 9 0 11 Q-7 9 -8 2 Z" fill="@corpsO"/></g>` : head(p, view),
    // PROFIL : le bras proche (D) tendu en avant, le lointain (G) en traîne estompée derrière.
    brasG: prof ? `<g opacity="0.45">${arm(-1)}</g>` : arm(-1),
    brasD: prof ? `<g transform="rotate(-24)">${arm(1)}</g>` : arm(1),
  };
  return sortByZ((Object.keys(sk) as SpectreBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
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
