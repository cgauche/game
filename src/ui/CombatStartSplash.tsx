import { useGame } from '../state/store';
import { combatOpening } from '../engine/combat';

const SPLASH = {
  ambush:  { word: 'EMBUSCADE !', sub: 'Vous êtes pris par surprise', cls: 'is-ambush' },
  assault: { word: 'ASSAUT !',    sub: "Vous surprenez l'ennemi",     cls: 'is-assault' },
  combat:  { word: 'COMBAT !',    sub: '',                             cls: 'is-combat' },
} as const;

/** Beat plein-écran d'OUVERTURE du combat (symétrique de VictoryScreen). Décoratif : pointer-events
 *  none (n'empêche pas « Commencer le combat »), auto-fade CSS, joué UNE fois à l'entrée (round 1).
 *  Le mot s'adapte à la surprise réellement résolue (combatOpening). */
export function CombatStartSplash() {
  const mode = useGame((s) => s.mode);
  const battle = useGame((s) => s.battle);
  const pendingRoundStart = useGame((s) => s.pendingRoundStart);
  if (mode !== 'battle' || !battle || pendingRoundStart?.round !== 1) return null;
  const s = SPLASH[combatOpening(battle.combatants)];
  return (
    <div className={`combat-splash ${s.cls}`} aria-hidden="true">
      <div className="combat-splash-inner">
        <div className="combat-splash-word">{s.word}</div>
        {s.sub && <div className="combat-splash-sub">{s.sub}</div>}
      </div>
    </div>
  );
}
