import { useEffect, useState } from 'react';
import { bus, EVT } from '../state/bus';
import { useGame } from '../state/store';
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
  const [flip, setFlip] = useState(false); // miroir horizontal = regarde vers la gauche
  const id = combatant.id;

  useEffect(() => {
    // Oriente le sprite vers une tuile cible : en iso, l'axe écran-x ∝ (x − y).
    const faceTowards = (a?: { x: number; y: number }, b?: { x: number; y: number }) => {
      if (!a || !b) return;
      const d = b.x - b.y - (a.x - a.y);
      if (d !== 0) setFlip(d < 0);
    };
    const offAttack = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      if (d.from === id) {
        const cs = useGame.getState().battle?.combatants;
        faceTowards(cs?.find((c) => c.id === d.from)?.pos, cs?.find((c) => c.id === d.to)?.pos);
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
      const p = d.path;
      if (p && p.length > 1) faceTowards(p[0], p[p.length - 1]); // regarde vers la destination
      play('walk');
      // arrêt de la marche à la fin du chemin (retour idle).
      const dur = Math.max(1, (p?.length ?? 1)) * STEP_MS;
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
    // Facing : miroir autour de l'axe vertical de la boîte (x=60) quand on regarde à gauche.
    <g transform={flip ? 'translate(120,0) scale(-1,1)' : undefined}>
      <RigSprite
        appearance={combatant.appearance ?? defaultAppearance(combatant)}
        equip={equipFromCombatant(combatant)}
        career={combatant.career}
        pose={pose}
      />
    </g>
  );
}
