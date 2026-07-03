import { useGame } from '../state/store';
import { defenseValue, combatValue } from '../engine/combat';
import { calmeValue } from '../engine/psychology';
import { groupAdvantage } from '../engine/advantagePool';
import { retreatAdvantageCost } from '../engine/combatFeatures/dispatch';
import { canReroll } from '../engine/fortune';
import { InfluenceRow } from './InfluenceRow';
import { ResilienceButton } from './ResilienceButton';
import { OptionChooser } from './OptionChooser';
import { RollPanel } from './RollPanel';
import { TableRollLine } from './RollLine';
import { VsHeader } from './VsHeader';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeDisengage, describeDisengageFlee } from '../state/flowOutcomes';
import { Modal } from './Modal';
import { testBreakdown } from './breakdown';

/**
 * Modale de Désengagement (LDB 15-Dépl l.84-109). Le pré-jet est un MENU d'« options de jet »
 * (`OptionChooser` PARTAGÉ) : Sacrifier l'Avantage / Esquiver / Fuir.
 * - « Esquiver » → phase 'esquive' : Test opposé sur le panneau unique + rangée d'influence + Appliquer.
 * - « Fuir » → phase 'fuir' : le coup dans le dos est SUBI et montré INLINE ici (plus de popin
 *   RevealModal séparée). S'il TOUCHE, le Test de Calme du fuyard est un jet INFLUENÇABLE (flux `flee`,
 *   calqué sur l'Esquive influençable : Lancer → Chance/Pacte/Résilience → Appliquer) qui DIFFÈRE la
 *   complétion de la fuite jusqu'au confirm. Coup manqué → « Continuer » (fuite déjà complétée).
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
  const fleeAck = useGame((s) => s.disengageFleeAck);
  const fleeRoll = useGame((s) => s.fleeRoll);
  const fleeReroll = useGame((s) => s.fleeReroll);
  const fleeBonusSL = useGame((s) => s.fleeBonusSL);
  const fleeDarkPact = useGame((s) => s.fleeDarkPact);
  const fleeForce = useGame((s) => s.fleeForceSuccess);
  const fleeConfirm = useGame((s) => s.fleeConfirm);
  const cancel = useGame((s) => s.disengageCancel);
  if (!pd || !battle) return null;
  const mover = battle.combatants.find((c) => c.id === pd.moverId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!mover || !foe) return null;
  const fortune = mover.fortune ?? 0;
  const rerollable = pd.phase === 'esquive' && canReroll(!pd.def?.success, !!pd.rerolled);
  const outcome = describeDisengage(pd);
  const f = pd.fuir;
  const calme = f?.calme;
  const calmeRerollable = !!calme && !calme.success && canReroll(true, !!pd.rerolled);
  const fleeOutcome = describeDisengageFlee(pd);
  // « Avantage de groupe » (AA l.4139) : l'option A devient « Retraite stratégique » à coût FIXE (2 Av,
  // 1 avec Impitoyable) débité de la réserve du camp ; sinon LDB « Sacrifier l'Avantage » (→ 0).
  const groupMode = groupAdvantage();
  const retreatCost = retreatAdvantageCost(mover);
  const sacrificeLabel = groupMode ? `↩ Retraite stratégique (${retreatCost} Av)` : "Sacrifier l'Avantage";
  const sacrificeTitle = groupMode
    ? `Dépense ${retreatCost} Avantage(s) de la réserve du camp pour rompre le combat, sans coût d'Action`
    : "Tu as l'Avantage supérieur : pars librement, sans coût d'Action";

  return (
    <Modal title="Se désengager" onClose={pd.phase === 'choice' ? cancel : undefined}>
      <VsHeader actor={mover} target={foe} label="quitter le corps à corps" verb="↩" />

      {pd.phase === 'choice' ? (
        <>
          <div className="rm-options">
            {/* Menu d'options PARTAGÉ (OptionChooser) — Esquiver montre sa valeur effective d'Esquive. */}
            <OptionChooser
              layout="grid"
              options={[
                { key: 'sacrifice', label: sacrificeLabel, hidden: !pd.canSacrifice, onSelect: sacrifice, title: sacrificeTitle },
                { key: 'esquive', label: '🤸 Esquiver', value: defenseValue(mover, 'esquive'), hidden: pd.canEsquive === false, primary: true, onSelect: esquiver, title: "Test opposé d'Esquive — coûte ton Action" },
                { key: 'fuir', label: '🏃 Fuir (coup dans le dos)', hidden: pd.canEsquive === false, onSelect: flee, title: 'Tu tournes le dos : attaque gratuite contre toi (+20), puis tu cours' },
              ]}
            />
            {pd.canEsquive === false && (
              <p className="rm-log">Action déjà dépensée : seul « {groupMode ? 'Retraite stratégique' : "Sacrifier l'Avantage"} » (sans coût d'Action) reste possible.</p>
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
      ) : pd.phase === 'fuir' ? (
        <>
          {/* Coup dans le dos SUBI, montré INLINE (jet subi sur table). */}
          <TableRollLine
            table={`Coup dans le dos — ${foe.name} (+20)`}
            roll={f?.attackerRoll}
            result={f?.hit ? `Touché · ${f.woundsLost} Blessure${f.woundsLost > 1 ? 's' : ''}` : 'Manqué'}
          />
          {f && f.woundsLost > 0 ? (
            <>
              {/* Test de Calme INFLUENÇABLE (LDB 15-Dépl l.105-107) — calqué sur l'Esquive influençable. */}
              <RollPanel
                rows={[{ combatant: mover, d: calme ? testBreakdown('Calme', calmeValue(mover), calme, 'intermediaire') : undefined }]}
              />
              {calme && (
                <JournalLine className="rm-journal" event={ev('fear', fleeOutcome, mover.id, foe.id)} combatants={battle.combatants} />
              )}
              {!calme ? (
                <>
                  <div className="rm-influence">
                    {/* Résilience AVANT le jet (LDB 17 l.73) : Calme forcé en réussite. */}
                    <ResilienceButton resilience={mover.resilience ?? 0} show={(mover.resilience ?? 0) > 0} onForce={() => { fleeRoll(); fleeForce(); }} />
                  </div>
                  <div className="modal-actions">
                    <button className="btn btn-primary" onClick={fleeRoll}>
                      Lancer le Test de Calme
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <InfluenceRow
                    actor={mover}
                    rerollable={calmeRerollable}
                    onReroll={fleeReroll}
                    onBonusSL={fleeBonusSL}
                    darkPactable={mover.kind === 'hero' && !calme.success}
                    onDarkPact={fleeDarkPact}
                    onForce={fleeForce}
                    forceShow={!calme.success}
                  />
                  <div className="modal-actions">
                    <button className="btn btn-primary" onClick={fleeConfirm}>
                      Appliquer
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {/* Coup manqué : pas de Test de Calme, fuite déjà complétée. */}
              <JournalLine className="rm-journal" event={ev('flee', fleeOutcome, mover.id, foe.id)} combatants={battle.combatants} />
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={fleeAck}>
                  Continuer
                </button>
              </div>
            </>
          )}
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
