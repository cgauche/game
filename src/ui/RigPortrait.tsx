import { pickBackend } from '../gameIso/pickBackend';
import type { Combatant } from '../engine/types';

/**
 * Vignette-portrait d'un combattant : gros plan sur le VISAGE vu de FACE (pose neutre), bordure =
 * couleur d'identité/équipe. Pas d'initiales (retours playtest).
 *
 * Le corps + le viewBox cadré sur le visage viennent de `pickBackend(…, 'top')` — SOURCE UNIQUE
 * partagée avec le pion-portrait de la carte (vue du dessus). Humanoïde = gros plan tête (cadré sur
 * l'os `tete` résolu de chaque race) ; créature non-bipède = haut-avant du gabarit.
 */
export function RigPortrait({ combatant, size = 42, ring }: { combatant: Combatant; size?: number; ring?: string }) {
  const r = pickBackend({ kind: 'combatant', combatant }, 'top');
  // R9 (daltonisme) : la FORME du contour encode l'équipe en plus de la couleur — héros = plein, ennemi = tirets.
  const borderStyle = combatant.kind === 'hero' ? 'solid' : 'dashed';
  return (
    <span className="rig-portrait" style={{ width: size, height: size, borderColor: ring, borderStyle }}>
      <svg viewBox={r.portraitBox} width={size} height={size} preserveAspectRatio="xMidYMid slice">
        {r.body}
      </svg>
    </span>
  );
}
