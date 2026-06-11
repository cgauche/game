import { useEffect, useRef } from 'react';
import { bus, EVT } from '../state/bus';
import { useGame } from '../state/store';
import { useRigClip } from './rig/anim/useRigClip';
import { weaponRest, weaponAttackClip, weaponParryClip, hasShieldEquipped } from './rig/anim/weaponClips';
import { spellCastStyle, spellCastClip, isSupportiveCast } from './rig/anim/spellClips';
import { isShield, type EquipCtx } from './rig/parts/equipment';
import { project, type View } from './rig/facing';
import type { Dir8 } from '../state/dir8';
import type { Clip } from './rig/anim/clips';
import type { Pose } from './rig/poses';
import { walkMs } from './walkPath';

/**
 * Pilote l'ANIMATION d'un rig bipède (clips de repos/marche/attaque/parade/esquive/touché via
 * le bus, projeté en vue 8-dir selon la caméra) et renvoie les éléments à donner à resolveRig :
 * `pose` (clip courant), `holdPose` (prise d'arme toujours active), `view`+`mirror`. EXTRAIT de
 * RigToken pour être PARTAGÉ — RigToken (à pied) ET MountedToken (en selle) consomment le même
 * hook, sans dupliquer le câblage bus.
 */
export function useRigAnim({ id, equip, restClip, facing, pos }: {
  id: string;
  equip: EquipCtx;
  restClip?: Clip;
  facing?: Dir8;
  /** Tuile de l'acteur (CULLING viewport : les rigs hors-champ ne paient plus leur rAF). */
  pos?: { x: number; y: number };
}): { pose: Pose; holdPose: Pose; view: View; mirror: boolean } {
  const { pose, play, playClip, holdClip } = useRigClip(restClip, pos);
  const camRot = useGame((s) => s.camRot);
  const worldDir = useGame((s) => s.facing?.[id]) ?? facing;
  const mainWeapon = equip.weapons?.find((w) => !isShield(w)) ?? equip.weapons?.[0];
  const shield = hasShieldEquipped(equip.weapons, equip.shield);
  const holdPose = weaponRest(mainWeapon);
  const gest = useRef({ attack: weaponAttackClip(mainWeapon), parry: weaponParryClip(mainWeapon, shield) });
  gest.current = { attack: weaponAttackClip(mainWeapon), parry: weaponParryClip(mainWeapon, shield) };
  const walkTimer = useRef(0);
  const restRef = useRef(restClip);
  restRef.current = restClip;

  useEffect(() => {
    const offAttack = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      if (d.from === id) {
        const cs = useGame.getState().battle?.combatants;
        const onImpact = () => bus.emit(EVT.ANIM_IMPACT, { to: d.to, result: d.result });
        if (d.kind === 'spell') {
          const style = spellCastStyle(cs?.find((c) => c.id === d.from)?.kind, cs?.find((c) => c.id === d.to)?.kind, d.from === d.to);
          playClip(spellCastClip(style), { onImpact });
        } else {
          // Geste de l'arme EMPLOYÉE (portée par l'événement) — pas de l'arme principale :
          // la 2e frappe de dague gauche et le tentacule jouent LEUR clip (miroité à gauche).
          playClip(d.weapon ? weaponAttackClip(d.weapon) : gest.current.attack, { onImpact });
        }
      } else if (d.to === id && !d.result?.hit) {
        // Réaction défensive UNIQUEMENT face à une attaque offensive (pas un soin/bénédiction reçu).
        if (d.kind === 'spell') {
          const cs = useGame.getState().battle?.combatants;
          if (isSupportiveCast(cs?.find((c) => c.id === d.from)?.kind, cs?.find((c) => c.id === d.to)?.kind, d.from === d.to)) return;
        }
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
      play('walk');
      window.clearTimeout(walkTimer.current);
      const dur = Math.max(1, walkMs(p ?? [])); // = (cases-1)×STEP_MS : la marche s'arrête à l'arrivée réelle (plus d'off-by-one)
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

  const fv = worldDir ? project(worldDir, camRot) : { view: 'front' as View, mirror: false };
  return { pose, holdPose, view: fv.view, mirror: fv.mirror };
}
