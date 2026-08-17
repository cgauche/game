/**
 * État AU SOL d'un combattant pour le RENDU (« au sol » ≠ debout) :
 *  - `corpse` : hors de combat OU Inconscient → effondré, ne bouge plus ;
 *  - `prone`  : À Terre (LDB 16 l.37) → couché mais CONSCIENT, à demi relevé sur un coude ;
 *  - `null`   : debout.
 * Pur — consommé par les deux moteurs de corps (rig bipède ET gabarits de créature), aussi bien par les
 * poses animées des hooks de rig (`RigToken` / `usePlanAnim`) que par le monde
 * VOLUMIQUE (`backends/webgl/sceneMeshes.ts`, billboard figé). L'ÉTAT, la POSE couchée et la BASCULE
 * du rig vivent donc ici — un corps au sol ne se redresse pas selon le renderer qui le dessine.
 */
import type { Combatant } from '../engine/types';
import { hasCondition, isOutOfAction } from '../engine/conditions';

export type GroundState = 'corpse' | 'prone' | null;

export function groundStateOf(c: Combatant): GroundState {
  if (!c.conditions) return null; // entité éparse (pas un combattant complet)
  if (c.wounds && isOutOfAction(c)) return 'corpse'; // mort / Inconscient / Mort Subite figurant
  if (hasCondition(c, 'a-terre')) return 'prone';
  return null;
}

/** Pose d'os (degrés par os) — la forme que `resolveRig` et `BodyPlan.resolve` consomment. */
export type Pose = Record<string, number>;

/** Pose de CADAVRE d'un rig bipède (sprawl doux : tête qui roule, bras/jambes écartés). Override DUR
 *  (indépendant des clips) pour qu'aucun événement (touché, idle) ne « relève » le mort. */
export const CORPSE_POSE: Pose = { tete: 18, torse: 6, epauleG: -30, epauleD: 24, avantBrasG: -14, avantBrasD: 10, cuisseG: 14, cuisseD: -10, tibiaG: 18, tibiaD: 6 };
/** Pose À TERRE d'un rig bipède (LDB 16 l.37) : couché mais CONSCIENT — à demi relevé sur le coude
 *  droit, tête redressée, jambes repliées. */
export const PRONE_POSE: Pose = { tete: -30, cou: -8, torse: -4, epauleD: -38, avantBrasD: -52, epauleG: 14, avantBrasG: 8, cuisseG: 12, cuisseD: -8, tibiaG: 20, tibiaD: 8 };

/** Pose couchée d'un rig BIPÈDE pour un état au sol (`null` = debout : la pose vient de l'anim). */
export function rigGroundPose(ground: GroundState): Pose | null {
  return ground === 'corpse' ? CORPSE_POSE : ground === 'prone' ? PRONE_POSE : null;
}

/** BASCULE (degrés) de tout le rig autour de ses pieds : cadavre ~82°, À Terre ~72° (à demi relevé). */
export function rigGroundTiltDeg(ground: GroundState): number {
  return ground === 'corpse' ? 82 : ground === 'prone' ? 72 : 0;
}

/** Pivot LOCAL de la bascule dans le repère 120×150 du corps : les pieds. */
export const RIG_GROUND_PIVOT = { x: 60, y: 150 } as const;

/** Interpolation de deux poses (union des os, absent = 0). */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = (a[k] ?? 0) * (1 - t) + (b[k] ?? 0) * t;
  return out;
}

/** Pose couchée d'un GABARIT non-bipède : sa pose de mort, ou — À Terre VIVANT — un affaissement à
 *  85 % vers elle (un peu moins effondré qu'un mort). `null` = debout. */
export function planGroundPose(plan: { restPose(): Pose; deathPose(): Pose }, ground: GroundState): Pose | null {
  if (!ground) return null;
  return ground === 'prone' ? lerpPose(plan.restPose(), plan.deathPose(), 0.85) : plan.deathPose();
}
