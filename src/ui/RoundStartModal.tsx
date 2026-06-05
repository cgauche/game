import { useGame } from '../state/store';
import { isOutOfAction } from '../engine/conditions';

/**
 * Modale d'ordre de Round (Chance, 3ᵉ usage — LDB « Destin et Résistance » ch.17 l.27 :
 * « Au début du Round, choisissez le moment où vous allez agir, sans tenir compte de l'Ordre
 * d'Initiative »). Au début de chaque nouveau Round, chaque héros disposant de Chance peut
 * dépenser un point pour se placer en tête de l'ordre. « Lancer le Round » reprend le combat.
 */
export function RoundStartModal() {
  const prs = useGame((s) => s.pendingRoundStart);
  const battle = useGame((s) => s.battle);
  const promote = useGame((s) => s.roundStartPromote);
  const confirm = useGame((s) => s.confirmRoundStart);
  if (!prs || !battle) return null;
  const living = battle.order
    .map((id) => battle.combatants.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c && !isOutOfAction(c));
  const firstId = living[0]?.id;

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>Ordre du Round {prs.round}</h3>
        <p className="rm-log">Un héros peut dépenser un point de Chance pour agir en premier (LDB Destin).</p>
        <ol className="rs-order">
          {living.map((c, i) => {
            const fortune = c.fortune ?? 0;
            const canPromote = c.kind === 'hero' && fortune > 0 && firstId !== c.id;
            return (
              <li key={c.id} className={`rs-row ${c.kind}`}>
                <span className="rs-pos">{i + 1}.</span> <span className="rs-name">{c.name}</span>
                {canPromote && (
                  <button
                    className="btn btn-sm"
                    onClick={() => promote(c.id)}
                    title="Dépense un point de Chance pour agir en premier ce Round"
                  >
                    {' '}
                    ⚡ Agir en 1er ({fortune})
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={confirm}>
            Lancer le Round
          </button>
        </div>
      </div>
    </div>
  );
}
