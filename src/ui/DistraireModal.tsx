import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { distraireAttackValue, distraireDefenseValue, distraireFoes } from '../state/combatFlow';
import { losClear } from '../state/lineOfSight';
import { smokeOf } from '../state/combatGeometry';
import { InfluenceRow } from './InfluenceRow';
import { ResilienceButton } from './ResilienceButton';
import { OptionChooser } from './OptionChooser';
import { RollPanel } from './RollPanel';
import { VsHeader } from './VsHeader';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { Modal } from './Modal';
import { testBreakdown } from './breakdown';
import { describeDistraire } from '../state/flowOutcomes';

/**
 * Modale de Distraire (LDB 10 l.364 / AA l.4395) : Mouvement, Test OPPOSÉ Athlétisme (mover) vs Calme
 * (foe). Calque EXACT de la modale « Au Contact » (phase 'roll') : le jet de Calme du foe est FIGÉ
 * (ligne adverse) ; seul le jet d'Athlétisme du mover se (re)joue (« Lancer » → Chance/+1 DR/Pacte/
 * Résilience → « Appliquer »). Issue BINAIRE (succès/égalité/échec). Le picker de cible
 * (`OptionChooser`) n'apparaît que si plusieurs adversaires sont éligibles (avant le jet).
 */
export function DistraireModal() {
  const pd = useGame((s) => s.pendingDistraire);
  const battle = useGame((s) => s.battle);
  const scene = useGame((s) => s.scene);
  const roll = useGame((s) => s.distraireRoll);
  const reroll = useGame((s) => s.distraireReroll);
  const bonusSL = useGame((s) => s.distraireBonusSL);
  const darkPact = useGame((s) => s.distraireDarkPact);
  const force = useGame((s) => s.distraireForceSuccess);
  const setFoe = useGame((s) => s.distraireSetFoe);
  const confirm = useGame((s) => s.distraireConfirm);
  const cancel = useGame((s) => s.distraireCancel);
  if (!pd || !battle) return null;
  const mover = battle.combatants.find((c) => c.id === pd.moverId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!mover || !foe) return null;
  // Adversaires éligibles au Distraire EN LIGNE DE VUE — MÊME source que l'ouverture (`distraireFoes`).
  const foes = mover.pos && scene ? distraireFoes(mover, battle, (c) => losClear(scene, mover.pos!, c.pos!, smokeOf(battle))) : [foe];
  const rerollable = !!pd.atk && !pd.atk.success && canReroll(!pd.atk.success, !!pd.rerolled);

  return (
    <Modal title="Distraire" onClose={!pd.atk ? cancel : undefined}>
      <VsHeader actor={mover} target={foe} label="détourner son attention (Athlétisme vs Calme)" />

      {/* Choix de la cible AVANT le jet (plusieurs adversaires en Ligne de vue) — OptionChooser partagé. */}
      {!pd.atk && foes.length > 1 && (
        <OptionChooser
          layout="seg"
          groupLabel="Cible"
          options={foes.map((f) => ({ key: f.id, label: f.name, selected: f.id === foe.id, onSelect: () => setFoe(f.id) }))}
        />
      )}

      {/* Test opposé : Athlétisme du mover vs Calme du foe (figé). */}
      <RollPanel
        rows={[
          { combatant: mover, d: pd.atk ? testBreakdown('Athlétisme', distraireAttackValue(mover), pd.atk, 'intermediaire') : undefined },
          { combatant: foe, d: testBreakdown('Calme', distraireDefenseValue(foe), pd.defRoll, 'intermediaire') },
        ]}
        winnerIndex={pd.result === 'success' ? 0 : pd.result === 'failure' ? 1 : null}
      />
      {pd.atk && (
        <JournalLine
          className="rm-journal"
          event={ev(pd.result === 'success' ? 'dodge' : 'attack', describeDistraire(pd, mover.name, foe.name), mover.id, foe.id)}
          combatants={battle.combatants}
        />
      )}
      {!pd.atk ? (
        <>
          <div className="rm-influence">
            {/* Résilience AVANT le jet (LDB 17 l.73) : Athlétisme forcé à l'emporter. */}
            <ResilienceButton resilience={mover.resilience ?? 0} show={(mover.resilience ?? 0) > 0} onForce={() => { roll(); force(); }} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={cancel}>
              Renoncer
            </button>
            <button className="btn btn-primary" onClick={roll}>
              Lancer
            </button>
          </div>
        </>
      ) : (
        <>
          <InfluenceRow
            actor={mover}
            rerollable={rerollable}
            onReroll={reroll}
            onBonusSL={bonusSL}
            darkPactable={mover.kind === 'hero' && !pd.atk.success}
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
    </Modal>
  );
}
