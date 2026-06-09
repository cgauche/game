import { useGame } from '../state/store';
import { combatFeed } from '../gameIso/combatNarration';

/**
 * Bandeau haut « fil d'événements » (style B validé) : les derniers événements IMPORTANTS du
 * combat, le plus récent en tête, les précédents estompés. Lit `battle.log` via `combatFeed`
 * (couche narration partagée : même icône + couleur de camp que le journal et les pastilles).
 * Affichage seul — aucune règle, aucun état propre.
 */
export function CombatBanner() {
  const battle = useGame((s) => s.battle);
  if (!battle || battle.over) return null;
  const feed = combatFeed(battle.log, battle.combatants, 3);
  if (!feed.length) return null;
  const shown = [...feed].reverse(); // le plus récent en haut

  return (
    <div className="combat-banner">
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
