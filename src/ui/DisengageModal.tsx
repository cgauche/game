import { useGame } from '../state/store';

/**
 * Modale de Désengagement, option « Esquive » (LDB 15-Dépl l.89) : quand un héros Engagé
 * n'a pas l'Avantage supérieur, quitter le combat exige un Test OPPOSÉ — son Esquive contre
 * le Corps à corps de l'adversaire. On clique « Esquiver » (le jet du héros se fait alors),
 * on peut dépenser un point de Chance pour le relancer (le jet de l'adversaire reste figé),
 * puis « Appliquer ». L'option « Avantage » se résout sans modale (pas affichée ici).
 */
export function DisengageModal() {
  const pd = useGame((s) => s.pendingDisengage);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.disengageRoll);
  const reroll = useGame((s) => s.disengageReroll);
  const confirm = useGame((s) => s.disengageConfirm);
  const cancel = useGame((s) => s.disengageCancel);
  if (!pd || pd.mode !== 'esquive' || !battle) return null;
  const mover = battle.combatants.find((c) => c.id === pd.moverId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!mover || !foe) return null;
  const fortune = mover.fortune ?? 0;
  const success = pd.result === 'success';

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>Désengagement</h3>
        <p className="rm-vs">
          <strong>{mover.name}</strong> tente de se désengager de <strong>{foe.name}</strong>
        </p>

        {!pd.result ? (
          <>
            <p className="rm-log">Test opposé : votre Esquive contre le Corps à corps de l'adversaire (LDB 15-Dépl l.89).</p>
            <div className="modal-actions">
              <button className="btn" onClick={cancel}>
                Renoncer
              </button>
              <button className="btn btn-primary" onClick={roll}>
                🤸 Esquiver
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`test-result ${success ? 'ok' : 'fail'}`}>
              <span className="dice">{pd.def!.roll === 100 ? '00' : String(pd.def!.roll).padStart(2, '0')}</span>
              <span className="verdict">
                {pd.result === 'success'
                  ? 'Désengagé ! (+1 Avantage)'
                  : pd.result === 'tie'
                    ? 'Échange neutre — tu restes au contact'
                    : "Échec — l'adversaire gagne l'Avantage"}
              </span>
            </div>
            <div className="modal-actions">
              {fortune > 0 && (
                <button className="btn" onClick={reroll} title="Dépense un point de Chance pour relancer ton Esquive">
                  🍀 Chance ({fortune})
                </button>
              )}
              <button className="btn btn-primary" onClick={confirm}>
                Appliquer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
