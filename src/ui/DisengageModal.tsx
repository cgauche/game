import { useGame } from '../state/store';
import { defenseValue, combatValue } from '../engine/combat';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';

/**
 * Modale de Désengagement (LDB 15-Dépl l.84-109). Phase « choice » = menu : Sacrifier
 * l'Avantage / Esquiver / Fuir / Renoncer. Si « Esquiver » → phase « esquive » : le jet
 * du mover est résolu (Test opposé), on peut dépenser une Chance, puis Appliquer.
 * « Fuir » résout l'attaque dans le dos immédiatement (pas de phase intermédiaire).
 */
export function DisengageModal() {
  const pd = useGame((s) => s.pendingDisengage);
  const battle = useGame((s) => s.battle);
  const sacrifice = useGame((s) => s.disengageConfirmA);
  const esquiver = useGame((s) => s.disengageRoll);
  const reroll = useGame((s) => s.disengageReroll);
  const bonusSL = useGame((s) => s.disengageBonusSL);
  const confirm = useGame((s) => s.disengageConfirm);
  const flee = useGame((s) => s.disengageFlee);
  const cancel = useGame((s) => s.disengageCancel);
  if (!pd || !battle) return null;
  const mover = battle.combatants.find((c) => c.id === pd.moverId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!mover || !foe) return null;
  const fortune = mover.fortune ?? 0;
  const success = pd.result === 'success';
  const rerollable = pd.phase === 'esquive' && canReroll(!pd.def?.success, !!pd.rerolled);

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>Se désengager</h3>
        <p className="rm-vs">
          <strong>{mover.name}</strong> veut quitter le corps à corps avec <strong>{foe.name}</strong>
        </p>

        {pd.phase === 'choice' ? (
          <>
            <p className="rm-log">
              Esquive {defenseValue(mover, 'esquive')} contre Corps à corps {combatValue(foe, 'melee')} de l'adversaire.
            </p>
            <div className="rm-loc">
              <div className="rm-loc-grid">
                {pd.canSacrifice && (
                  <button className="btn small" onClick={sacrifice} title="Tu as l'Avantage supérieur : pars librement, sans coût d'Action">
                    Sacrifier l'Avantage
                  </button>
                )}
                <button className="btn small btn-primary" onClick={esquiver} title="Test opposé d'Esquive — coûte ton Action">
                  🤸 Esquiver
                </button>
                <button className="btn small" onClick={flee} title="Tu tournes le dos : attaque gratuite contre toi (+20), puis tu cours">
                  🏃 Fuir (coup dans le dos)
                </button>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={cancel}>
                Renoncer
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
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
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
