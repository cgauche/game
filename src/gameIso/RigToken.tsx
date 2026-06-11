import { RigSprite } from './rig/composeRig';
import { ambientClip } from './rig/anim/ambientClips';
import { addPose } from './rig/poses';
import { useRigAnim } from './useRigAnim';
import type { EquipCtx } from './rig/parts/equipment';
import type { Dir8 } from '../state/dir8';
import type { Appearance } from './rig/appearance';
import type { RigOverlay } from './rig/bones';

/** Pose de CADAVRE (sprawl doux : tête qui roule, bras/jambes écartés). Combinée à une
 *  bascule ~82° autour des pieds → corps allongé au sol. Override DUR (indépendant des
 *  clips) pour qu'aucun event (touché, idle) ne « relève » le mort. cf. game-roll-modal. */
const CORPSE_POSE = { tete: 18, torse: 6, epauleG: -30, epauleD: 24, avantBrasG: -14, avantBrasD: 10, cuisseG: 14, cuisseD: -10, tibiaG: 18, tibiaD: 6 } as const;
/** Pose À TERRE (LDB 16 l.37) : couché mais CONSCIENT — à demi relevé sur le coude droit,
 *  tête redressée, jambes repliées. Bascule moindre (~72°) que le cadavre. */
const PRONE_POSE = { tete: -30, cou: -8, torse: -4, epauleD: -38, avantBrasD: -52, epauleG: 14, avantBrasG: 8, cuisseG: 12, cuisseD: -8, tibiaG: 20, tibiaD: 8 } as const;

/**
 * TOKEN RIG UNIQUE — sert le combat ET l'exploration (aucune différence visuelle entre les
 * modes : même squelette, mêmes parts, même apparence). L'identité cosmétique vit ici ;
 * l'ANIMATION (clips bus + vue 8-dir) est déléguée à `useRigAnim` (partagé avec MountedToken).
 */
export function RigToken({
  id,
  appearance,
  equip,
  career,
  overlays,
  ambientAnim,
  facing,
  pos,
  outOfAction = false,
  ground = null,
}: {
  id: string;
  appearance: Appearance;
  equip: EquipCtx;
  career?: string;
  overlays?: RigOverlay[];
  ambientAnim?: string;
  /** Orientation MONDE authored (entité de scène) — fallback si le store n'a pas d'orientation vivante. */
  facing?: Dir8;
  /** Tuile de l'acteur (CULLING viewport : un rig hors-champ ne paie plus son rAF d'animation). */
  pos?: { x: number; y: number };
  outOfAction?: boolean;
  /** État AU SOL (groundPose.ts) : `corpse` = effondré, `prone` = À Terre conscient (coude levé). */
  ground?: 'corpse' | 'prone' | null;
}) {
  const restClip = ambientAnim ? ambientClip(ambientAnim) ?? undefined : undefined;
  const { pose, holdPose, view, mirror } = useRigAnim({ id, equip, restClip, facing, pos });
  const down = outOfAction || ground === 'corpse' ? 'corpse' : ground;
  const body = (
    <g transform={mirror ? 'translate(120,0) scale(-1,1)' : undefined}>
      <RigSprite appearance={appearance} equip={equip} career={career} overlays={overlays} pose={down === 'corpse' ? CORPSE_POSE : down === 'prone' ? PRONE_POSE : addPose(holdPose, pose)} view={view} mirror={mirror} />
    </g>
  );
  // AU SOL : bascule de tout le rig autour des pieds (pivot rig-local (60,150)) — cadavre
  // ~82°, À Terre ~72° (à demi relevé). La rotation est une TRANSITION CSS : la CHUTE est
  // animée (plus de téléportation au sol) et le RELEVÉ aussi, gratuitement. Pivot exprimé en
  // sandwich translate·rotate·translate (unités LOCALES — pas de transform-origin : le token
  // iso n'a pas de viewport propre, l'origine CSS pointerait la scène). Même structure dans
  // les deux états → interpolation fluide ; un élément monté déjà au sol ne transitionne pas.
  const deg = down === 'corpse' ? 82 : down === 'prone' ? 72 : 0;
  return (
    <g style={{ transform: `translate(60px, 150px) rotate(${deg}deg) translate(-60px, -150px)`, transition: 'transform 420ms cubic-bezier(.34,.8,.42,1)' }}>
      {body}
    </g>
  );
}
