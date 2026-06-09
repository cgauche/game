import { useGame } from '../state/store';
import { conditionMeta, conditionEffect } from '../gameIso/effectIcons';

/**
 * Légende du combat (R9 du diagnostic lisibilité-combat) : clé de lecture des couleurs d'équipe et des
 * icônes d'État PRÉSENTES sur le champ (filtrée-au-présent — on n'explique que ce qui est en jeu), avec
 * l'effet canonique (etats.json) au survol. Aide un nouveau joueur à comprendre ce qu'il voit.
 */
export function LegendPanel() {
  const battle = useGame((s) => s.battle);
  if (!battle) return null;
  const names = Array.from(new Set(battle.combatants.flatMap((c) => c.conditions.map((x) => x.name))))
    .sort((a, b) => conditionMeta(b).severity - conditionMeta(a).severity);
  return (
    <div className="legend-panel">
      <div className="legend-title">Légende</div>
      <div className="legend-team">
        <span><i className="legend-dot hero" /> Allié</span>
        <span><i className="legend-dot enemy" /> Ennemi</span>
        <span><i className="legend-dot active" /> Tour actif</span>
      </div>
      {names.length > 0 && (
        <div className="legend-states">
          {names.map((n) => (
            <div key={n} className="legend-row" title={conditionEffect(n) || n}>
              <span className="legend-ico">{conditionMeta(n).icon}</span>
              <span className="legend-name">{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
