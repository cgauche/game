import { useGame, activeCombatant } from '../state/store';
import { isOutOfAction } from '../engine/conditions';
import { campaign } from '../scenes/campaign';

/**
 * Panneau d'INFO de combat (droite) : round, ordre d'initiative, journal, résultat.
 * Les ACTIONS du combattant actif sont dans la barre du bas (cf. ActionBar) pour
 * ne pas surcharger ce panneau.
 */
export function BattlePanel() {
  const battle = useGame((s) => s.battle);
  const startScene = useGame((s) => s.startScene);
  if (!battle) return null;

  const active = activeCombatant(battle);

  return (
    <section className="battle-panel">
      <div className="bp-head">
        <h3>Combat — Round {battle.round}</h3>
        {!battle.over && active && (
          <div className={`active-banner ${active.kind}`}>
            {active.kind === 'hero' ? (
              <>
                🎮 Joueur actif : <strong>{active.name}</strong>
              </>
            ) : (
              <>⚔️ Tour de l'ennemi : {active.name}…</>
            )}
          </div>
        )}
      </div>

      <div className="initiative-track">
        {battle.order.map((id, i) => {
          const c = battle.combatants.find((x) => x.id === id)!;
          const out = isOutOfAction(c);
          const vital = c.dead
            ? '☠️'
            : c.conditions.some((x) => x.name === 'Inconscient')
              ? '😵'
              : c.wounds.current <= 0
                ? '🩸'
                : '';
          return (
            <span
              key={id}
              className={`init-chip ${c.kind} ${i === battle.turn ? 'current' : ''} ${out ? 'out' : ''}`}
              title={`Init ${c.initiative} · ${c.wounds.current}/${c.wounds.max} PB${c.criticalWounds ? ` · ${c.criticalWounds} critique(s)` : ''}`}
            >
              {c.name}
              {vital && ` ${vital}`}
            </span>
          );
        })}
      </div>

      <div className="battle-log">
        {battle.log.slice(-8).map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>

      {battle.over && (
        <div className={`battle-result ${battle.over}`}>
          <h2>{battle.over === 'victory' ? 'Victoire !' : 'Défaite…'}</h2>
          <button
            className="btn btn-primary"
            onClick={() => {
              // Revenir à l'exploration de la même scène (état/flags conservés).
              const cur = useGame.getState().scene;
              if (cur) {
                useGame.setState({ mode: 'exploration', battle: null });
              } else {
                startScene(campaign[0].scene);
              }
            }}
          >
            {battle.over === 'victory' ? 'Continuer' : 'Reprendre'}
          </button>
        </div>
      )}
    </section>
  );
}
