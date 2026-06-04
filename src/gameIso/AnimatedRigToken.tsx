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
import { facingView, screenDir, type View } from './rig/facing';
import type { EnemyRigProfile } from './rig/enemyProfile';

const CLIP_FOR_KIND: Record<string, ClipName> = { melee: 'melee', ranged: 'ranged', spell: 'cast' };
const STEP_MS = 160; // ~ durée d'un pas (moveAlong dans le store)

/** Token rig animé. Héros : dérive l'apparence du Combatant. Ennemi/PNJ humanoïde :
 *  fournir `profile` (apparence/carrière/équipement/mutations dérivés). Réagit au bus par id. */
export function AnimatedRigToken({ combatant, profile }: { combatant: Combatant; profile?: EnemyRigProfile }) {
  const { pose, play, hold } = useRigClip();
  const [facing, setFacing] = useState<{ view: View; mirror: boolean }>({ view: 'front', mirror: false });
  const id = combatant.id;

  useEffect(() => {
    // Oriente le sprite (vue + miroir) vers une tuile cible (direction écran iso).
    const face = (a?: { x: number; y: number }, b?: { x: number; y: number }) => {
      if (!a || !b) return;
      const { dx, dy } = screenDir(a, b);
      if (dx === 0 && dy === 0) return;
      setFacing(facingView(dx, dy));
    };
    const offAttack = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      if (d.from === id) {
        const cs = useGame.getState().battle?.combatants;
        face(cs?.find((c) => c.id === d.from)?.pos, cs?.find((c) => c.id === d.to)?.pos);
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
      if (p && p.length > 1) face(p[0], p[p.length - 1]); // regarde vers la destination
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
    // Facing : vue (front/back/profile) + miroir autour de l'axe de la boîte (x=60) si à gauche.
    <g transform={facing.mirror ? 'translate(120,0) scale(-1,1)' : undefined}>
      <RigSprite
        appearance={profile?.appearance ?? combatant.appearance ?? defaultAppearance(combatant)}
        equip={profile?.equip ?? equipFromCombatant(combatant)}
        career={profile?.career ?? combatant.career}
        overlays={profile?.overlays}
        pose={pose}
        view={facing.view}
      />
    </g>
  );
}
