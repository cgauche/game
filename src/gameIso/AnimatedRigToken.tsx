import { isOutOfAction } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { defaultAppearance } from './rig/appearance';
import { equipFromCombatant } from './rig/parts/equipment';
import type { EnemyRigProfile } from './rig/enemyProfile';
import { RigToken } from './RigToken';

/**
 * Adaptateur cosmétique d'un Combatant (héros : dérive du Combatant ; ennemi/PNJ :
 * `profile`) vers le token rig UNIQUE. Aucune logique de rendu ici — tout est dans
 * RigToken (partagé combat ↔ exploration).
 */
export function AnimatedRigToken({ combatant, profile }: { combatant: Combatant; profile?: EnemyRigProfile }) {
  return (
    <RigToken
      id={combatant.id}
      appearance={profile?.appearance ?? combatant.appearance ?? defaultAppearance(combatant)}
      equip={profile?.equip ?? equipFromCombatant(combatant)}
      career={profile?.career ?? combatant.career}
      overlays={profile?.overlays}
      outOfAction={!!combatant.wounds && !!combatant.conditions && isOutOfAction(combatant)}
    />
  );
}
