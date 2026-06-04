import { useGame, activeCombatant } from '../state/store';
import { campaign } from '../scenes/campaign';

export function BattlePanel() {
  const battle = useGame((s) => s.battle);
  const selectAction = useGame((s) => s.battleSelectAction);
  const endTurn = useGame((s) => s.battleEndTurn);
  const startScene = useGame((s) => s.startScene);
  if (!battle) return null;

  const active = activeCombatant(battle);
  const isHeroTurn = active?.kind === 'hero' && !battle.over;

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
          const out = c.wounds.current <= 0;
          return (
            <span
              key={id}
              className={`init-chip ${c.kind} ${i === battle.turn ? 'current' : ''} ${out ? 'out' : ''}`}
              title={`Init ${c.initiative}`}
            >
              {c.name}
            </span>
          );
        })}
      </div>

      {isHeroTurn && (
        <div className="bp-actions">
          <button
            className={`btn ${battle.action === 'move' ? 'btn-primary' : ''}`}
            disabled={battle.moved}
            onClick={() => selectAction(battle.action === 'move' ? null : 'move')}
          >
            Se déplacer {battle.moved && '✓'}
          </button>
          <button
            className={`btn ${battle.action === 'attack' ? 'btn-primary' : ''}`}
            disabled={battle.acted}
            onClick={() => selectAction(battle.action === 'attack' ? null : 'attack')}
          >
            Attaquer {battle.acted && '✓'}
          </button>
          <button className="btn" onClick={endTurn}>
            Fin du tour →
          </button>
        </div>
      )}
      {isHeroTurn && battle.action === 'move' && <p className="bp-hint">Cliquez une case bleue pour vous déplacer.</p>}
      {isHeroTurn && battle.action === 'attack' && <p className="bp-hint">Cliquez un ennemi adjacent pour l'attaquer.</p>}

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
