import { pickBackend } from '../gameIso/pickBackend';
import { resolveRig, RigSprite } from '../gameIso/rig/composeRig';
import { defaultAppearance } from '../gameIso/rig/appearance';
import { equipFromCombatant } from '../gameIso/rig/parts/equipment';
import { enemyRigProfile, classifyEnemy } from '../gameIso/rig/enemyProfile';
import type { Combatant } from '../engine/types';

/**
 * Vignette-portrait d'un combattant : gros plan sur le VISAGE, VU DE FACE (statique, pose neutre),
 * bordure = couleur d'identité/équipe. Pas d'initiales (retours playtest).
 *
 * Humanoïde : on rend le rig en vue `front` et on cadre le viewBox sur l'os `tete` RÉSOLU
 * (donc centré sur LE visage de chaque race — Nain/Ogre/… quelle que soit sa taille/position).
 * Créature non-bipède : repli sur le rendu du gabarit + cadre haut-avant (portraitBox).
 */
export function RigPortrait({ combatant, size = 42, ring }: { combatant: Combatant; size?: number; ring?: string }) {
  const heroBiped = combatant.kind === 'hero' && classifyEnemy(combatant.name) === 'rig';
  const prof = heroBiped ? undefined : enemyRigProfile(combatant);
  const isRig = heroBiped || !!prof;

  let body: JSX.Element;
  let viewBox: string;
  if (isRig) {
    const appearance = prof?.appearance ?? combatant.appearance ?? defaultAppearance(combatant);
    const equip = prof?.equip ?? equipFromCombatant(combatant);
    const career = prof?.career ?? combatant.career;
    const overlays = prof?.overlays ?? [];
    const bones = resolveRig(appearance, equip, {}, career, 'front', overlays);
    const tete = bones.find((b) => b.id === 'tete');
    const m = tete?.matrix ?? [1, 0, 0, 1, 60, 54];
    const sy = tete?.scale[1] ?? 1;
    const cx = m[4];
    const cy = m[5] + 10 * sy; // le visage est dessiné SOUS l'origine de l'os tete (crâne) → on descend le cadre
    const S = 46 * Math.max(0.9, sy); // cadre proportionnel à la taille de la tête (Ogre > Nain)
    viewBox = `${(cx - S / 2).toFixed(1)} ${(cy - S / 2).toFixed(1)} ${S.toFixed(1)} ${S.toFixed(1)}`;
    body = <RigSprite appearance={appearance} equip={equip} career={career} view="front" overlays={overlays} />;
  } else {
    const r = pickBackend({ kind: 'combatant', combatant });
    body = <>{r.body}</>;
    viewBox = r.portraitBox;
  }

  return (
    <span className="rig-portrait" style={{ width: size, height: size, borderColor: ring }}>
      <svg viewBox={viewBox} width={size} height={size} preserveAspectRatio="xMidYMid slice">
        {body}
      </svg>
    </span>
  );
}
