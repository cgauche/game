import { useGame } from '../state/store';
import { defenseValue, combatValue } from '../engine/combat';
import { calmeValue } from '../engine/psychology';
import { groupAdvantage } from '../engine/advantagePool';
import { retreatAdvantageCost } from '../engine/combatFeatures/dispatch';
import { canReroll } from '../engine/fortune';
import { ResilienceButton } from './ResilienceButton';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { VsHeader } from './VsHeader';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeDisengage, describeDisengageFlee } from '../state/flowOutcomes';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { testBreakdown } from './breakdown';

/**
 * Modale de Désengagement (LDB 15 l.43-68). Trois phases, une seule coquille de jet PARTAGÉE :
 * - **'choice'** : PAS un jet — le MENU d'options (`OptionChooser`) Sacrifier l'Avantage / Esquiver /
 *   Fuir + Résilience pré-jet, rendu dans un `Modal` simple (RollShell ne fait pas les menus).
 * - **'esquive'** : `RollShell` opposé (2 rangées) — [0] Corps à corps du foe FIGÉ (témoin) vs
 *   [1] Esquive du mover INTERACTIVE (cycle d'influence), `winnerIndex`/`outcome`. Appliquer = `disengageConfirm`.
 * - **'fuir'** : `RollShell` — [0] le coup dans le dos SUBI en RANGÉE TÉMOIN `RollRow` (portrait +
 *   breakdown, HOMOGÈNE à l'Esquive : fini la ligne compacte `TableRollLine`) ; [1] le Test de Calme du
 *   fuyard INTERACTIVE si le coup a fait des Blessures, sinon « Continuer ». Appliquer = `fleeConfirm`.
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
  const header = <VsHeader actor={mover} target={foe} label="quitter le corps à corps" verb="↩" />;

  // ── Phase 'choice' : MENU d'options (pas un jet) — Modal simple + OptionChooser + Résilience pré-jet. ──
  if (pd.phase === 'choice') {
    // « Avantage de groupe » (AA 11 l.37) : l'option A devient « Retraite stratégique » à coût FIXE (2 Av,
    // 1 avec Impitoyable) débité de la réserve du camp ; sinon LDB « Sacrifier l'Avantage » (→ 0).
    const groupMode = groupAdvantage();
    const retreatCost = retreatAdvantageCost(mover);
    const sacrificeLabel = groupMode ? `↩ Retraite stratégique (${retreatCost} Av)` : "Sacrifier l'Avantage";
    const sacrificeTitle = groupMode
      ? `Dépense ${retreatCost} Avantage(s) de la réserve du camp pour rompre le combat, sans coût d'Action`
      : "Tu as l'Avantage supérieur : pars librement, sans coût d'Action";
    return (
      <Modal title="Se désengager" onClose={cancel}>
        {header}
        <div className="rm-options">
          {/* Menu d'options PARTAGÉ (OptionChooser) — Esquiver montre sa valeur effective d'Esquive. */}
          <OptionChooser
            layout="grid"
            options={[
              { key: 'sacrifice', label: sacrificeLabel, hidden: !pd.canSacrifice, onSelect: sacrifice, title: sacrificeTitle },
              { key: 'esquive', label: <><Icon id="melee/tumble" size="sm" /> Esquiver</>, value: defenseValue(mover, 'esquive'), hidden: pd.canEsquive === false, primary: true, onSelect: esquiver, title: "Test opposé d'Esquive — coûte ton Action" },
              { key: 'fuir', label: <><Icon id="melee/flee" size="sm" /> Fuir (coup dans le dos)</>, hidden: pd.canEsquive === false, onSelect: flee, title: 'Tu tournes le dos : attaque gratuite contre toi (+20), puis tu cours' },
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
      </Modal>
    );
  }

  // ── Phase 'fuir' : coup dans le dos SUBI (rangée TÉMOIN) + Test de Calme influençable OU « Continuer ». ──
  if (pd.phase === 'fuir') {
    const f = pd.fuir;
    const calme = f?.calme;
    const needCalme = !!f && f.woundsLost > 0; // coup qui touche → Test de Calme (LDB 15 l.66)
    const calmeRerollable = !!calme && !calme.success && canReroll(true, !!pd.rerolled);
    const fleeOutcome = describeDisengageFlee(pd);

    // Rangée [0] = TÉMOIN : le coup dans le dos SUBI, en breakdown complet (portrait + cible/dé/DR),
    // homogène à l'Esquive. `extra` = issue courte « Touché · N Blessure(s) » / « Manqué ».
    const backstabRow: RollRowData = {
      key: 'backstab',
      row: { combatant: foe, d: f?.detail ? { ...f.detail, label: 'Corps à corps (dans le dos)' } : undefined },
      rolled: true,
      interactive: false,
      extra: <p className="rm-log">{f?.hit ? `Touché · ${f.woundsLost} Blessure${f.woundsLost > 1 ? 's' : ''}` : 'Manqué'}</p>,
    };
    // Rangée [1] = INTERACTIVE : Test de Calme du fuyard, porteur de son cycle d'influence (Lancer →
    // Chance/+1 DR/Pacte/Résilience → Appliquer). Résilience AVANT le jet (LDB 17 l.73).
    const calmeRow: RollRowData = {
      key: 'calme',
      actor: mover,
      row: { combatant: mover, d: calme ? testBreakdown('Calme', calmeValue(mover), calme, 'intermediaire') : undefined },
      rolled: !!calme,
      rollLabel: <><Icon id="nav/dice" size="sm" /> Lancer le Test de Calme</>,
      onRoll: fleeRoll,
      rerollable: calmeRerollable,
      onReroll: fleeReroll,
      onBonusSL: fleeBonusSL,
      darkPactable: mover.kind === 'hero' && !!calme && !calme.success,
      onDarkPact: fleeDarkPact,
      onForce: fleeForce,
      preRollForce: () => { fleeRoll(); fleeForce(); },
      forceShow: !!calme && !calme.success,
    };

    const rows = needCalme ? [backstabRow, calmeRow] : [backstabRow];
    const rolled = needCalme ? !!calme : true;
    const actions: RollAction[] = needCalme
      ? [{ key: 'confirm', label: 'Appliquer', onClick: fleeConfirm, when: 'post' }]
      : [{ key: 'ack', label: 'Continuer', onClick: fleeAck, when: 'always' }];

    return (
      <RollShell
        flowKey="disengage"
        title="Se désengager"
        extra={header}
        rows={rows}
        rolled={rolled}
        postRollExtra={fleeOutcome
          ? <JournalLine className="rm-journal" event={ev(needCalme ? 'fear' : 'flee', fleeOutcome, mover.id, foe.id)} combatants={battle.combatants} />
          : undefined}
        actions={actions}
      />
    );
  }

  // ── Phase 'esquive' : Test OPPOSÉ (2 rangées) — le jet est déjà lancé en entrant ici. ──
  const rerollable = canReroll(!pd.def?.success, !!pd.rerolled);
  const outcome = describeDisengage(pd);
  const winnerIndex = pd.result === 'success' ? 1 : pd.result === 'failure' ? 0 : null;

  // Rangée [0] = TÉMOIN : Corps à corps du foe, figé (jamais relancé, aucun bouton).
  const foeRow: RollRowData = {
    key: 'foe',
    row: { combatant: foe, d: pd.atk ? testBreakdown('Corps à corps', combatValue(foe, 'melee'), pd.atk) : undefined },
    rolled: true,
    interactive: false,
  };
  // Rangée [1] = INTERACTIVE : Esquive du mover, porteuse de son cycle d'influence.
  const moverRow: RollRowData = {
    key: 'mover',
    actor: mover,
    row: { combatant: mover, d: pd.def ? testBreakdown('Esquive', defenseValue(mover, 'esquive'), pd.def) : undefined },
    rolled: true,
    rerollable,
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: mover.kind === 'hero' && !pd.def?.success,
    onDarkPact: darkPact,
    onForce: forceSuccess,
    forceShow: pd.result !== 'success',
  };

  const actions: RollAction[] = [
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="disengage"
      title="Se désengager"
      extra={header}
      rows={[foeRow, moverRow]}
      rolled
      winnerIndex={winnerIndex}
      postRollExtra={
        <JournalLine
          className="rm-journal"
          event={ev(pd.result === 'success' ? 'dodge' : 'attack', outcome, mover.id, foe.id)}
          combatants={battle.combatants}
        />
      }
      actions={actions}
    />
  );
}
