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
}) {
  const restClip = ambientAnim ? ambientClip(ambientAnim) ?? undefined : undefined;
  const { pose, holdPose, view, mirror } = useRigAnim({ id, equip, restClip, facing, pos });
  const body = (
    <g transform={mirror ? 'translate(120,0) scale(-1,1)' : undefined}>
      <RigSprite appearance={appearance} equip={equip} career={career} overlays={overlays} pose={outOfAction ? CORPSE_POSE : addPose(holdPose, pose)} view={view} mirror={mirror} />
    </g>
  );
  // Hors de combat = CADAVRE AU SOL : bascule de tout le rig ~82° autour des pieds
  // (pivot rig-local ≈ (60,150)) → le corps s'allonge sur le sol au lieu de rester debout.
  return outOfAction ? <g transform="rotate(82 60 150)">{body}</g> : body;
}
