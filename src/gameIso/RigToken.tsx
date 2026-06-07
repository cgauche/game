import { useEffect, useRef } from 'react';
import { bus, EVT } from '../state/bus';
import { useGame } from '../state/store';
import { RigSprite } from './rig/composeRig';
import { useRigClip } from './rig/anim/useRigClip';
import { ambientClip } from './rig/anim/ambientClips';
import { addPose } from './rig/poses';
import { weaponRest, weaponAttackClip, weaponParryClip, hasShieldEquipped } from './rig/anim/weaponClips';
import { spellCastStyle, spellCastClip, isSupportiveCast } from './rig/anim/spellClips';
import { isShield, type EquipCtx } from './rig/parts/equipment';
import { project, type View } from './rig/facing';
import type { Dir8 } from '../state/dir8';
import type { Appearance } from './rig/appearance';
import type { RigOverlay } from './rig/bones';

const STEP_MS = 160;

/** Pose de CADAVRE (sprawl doux : tête qui roule, bras/jambes écartés). Combinée à une
 *  bascule ~82° autour des pieds → corps allongé au sol. Override DUR (indépendant des
 *  clips) pour qu'aucun event (touché, idle) ne « relève » le mort. cf. game-roll-modal. */
const CORPSE_POSE = { tete: 18, torse: 6, epauleG: -30, epauleD: 24, avantBrasG: -14, avantBrasD: 10, cuisseG: 14, cuisseD: -10, tibiaG: 18, tibiaD: 6 } as const;

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
  facing,
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
  outOfAction?: boolean;
}) {
  const rest = ambientAnim ? ambientClip(ambientAnim) ?? undefined : undefined;
  const { pose, play, playClip, holdClip } = useRigClip(rest);
  // Orientation = projection de l'orientation MONDE (store, sinon authored) selon la rotation caméra.
  // Recalculée à chaque rendu ⇒ tourner la caméra ré-oriente sans aucun event.
  const camRot = useGame((s) => s.camRot);
  const worldDir = useGame((s) => s.facing?.[id]) ?? facing;
  const mainWeapon = equip.weapons?.find((w) => !isShield(w)) ?? equip.weapons?.[0];
  const shield = hasShieldEquipped(equip.weapons, equip.shield);
  // PRISE/ORIENTATION de l'arme, TOUJOURS appliquée (toutes vues/modes) : c'est elle qui tient
  // l'arme à l'endroit et engage la 2e main pour les armes à 2 mains. Clé sur la classe de
  // maniement (forme), calibrée pour rester lisible de face comme de profil. cf. weaponRest.
  const hold = weaponRest(mainWeapon);
  const gest = useRef({ attack: weaponAttackClip(mainWeapon), parry: weaponParryClip(mainWeapon, shield) });
  gest.current = { attack: weaponAttackClip(mainWeapon), parry: weaponParryClip(mainWeapon, shield) };
  const walkTimer = useRef(0);
  // Retour au repos (idle de combat OU clip d'ambiance pour une entité de scène).
  const restRef = useRef(rest);
  restRef.current = rest;

  useEffect(() => {
    const offAttack = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      if (d.from === id) {
        const cs = useGame.getState().battle?.combatants;
        const onImpact = () => bus.emit(EVT.ANIM_IMPACT, { to: d.to, result: d.result });
        if (d.kind === 'spell') {
          const style = spellCastStyle(cs?.find((c) => c.id === d.from)?.kind, cs?.find((c) => c.id === d.to)?.kind, d.from === d.to);
          playClip(spellCastClip(style), { onImpact });
        } else playClip(gest.current.attack, { onImpact });
      } else if (d.to === id && !d.result?.hit) {
        // Réaction défensive UNIQUEMENT face à une attaque offensive : une bénédiction / un
        // soin reçu d'un allié ne se pare ni ne s'esquive (il émet pourtant un ANIM_ATTACK).
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


  const fv = worldDir ? project(worldDir, camRot) : { view: 'front' as View, mirror: false };
  const body = (
    <g transform={fv.mirror ? 'translate(120,0) scale(-1,1)' : undefined}>
      <RigSprite appearance={appearance} equip={equip} career={career} overlays={overlays} pose={outOfAction ? CORPSE_POSE : addPose(hold, pose)} view={fv.view} />
    </g>
  );
  // Hors de combat = CADAVRE AU SOL : bascule de tout le rig ~82° autour des pieds
  // (pivot rig-local ≈ (60,150)) → le corps s'allonge sur le sol au lieu de rester debout.
  return outOfAction ? <g transform="rotate(82 60 150)">{body}</g> : body;
}
