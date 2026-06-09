import { useGame } from '../state/store';
import { combatFeed } from '../gameIso/combatNarration';

/**
 * Bandeau haut : le dernier événement IMPORTANT du combat. Lit `battle.log` via `combatFeed`
 * (couche narration partagée : même icône + couleur de camp que le journal). Affichage seul.
 */
export function CombatBanner() {
  const battle = useGame((s) => s.battle);
  if (!battle || battle.over) return null;
  const shown = combatFeed(battle.log, battle.combatants, 1);
  if (!shown.length) return null;

  return (
    <div className="combat-feed">
      {shown.map((n, i) => (
        <div key={`${n.raw}-${i}`} className={`cb-ev ${i === 0 ? 'cb-now' : 'cb-old'}`}>
          <span className="cb-ic">{n.icon}</span>
          <span className="cb-tx">
            {n.segments.map((s, j) =>
              s.team ? (
                <b key={j} className={s.team === 'ally' ? 'nm-ally' : 'nm-foe'}>{s.text}</b>
              ) : (
                <span key={j}>{s.text}</span>
              ),
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
