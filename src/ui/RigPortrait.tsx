import { pickBackend } from '../gameIso/pickBackend';
import type { Combatant } from '../engine/types';

/**
 * Vignette-portrait d'un combattant : un rendu du RIG (buste/haut du corps) cadré dans un
 * petit carré arrondi, bordure = couleur d'identité/équipe. Réutilisé par le panneau Perso
 * (ActionBar) et l'ordre de bataille (BattlePanel). Pas d'initiales (cf. retours playtest).
 *
 * Le rig est dessiné dans un repère ~120×150 (tête en haut, pieds en bas) ; on cadre la
 * région supérieure (tête + torse) via le viewBox.
 */
export function RigPortrait({ combatant, size = 42, ring }: { combatant: Combatant; size?: number; ring?: string }) {
  const r = pickBackend({ kind: 'combatant', combatant });
  return (
    <span className="rig-portrait" style={{ width: size, height: size, borderColor: ring }}>
      <svg viewBox="12 -6 96 96" width={size} height={size} preserveAspectRatio="xMidYMid slice">
        {r.body}
      </svg>
    </span>
  );
}
