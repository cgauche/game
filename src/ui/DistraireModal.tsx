import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { distraireAttackValue, distraireDefenseValue, distraireFoes } from '../state/combatFlow';
import { losClear } from '../state/lineOfSight';
import { smokeOf } from '../state/combatGeometry';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { testBreakdown } from './breakdown';
import { describeDistraire } from '../state/flowOutcomes';

/**
 * Modale de Distraire (LDB 10 l.364 / AA l.4395) : Mouvement, Test OPPOSÉ Athlétisme (mover) vs Calme
 * (foe), sur `RollShell` (opposé = 2 rangées) :
 * - rangée [0] = TÉMOIN : le jet de Calme du foe, FIGÉ (`interactive:false`) ;
 * - rangée [1] = INTERACTIVE : le jet d'Athlétisme du mover, porteur de son cycle d'influence.
 * Issue BINAIRE (succès/égalité/échec). Le picker de cible (`OptionChooser`) n'apparaît qu'en
 * pré-jet si plusieurs adversaires sont éligibles (slot `setup`).
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
  const rolled = !!pd.atk;
  // Adversaires éligibles au Distraire EN LIGNE DE VUE — MÊME source que l'ouverture (`distraireFoes`).
  const foes = mover.pos && scene ? distraireFoes(mover, battle, (c) => losClear(scene, mover.pos!, c.pos!, smokeOf(battle))) : [foe];
  const rerollable = !!pd.atk && !pd.atk.success && canReroll(!pd.atk.success, !!pd.rerolled);
  const winnerIndex = pd.result === 'success' ? 1 : pd.result === 'failure' ? 0 : null;

  // Rangée TÉMOIN : Calme du foe, figé à l'ouverture (jamais relancé).
  const foeRow = {
    combatant: foe,
    row: { combatant: foe, d: testBreakdown('Calme', distraireDefenseValue(foe), pd.defRoll, 'intermediaire') },
    rolled,
    interactive: false as const,
  };
  // Rangée INTERACTIVE : Athlétisme du mover, porteur de son cycle d'influence.
  const actorRow = {
    combatant: mover,
    actor: mover,
    row: { combatant: mover, d: pd.atk ? testBreakdown('Athlétisme', distraireAttackValue(mover), pd.atk, 'intermediaire') : undefined },
    rolled,
    rollLabel: 'Lancer',
    onRoll: roll,
    rerollable,
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: mover.kind === 'hero' && !!pd.atk && !pd.atk.success,
    onDarkPact: darkPact,
    onForce: force,
    // Résilience AVANT le jet (LDB 17 l.73) : Athlétisme forcé à l'emporter.
    preRollForce: () => { roll(); force(); },
    forceShow: pd.result !== 'success',
  };

  const journal = pd.atk && (
    <JournalLine
      className="rm-journal"
      event={ev(pd.result === 'success' ? 'dodge' : 'attack', describeDistraire(pd, mover.name, foe.name), mover.id, foe.id)}
      combatants={battle.combatants}
    />
  );

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Renoncer', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="distraire"
      title="Distraire"
      extra={<VsHeader actor={mover} target={foe} label="détourner son attention (Athlétisme vs Calme)" />}
      // Choix de la cible AVANT le jet (plusieurs adversaires en Ligne de vue) — OptionChooser partagé.
      setup={foes.length > 1 && (
        <OptionChooser
          layout="seg"
          groupLabel="Cible"
          options={foes.map((f) => ({ key: f.id, label: f.name, selected: f.id === foe.id, onSelect: () => setFoe(f.id) }))}
        />
      )}
      rows={[foeRow, actorRow]}
      rolled={rolled}
      winnerIndex={winnerIndex}
      postRollExtra={journal}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
