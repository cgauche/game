import type { EnemyRigProfile } from './rig/enemyProfile';
import type { Dir8 } from '../state/dir8';
import { RigToken } from './RigToken';

/**
 * Adaptateur d'une entité de scène humanoïde (profil + clip d'ambiance) vers le token
 * rig UNIQUE. Conservé pour compatibilité ; toute la logique de rendu est dans RigToken.
 */
export function AmbientRigToken({ profile, anim, id = 'ambient', facing }: { profile: EnemyRigProfile; anim: string; id?: string; facing?: Dir8 }) {
  return (
    <RigToken
      id={id}
      appearance={profile.appearance}
      equip={profile.equip}
      career={profile.career}
      overlays={profile.overlays}
      ambientAnim={anim}
      facing={facing}
    />
  );
}
