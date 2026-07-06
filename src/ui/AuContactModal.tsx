import { useGame } from '../state/store';
import { combatValue } from '../engine/combat';
import { canReroll } from '../engine/fortune';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { Icon } from './Icon';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { testBreakdown } from './breakdown';

/**
 * Modale « Au Contact » (LDB 62 l.176, Option « Longueur d'arme »). Test OPPOSÉ de Corps à corps
 * sur `RollShell` (opposé = 2 rangées) :
 * - rangée [0] = TÉMOIN : le jet de Corps à corps du foe, FIGÉ (`interactive:false`) ;
 * - rangée [1] = INTERACTIVE : le jet de Corps à corps du mover (héros), porteur de son cycle
 *   d'influence (Lancer → Chance/+1 DR/Pacte/Résilience → Appliquer).
 * - phase 'choice' : le VAINQUEUR (héros) tranche via `OptionChooser` (« Au contact » / « Combat
 *   normal »). Un foe IA gagnant tranche en amont (pas de phase de choix montrée).
 */
export function AuContactModal() {
  const pd = useGame((s) => s.pendingAuContact);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.auContactRoll);
  const reroll = useGame((s) => s.auContactReroll);
  const bonusSL = useGame((s) => s.auContactBonusSL);
  const darkPact = useGame((s) => s.auContactDarkPact);
  const force = useGame((s) => s.auContactForceSuccess);
  const confirm = useGame((s) => s.auContactConfirm);
  const choose = useGame((s) => s.auContactChoose);
  const cancel = useGame((s) => s.auContactCancel);
  if (!pd || !battle) return null;
  const mover = battle.combatants.find((c) => c.id === pd.moverId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!mover || !foe) return null;
  const rolled = !!pd.def;
  const rerollable = !!pd.def && !pd.def.success && canReroll(!pd.def.success, !!pd.rerolled);
  const winnerIndex = pd.result === 'success' ? 1 : pd.result === 'failure' ? 0 : null;
  const outcome =
    pd.result === 'success' ? `${mover.name} l'emporte — à toi de choisir.`
    : pd.result === 'failure' ? `${foe.name} l'emporte et choisit.`
    : 'Égalité parfaite : le combat se poursuit normalement.';

  // Rangée TÉMOIN : Corps à corps du foe, figé (jamais relancé, aucun bouton).
  const foeRow = {
    combatant: foe,
    row: { combatant: foe, d: pd.atk ? testBreakdown('Corps à corps', combatValue(foe, 'melee'), pd.atk) : undefined },
    rolled,
    interactive: false as const,
  };
  // Rangée INTERACTIVE : Corps à corps du mover (héros), porteur de son cycle d'influence.
  const actorRow = {
    combatant: mover,
    actor: mover,
    row: { combatant: mover, d: pd.def ? testBreakdown('Corps à corps', combatValue(mover, 'melee'), pd.def) : undefined },
    rolled,
    rollLabel: 'Lancer',
    onRoll: roll,
    rerollable,
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: mover.kind === 'hero' && !!pd.def && !pd.def.success,
    onDarkPact: darkPact,
    onForce: force,
    // Résilience AVANT le jet (LDB 17 l.73) : Corps à corps forcé à l'emporter.
    preRollForce: () => { roll(); force(); },
    forceShow: pd.result !== 'success',
  };

  const journal = pd.def && (
    <JournalLine
      className="rm-journal"
      event={ev(pd.result === 'success' ? 'dodge' : 'attack', outcome, mover.id, foe.id)}
      combatants={battle.combatants}
    />
  );

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Renoncer', kind: 'ghost', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', kind: 'primary', onClick: confirm, when: 'post' },
  ];

  if (pd.phase === 'choice') {
    // Le VAINQUEUR (héros) tranche : « Au contact » / « Combat normal ». Panneau résolu conservé.
    return (
      <RollShell
        title="Au contact"
        extra={<VsHeader actor={mover} target={foe} label="entrer dans la longueur d'arme" verb={<Icon id="melee/close-in" size="sm" />} />}
        rows={[foeRow, actorRow]}
        rolled
        winnerIndex={winnerIndex}
        postRollExtra={
          <>
            {journal}
            <p className="rm-log">Tu l'emportes : choisis comment se poursuit le corps à corps.</p>
            <OptionChooser
              layout="actions"
              options={[
                { key: 'contact', label: <><Icon id="melee/close-in" size="sm" /> Au contact</>, primary: true, onSelect: () => choose('contact'), title: 'Entrer dans la longueur d’arme : toute arme plus longue que Courte est traitée comme une Arme improvisée (les deux camps)' },
                { key: 'normal', label: <><Icon id="action/attack" size="sm" /> Combat normal</>, onSelect: () => choose('normal'), title: 'Le combat se poursuit à distance d’arme normale' },
              ]}
            />
          </>
        }
        actions={[]}
      />
    );
  }

  return (
    <RollShell
      title="Au contact"
      extra={<VsHeader actor={mover} target={foe} label="entrer dans la longueur d'arme" verb={<Icon id="melee/close-in" size="sm" />} />}
      rows={[foeRow, actorRow]}
      rolled={rolled}
      winnerIndex={winnerIndex}
      postRollExtra={journal}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
