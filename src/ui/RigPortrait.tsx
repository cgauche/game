import { pickBackend } from '../gameIso/pickBackend';
import type { Combatant } from '../engine/types';

/**
 * Vignette-portrait d'un combattant : un rendu du RIG (buste/haut du corps) cadré dans un
 * petit carré arrondi, bordure = couleur d'identité/équipe. Réutilisé par le panneau Perso
 * (ActionBar) et l'ordre de bataille (BattlePanel). Pas d'initiales (cf. retours playtest).
 *
 * Le rig est dessiné dans un repère ~120×150 (tête centrée ~(60,46), pieds en (60,150)) ;
 * on ZOOME sur le VISAGE via le viewBox (gros plan tête, pas le corps en miniature).
 */
export function RigPortrait({ combatant, size = 42, ring }: { combatant: Combatant; size?: number; ring?: string }) {
  const r = pickBackend({ kind: 'combatant', combatant });
  return (
    <span className="rig-portrait" style={{ width: size, height: size, borderColor: ring }}>
      <svg viewBox={r.portraitBox} width={size} height={size} preserveAspectRatio="xMidYMid slice">
        {r.body}
      </svg>
    </span>
  );
}
