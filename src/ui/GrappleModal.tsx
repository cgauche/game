import { useGame } from '../state/store';
import { effectiveChar } from '../engine/characteristics';
import { canReroll } from '../engine/fortune';
import { InfluenceRow } from './InfluenceRow';
import { ResilienceButton } from './ResilienceButton';
import { OptionChooser } from './OptionChooser';
import { RollPanel } from './RollPanel';
import { VsHeader } from './VsHeader';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { Modal } from './Modal';
import { testBreakdown } from './breakdown';

/**
 * Modale « Empoignade » (LDB 14 l.161) — calque de la modale « Au Contact » :
 * - phase 'roll' : Test opposé de FORCE sur le panneau unique — le jet du foe est FIGÉ (ligne adverse),
 *   seul le jet de l'acteur se (re)joue (« Lancer » → Chance/+1 DR/Pacte/Résilience → « Appliquer »).
 *   Un bouton « Briser l'Empoignade » (gratuit) apparaît AVANT le jet si l'acteur a un Avantage supérieur.
 * - phase 'options' : le VAINQUEUR tranche via `OptionChooser` — Dégâts (BF + DR, PA ignorés) / Empêtrer
 *   l'adversaire / Se libérer (retire son *Empêtré* + 1 par DR).
 */
export function GrappleModal() {
  const pd = useGame((s) => s.pendingGrapple);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.grappleRoll);
  const reroll = useGame((s) => s.grappleReroll);
  const bonusSL = useGame((s) => s.grappleBonusSL);
  const darkPact = useGame((s) => s.grappleDarkPact);
  const force = useGame((s) => s.grappleForceSuccess);
  const breakGrapple = useGame((s) => s.grappleBreak);
  const confirm = useGame((s) => s.grappleConfirm);
  const choose = useGame((s) => s.grappleChoose);
  const cancel = useGame((s) => s.grappleCancel);
  if (!pd || !battle) return null;
  const actor = battle.combatants.find((c) => c.id === pd.actorId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!actor || !foe) return null;
  const rerollable = !!pd.def && !pd.def.success && canReroll(!pd.def.success, !!pd.rerolled);
  const outcome =
    pd.result === 'success' ? `${actor.name} l'emporte — à toi de choisir.`
    : pd.result === 'failure' ? `${foe.name} l'emporte : +1 Avantage.`
    : 'Égalité parfaite : l’Empoignade se poursuit.';

  return (
    <Modal title="Empoignade" onClose={pd.phase === 'roll' && !pd.def ? cancel : undefined}>
      <VsHeader actor={actor} target={foe} label="lutte au corps à corps" verb="🤼" />

      {pd.phase === 'options' ? (
        <>
          <p className="rm-log">Tu l'emportes : choisis l'issue de l'Empoignade.</p>
          <OptionChooser
            layout="actions"
            options={[
              { key: 'damage', label: '💥 Dégâts', primary: true, onSelect: () => choose('damage'), title: 'BF + DR Dégâts, en IGNORANT tous les Points d’Armure (Localisation au lancer de Force).' },
              { key: 'entangle', label: '🪢 Empêtrer', onSelect: () => choose('entangle'), title: 'Conférer l’État Empêtré à l’adversaire.' },
              { key: 'free', label: '🤸 Se libérer', onSelect: () => choose('free'), title: 'Te défaire de ton État Empêtré, et en retirer 1 de plus par DR obtenu.' },
            ]}
          />
        </>
      ) : (
        <>
          {/* Test opposé : Force du foe (figée) vs Force de l'acteur. */}
          <RollPanel
            rows={[
              { combatant: foe, d: pd.atk ? testBreakdown('Force', effectiveChar(foe, 'F'), pd.atk) : undefined },
              { combatant: actor, d: pd.def ? testBreakdown('Force', effectiveChar(actor, 'F'), pd.def) : undefined },
            ]}
            winnerIndex={pd.result === 'success' ? 1 : pd.result === 'failure' ? 0 : null}
          />
          {pd.def && (
            <JournalLine
              className="rm-journal"
              event={ev(pd.result === 'success' ? 'dodge' : 'attack', outcome, actor.id, foe.id)}
              combatants={battle.combatants}
            />
          )}
          {!pd.def ? (
            <>
              <div className="rm-influence">
                {/* Résilience AVANT le jet (LDB 17 l.73) : Force forcée à l'emporter. */}
                <ResilienceButton resilience={actor.resilience ?? 0} show={(actor.resilience ?? 0) > 0} onForce={() => { roll(); force(); }} />
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={cancel}>
                  Renoncer
                </button>
                {pd.canBreak && (
                  <button className="btn" onClick={breakGrapple} title="Avantage supérieur : briser l’Empoignade gratuitement (par ton Mouvement).">
                    Briser l'Empoignade
                  </button>
                )}
                <button className="btn btn-primary" onClick={roll}>
                  Lancer (Force)
                </button>
              </div>
            </>
          ) : (
            <>
              <InfluenceRow
                actor={actor}
                rerollable={rerollable}
                onReroll={reroll}
                onBonusSL={bonusSL}
                darkPactable={actor.kind === 'hero' && !pd.def.success}
                onDarkPact={darkPact}
                onForce={force}
                forceShow={pd.result !== 'success'}
              />
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={confirm}>
                  Appliquer
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
