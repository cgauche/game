import { useEffect, useRef, useState } from 'react';
import { bus, EVT } from '../state/bus';
import { useGame } from '../state/store';
import { isOutOfAction } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { RigSprite } from './rig/composeRig';
import { defaultAppearance } from './rig/appearance';
import { equipFromCombatant, isShield } from './rig/parts/equipment';
import { useRigClip } from './rig/anim/useRigClip';
import { addPose } from './rig/poses';
import { carryPose, weaponAttackClip, weaponParryClip, hasShieldEquipped } from './rig/anim/weaponClips';
import { facingView, screenDir, type View } from './rig/facing';
import type { EnemyRigProfile } from './rig/enemyProfile';

const STEP_MS = 160; // ~ durée d'un pas (moveAlong dans le store)

/** Token rig animé. Héros : dérive l'apparence du Combatant. Ennemi/PNJ humanoïde :
 *  fournir `profile` (apparence/carrière/équipement/mutations dérivés). Réagit au bus par id.
 *  Les gestes d'attaque/parade et la pose portée dépendent de l'arme équipée (brin G). */
export function AnimatedRigToken({ combatant, profile }: { combatant: Combatant; profile?: EnemyRigProfile }) {
  const { pose, play, playClip, hold } = useRigClip();
  const [facing, setFacing] = useState<{ view: View; mirror: boolean }>({ view: 'front', mirror: false });
  const id = combatant.id;

  // Équipement actif → arme principale (hors bouclier), pose portée et gestes par-arme.
  const equip = profile?.equip ?? equipFromCombatant(combatant);
  const mainWeapon = equip.weapons?.find((w) => !isShield(w)) ?? equip.weapons?.[0];
  const shield = hasShieldEquipped(equip.weapons, equip.shield);
  const carry = carryPose(mainWeapon);
  // Clips résolus, lus au moment de l'événement (évite les closures périmées sur changement d'arme).
  const gest = useRef({ attack: weaponAttackClip(mainWeapon), parry: weaponParryClip(mainWeapon, shield) });
  gest.current = { attack: weaponAttackClip(mainWeapon), parry: weaponParryClip(mainWeapon, shield) };

  useEffect(() => {
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
        const onImpact = () => bus.emit(EVT.ANIM_IMPACT, { to: d.to, result: d.result });
        if (d.kind === 'spell') play('cast', { onImpact }); // affiné par le brin H
        else playClip(gest.current.attack, { onImpact }); // geste propre à l'arme
      } else if (d.to === id && !d.result?.hit) {
        if (d.defense === 'parade') playClip(gest.current.parry); // parade selon l'arme/bouclier
        else play('dodge');
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
      const dur = Math.max(1, (p?.length ?? 1)) * STEP_MS;
      window.setTimeout(() => play('idle'), dur);
    });
    return () => {
      offAttack();
      offImpact();
      offMove();
    };
  }, [id, play, playClip]);

  // Chute tenue si le combattant est hors d'action.
  useEffect(() => {
    if (isOutOfAction(combatant)) hold('fall');
  }, [combatant, hold]);

  return (
    // Facing : vue (front/back/profile) + miroir autour de l'axe de la boîte (x=60) si à gauche.
    <g transform={facing.mirror ? 'translate(120,0) scale(-1,1)' : undefined}>
      <RigSprite
        appearance={profile?.appearance ?? combatant.appearance ?? defaultAppearance(combatant)}
        equip={equip}
        career={profile?.career ?? combatant.career}
        overlays={profile?.overlays}
        pose={addPose(carry, pose)}
        view={facing.view}
      />
    </g>
  );
}
