import { useEffect } from 'react';
import { RigSprite } from './rig/composeRig';
import { useRigClip } from './rig/anim/useRigClip';
import { ambientClip } from './rig/anim/ambientClips';
import type { EnemyRigProfile } from './rig/enemyProfile';
import type { View } from './rig/facing';

/**
 * Token rig jouant une animation d'AMBIANCE en boucle (brin I), hors combat — pour
 * les entités de scène (ex. mutant qui dévore un cadavre). Pas d'abonnement au bus :
 * l'animation tourne en continu selon le clip choisi dans l'éditeur.
 */
export function AmbientRigToken({
  profile,
  anim,
  view = 'front',
  mirror = false,
}: {
  profile: EnemyRigProfile;
  anim: string;
  view?: View;
  mirror?: boolean;
}) {
  const { pose, holdClip, hold } = useRigClip();

  useEffect(() => {
    const clip = ambientClip(anim);
    if (clip) holdClip(clip);
    else hold('idle');
  }, [anim, holdClip, hold]);

  return (
    <g transform={mirror ? 'translate(120,0) scale(-1,1)' : undefined}>
      <RigSprite
        appearance={profile.appearance}
        equip={profile.equip}
        career={profile.career}
        overlays={profile.overlays}
        pose={pose}
        view={view}
      />
    </g>
  );
}
