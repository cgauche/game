import { useGame } from '../state/store';
import { combatOpening } from '../engine/combat';

/** Le TON n'existe que là où le beat change de couleur : seule l'embuscade est peinte à part. */
const SPLASH: Record<'ambush' | 'assault' | 'combat', { word: string; sub: string; ton?: 'embuscade' }> = {
  ambush:  { word: 'EMBUSCADE !', sub: 'Vous êtes pris par surprise', ton: 'embuscade' },
  assault: { word: 'ASSAUT !',    sub: "Vous surprenez l'ennemi" },
  combat:  { word: 'COMBAT !',    sub: '' },
};

/** Beat plein-écran d'OUVERTURE du combat (symétrique de VictoryScreen). Décoratif : pointer-events
 *  none (n'empêche pas « Commencer le combat »), auto-fade CSS, joué UNE fois à l'entrée (round 1).
 *  Le mot s'adapte à la surprise réellement résolue (combatOpening) : l'animation ne se joue qu'au
 *  MONTAGE, donc le beat attend la clôture de la cascade d'ouverture (Surprise, LDB 13 l.52-81) —
 *  monté avant elle, il jouerait « COMBAT ! » sous la fenêtre et ne dirait jamais l'embuscade. */
export function CombatStartSplash() {
  const mode = useGame((s) => s.mode);
  const battle = useGame((s) => s.battle);
  const pendingRoundStart = useGame((s) => s.pendingRoundStart);
  const cascadeOuverte = useGame((s) => !!s.pendingCascade);
  if (mode !== 'battle' || !battle || pendingRoundStart?.round !== 1 || cascadeOuverte) return null;
  const s = SPLASH[combatOpening(battle.combatants)];
  return (
    <div className="combat-splash" data-ton={s.ton} aria-hidden="true">
      <div className="combat-splash-inner">
        <div className="combat-splash-word">{s.word}</div>
        {s.sub && <div className="combat-splash-sub">{s.sub}</div>}
      </div>
    </div>
  );
}
