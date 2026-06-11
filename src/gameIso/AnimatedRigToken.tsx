import { isOutOfAction } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { defaultAppearance } from './rig/appearance';
import { equipFromCombatant } from './rig/parts/equipment';
import { combatantAppearance, combatantOverlays } from './rig/parts/combatantVisuals';
import type { EnemyRigProfile } from './rig/enemyProfile';
import { RigToken } from './RigToken';

/**
 * Adaptateur cosmétique d'un Combatant (héros : dérive du Combatant ; ennemi/PNJ :
 * `profile`) vers le token rig UNIQUE. Les mutations acquises (Corruption) s'ajoutent
 * ici : calques + morpho dérivés de `combatant.mutations`. Aucune logique de rendu —
 * tout est dans RigToken (partagé combat ↔ exploration).
 */
export function AnimatedRigToken({ combatant, profile, pos }: { combatant: Combatant; profile?: EnemyRigProfile; pos?: { x: number; y: number } }) {
  return (
    <RigToken
      id={combatant.id}
      appearance={combatantAppearance(profile?.appearance ?? combatant.appearance ?? defaultAppearance(combatant), combatant)}
      equip={profile?.equip ?? equipFromCombatant(combatant)}
      career={profile?.career ?? combatant.career}
      overlays={[...(profile?.overlays ?? []), ...combatantOverlays(combatant)]}
      pos={pos}
      outOfAction={!!combatant.wounds && !!combatant.conditions && isOutOfAction(combatant)}
    />
  );
}
