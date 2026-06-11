import { useGame } from '../state/store';
import { defenseValue, combatValue } from '../engine/combat';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { InfluenceRow } from './InfluenceRow';
import { ResilienceButton } from './ResilienceButton';
import { RollPanel } from './RollPanel';
import { VsHeader } from './VsHeader';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { Modal } from './Modal';
import { testBreakdown } from './breakdown';

/**
 * Modale de Désengagement (LDB 15-Dépl l.84-109). Phase « choice » = menu : Sacrifier
 * l'Avantage / Esquiver / Fuir / Renoncer. Si « Esquiver » → phase « esquive » : Test opposé
 * rendu sur le panneau de jet unique (deux lignes + vainqueur accentué), Chance/Pacte/Résilience
 * en rangée « influencer le jet », puis Appliquer.
 * « Fuir » résout l'attaque dans le dos immédiatement (pas de phase intermédiaire).
 */
export function DisengageModal() {
  const pd = useGame((s) => s.pendingDisengage);
  const battle = useGame((s) => s.battle);
  const sacrifice = useGame((s) => s.disengageConfirmA);
  const esquiver = useGame((s) => s.disengageRoll);
  const reroll = useGame((s) => s.disengageReroll);
  const bonusSL = useGame((s) => s.disengageBonusSL);
  const darkPact = useGame((s) => s.disengageDarkPact);
  const forceSuccess = useGame((s) => s.disengageForceSuccess);
  const confirm = useGame((s) => s.disengageConfirm);
  const flee = useGame((s) => s.disengageFlee);
  const cancel = useGame((s) => s.disengageCancel);
  if (!pd || !battle) return null;
  const mover = battle.combatants.find((c) => c.id === pd.moverId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!mover || !foe) return null;
  const fortune = mover.fortune ?? 0;
  const rerollable = pd.phase === 'esquive' && canReroll(!pd.def?.success, !!pd.rerolled);
  const outcome =
    pd.result === 'success'
      ? 'Désengagé ! (+1 Avantage)'
      : pd.result === 'tie'
        ? 'Échange neutre — reste au contact'
        : "Échec — l'adversaire gagne l'Avantage";

  return (
    <Modal title="Se désengager" onClose={pd.phase === 'choice' ? cancel : undefined}>
      <VsHeader actor={mover} target={foe} label="quitter le corps à corps" verb="↩" />

      {pd.phase === 'choice' ? (
        <>
          <div className="rm-options">
            <div className="rm-loc-grid">
              {pd.canSacrifice && (
                <button className="btn small" onClick={sacrifice} title="Tu as l'Avantage supérieur : pars librement, sans coût d'Action">
                  Sacrifier l'Avantage
                </button>
              )}
              {pd.canEsquive !== false && (
                <>
                  <button className="btn small btn-primary" onClick={esquiver} title="Test opposé d'Esquive — coûte ton Action">
                    🤸 Esquiver ({defenseValue(mover, 'esquive')})
                  </button>
                  <button className="btn small" onClick={flee} title="Tu tournes le dos : attaque gratuite contre toi (+20), puis tu cours">
                    🏃 Fuir (coup dans le dos)
                  </button>
                </>
              )}
            </div>
            {pd.canEsquive === false && (
              <p className="rm-log">Action déjà dépensée : seul « Sacrifier l'Avantage » (sans coût d'Action) reste possible.</p>
            )}
          </div>
          <div className="rm-influence">
            {/* Résilience AVANT le jet (LDB 17 l.73) : Esquive forcée en réussite. */}
            {pd.canEsquive !== false && (
              <ResilienceButton resilience={mover.resilience ?? 0} show={(mover.resilience ?? 0) > 0} onForce={() => { esquiver(); forceSuccess(); }} />
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={cancel}>
              Renoncer
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Test opposé sur le panneau unique : Corps à corps du foe (figé) vs Esquive du mover. */}
          <RollPanel
            rows={[
              { combatant: foe, d: pd.atk ? testBreakdown('Corps à corps', combatValue(foe, 'melee'), pd.atk) : undefined },
              { combatant: mover, d: pd.def ? testBreakdown('Esquive', defenseValue(mover, 'esquive'), pd.def) : undefined },
            ]}
            winnerIndex={pd.result === 'success' ? 1 : pd.result === 'failure' ? 0 : null}
          />
          <JournalLine
            className="rm-journal"
            event={ev(pd.result === 'success' ? 'dodge' : 'attack', outcome, mover.id, foe.id)}
            combatants={battle.combatants}
          />
          <InfluenceRow
            actor={mover}
            rerollable={rerollable}
            onReroll={reroll}
            onBonusSL={bonusSL}
            darkPactable={mover.kind === 'hero' && !pd.def?.success}
            onDarkPact={darkPact}
            onForce={forceSuccess}
            forceShow={pd.result !== 'success'}
          />
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={confirm}>
              Appliquer
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
