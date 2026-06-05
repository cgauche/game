import { useEffect, useRef, useState } from 'react';
import { bus, EVT } from '../state/bus';
import { useGame } from '../state/store';
import { RigSprite } from './rig/composeRig';
import { useRigClip } from './rig/anim/useRigClip';
import { ambientClip } from './rig/anim/ambientClips';
import { addPose } from './rig/poses';
import { carryPose, weaponAttackClip, weaponParryClip, hasShieldEquipped } from './rig/anim/weaponClips';
import { spellCastStyle, spellCastClip } from './rig/anim/spellClips';
import { isShield, type EquipCtx } from './rig/parts/equipment';
import { facingView, screenDir, type View } from './rig/facing';
import type { Appearance } from './rig/appearance';
import type { RigOverlay } from './rig/bones';

const STEP_MS = 160;

/**
 * TOKEN RIG UNIQUE — sert le combat ET l'exploration (aucune différence visuelle
 * entre les modes : même squelette, mêmes parts, même apparence). Le rendu ne
 * dépend QUE de l'identité cosmétique ; l'animation est pilotée par :
 *   - les events du bus (attaque/déplacement/touché) quand ils ciblent cet `id`,
 *   - sinon le clip de REPOS = `ambientAnim` (dévore/hurle…) ou l'idle par défaut.
 * Les modes diffèrent par leur LOGIQUE (tour par tour vs libre), pas par le visuel.
 */
export function RigToken({
  id,
  appearance,
  equip,
  career,
  overlays,
  ambientAnim,
  outOfAction = false,
}: {
  id: string;
  appearance: Appearance;
  equip: EquipCtx;
  career?: string;
  overlays?: RigOverlay[];
  ambientAnim?: string;
  outOfAction?: boolean;
}) {
  const rest = ambientAnim ? ambientClip(ambientAnim) ?? undefined : undefined;
  const { pose, play, playClip, hold, holdClip } = useRigClip(rest);
  const [facing, setFacing] = useState<{ view: View; mirror: boolean }>({ view: 'front', mirror: false });

  const mainWeapon = equip.weapons?.find((w) => !isShield(w)) ?? equip.weapons?.[0];
  const shield = hasShieldEquipped(equip.weapons, equip.shield);
  const carry = carryPose(mainWeapon);
  const gest = useRef({ attack: weaponAttackClip(mainWeapon), parry: weaponParryClip(mainWeapon, shield) });
  gest.current = { attack: weaponAttackClip(mainWeapon), parry: weaponParryClip(mainWeapon, shield) };
  const walkTimer = useRef(0);
  // Retour au repos (idle de combat OU clip d'ambiance pour une entité de scène).
  const restRef = useRef(rest);
  restRef.current = rest;

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
        if (d.kind === 'spell') {
          const style = spellCastStyle(cs?.find((c) => c.id === d.from)?.kind, cs?.find((c) => c.id === d.to)?.kind, d.from === d.to);
          playClip(spellCastClip(style), { onImpact });
        } else playClip(gest.current.attack, { onImpact });
      } else if (d.to === id && !d.result?.hit) {
        if (d.defense === 'parade') playClip(gest.current.parry);
        else play('dodge');
      }
    });
    const offImpact = bus.on(EVT.ANIM_IMPACT, (d: any) => {
      if (d.to === id && d.result?.hit) play('hit');
    });
    const offMove = bus.on(EVT.ANIM_MOVE, (d: any) => {
      if (d.id !== id) return;
      const p = d.path;
      if (p && p.length > 1) face(p[0], p[p.length - 1]);
      play('walk');
      // La marche BOUCLE : sans retour explicite, les jambes pédalent indéfiniment.
      // On revient au repos quand le déplacement est censé fini (durée ~ nb de pas).
      window.clearTimeout(walkTimer.current);
      const dur = Math.max(1, (p?.length ?? 1)) * STEP_MS;
      walkTimer.current = window.setTimeout(() => {
        if (restRef.current) holdClip(restRef.current);
        else play('idle');
      }, dur);
    });
    return () => {
      offAttack();
      offImpact();
      offMove();
      window.clearTimeout(walkTimer.current);
    };
  }, [id, play, playClip, holdClip]);

  useEffect(() => {
    if (outOfAction) hold('fall');
  }, [outOfAction, hold]);

  return (
    <g transform={facing.mirror ? 'translate(120,0) scale(-1,1)' : undefined}>
      <RigSprite appearance={appearance} equip={equip} career={career} overlays={overlays} pose={addPose(carry, pose)} view={facing.view} />
    </g>
  );
}
