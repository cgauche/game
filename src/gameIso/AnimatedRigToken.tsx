import { useEffect } from 'react';
import { bus, EVT } from '../state/bus';
import { isOutOfAction } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { RigSprite } from './rig/composeRig';
import { defaultAppearance } from './rig/appearance';
import { equipFromCombatant } from './rig/parts/equipment';
import { useRigClip } from './rig/anim/useRigClip';
import type { ClipName } from './rig/anim/clips';

const CLIP_FOR_KIND: Record<string, ClipName> = { melee: 'melee', ranged: 'ranged', spell: 'cast' };
const STEP_MS = 160; // ~ durée d'un pas (moveAlong dans le store)

/** Token héros animé : rend RigSprite avec la pose courante, réagit aux événements du bus. */
export function AnimatedRigToken({ combatant }: { combatant: Combatant }) {
  const { pose, play, hold } = useRigClip();
  const id = combatant.id;

  useEffect(() => {
    const offAttack = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      if (d.from === id) {
        play(CLIP_FOR_KIND[d.kind] ?? 'melee', {
          onImpact: () => bus.emit(EVT.ANIM_IMPACT, { to: d.to, result: d.result }),
        });
      } else if (d.to === id && !d.result?.hit) {
        play(d.defense === 'parade' ? 'parry' : 'dodge'); // réaction immédiate sur un raté
      }
    });
    const offImpact = bus.on(EVT.ANIM_IMPACT, (d: any) => {
      if (d.to === id && d.result?.hit) play('hit'); // recul au bon timing
    });
    const offMove = bus.on(EVT.ANIM_MOVE, (d: any) => {
      if (d.id !== id) return;
      play('walk');
      // arrêt de la marche à la fin du chemin (retour idle).
      const dur = Math.max(1, (d.path?.length ?? 1)) * STEP_MS;
      window.setTimeout(() => play('idle'), dur);
    });
    return () => {
      offAttack();
      offImpact();
      offMove();
    };
  }, [id, play]);

  // Chute tenue si le combattant est hors d'action.
  useEffect(() => {
    if (isOutOfAction(combatant)) hold('fall');
  }, [combatant, hold]);

  return (
    <RigSprite
      appearance={combatant.appearance ?? defaultAppearance(combatant)}
      equip={equipFromCombatant(combatant)}
      career={combatant.career}
      pose={pose}
    />
  );
}
