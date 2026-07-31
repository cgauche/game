import { useGame } from '../state/store';
import { effectiveChar } from '../engine/characteristics';
import { canReroll } from '../engine/fortune';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { testBreakdown } from './breakdown';
import { frozenOpposedRow, opposedResponded } from './opposedFrozen';
import { Icon } from './Icon';

/**
 * Modale « Empoignade » (LDB 14 l.161) — Test OPPOSÉ de FORCE sur `RollShell` (opposé = 2 rangées) :
 * - rangée [0] = TÉMOIN : le jet de Force du foe, FIGÉ (`interactive:false`) ;
 * - rangée [1] = INTERACTIVE : le jet de Force de l'acteur, porteur de son cycle d'influence.
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
  const rolled = !!pd.def;
  const rerollable = !!pd.def && !pd.def.success && canReroll(!pd.def.success, !!pd.rerolled);
  const winnerIndex = pd.result === 'success' ? 1 : pd.result === 'failure' ? 0 : null;
  const outcome =
    pd.result === 'success' ? `${actor.label} l'emporte — à toi de choisir.`
    : pd.result === 'failure' ? `${foe.label} l'emporte : +1 Avantage.`
    : 'Égalité parfaite : l’Empoignade se poursuit.';

  // Rangée TÉMOIN : Force du foe, figée à l'ouverture (jamais relancée) — MASQUÉE tant que l'acteur
  // n'a pas répondu (#990 : `pd.def` est SA réponse ; le calendrier est celui de tous les jets figés).
  const foeRow = frozenOpposedRow(useGame.getState(), {
    ownerId: pd.foeId,
    responded: opposedResponded(useGame.getState(), [{ id: pd.actorId, interactive: true, result: pd.def }]),
    row: { combatant: foe, d: pd.atk ? testBreakdown('Force', effectiveChar(foe, 'force'), pd.atk) : undefined },
  });
  // Rangée INTERACTIVE : Force de l'acteur, porteur de son cycle d'influence.
  const actorRow = {
    combatant: actor,
    actor,
    row: { combatant: actor, d: pd.def ? testBreakdown('Force', effectiveChar(actor, 'force'), pd.def) : undefined },
    rolled,
    rollLabel: 'Lancer (Force)',
    onRoll: roll,
    rerollable,
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: actor.kind === 'hero' && !!pd.def && !pd.def.success,
    onDarkPact: darkPact,
    onForce: force,
    // Résilience AVANT le jet (LDB 17 l.68) : Force forcée à l'emporter.
    preRollForce: () => { roll(); force(); },
    forceShow: pd.result !== 'success',
  };

  const journal = pd.def && (
    <JournalLine
      className="rm-journal"
      event={ev(pd.result === 'success' ? 'dodge' : 'attack', outcome, actor.id, foe.id)}
      combatants={battle.combatants}
    />
  );

  if (pd.phase === 'options') {
    // Le VAINQUEUR tranche l'issue de l'Empoignade. Panneau résolu conservé.
    return (
      <RollShell
        flowKey="grapple"
        title="Empoignade"
        extra={<VsHeader actor={actor} target={foe} label="lutte au corps à corps" verb={<Icon id="melee/grapple" size="sm" />} />}
        rows={[foeRow, actorRow]}
        rolled
        winnerIndex={winnerIndex}
        postRollExtra={
          <>
            {journal}
            <p className="rm-log">Tu l'emportes : choisis l'issue de l'Empoignade.</p>
            <OptionChooser
              layout="actions"
              options={[
                { key: 'damage', label: <><Icon id="journal/damage" size="sm" /> Dégâts</>, primary: true, onSelect: () => choose('damage'), title: 'BF + DR Dégâts, en IGNORANT tous les Points d’Armure (Localisation au lancer de Force).' },
                { key: 'entangle', label: <><Icon id="condition/entangled" size="sm" /> Empêtrer</>, onSelect: () => choose('entangle'), title: 'Conférer l’État Empêtré à l’adversaire.' },
                { key: 'free', label: <><Icon id="melee/tumble" size="sm" /> Se libérer</>, onSelect: () => choose('free'), title: 'Te défaire de ton État Empêtré, et en retirer 1 de plus par DR obtenu.' },
              ]}
            />
          </>
        }
        actions={[]}
      />
    );
  }

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Renoncer', onClick: cancel, when: 'pre' },
    // Avantage supérieur : briser l'Empoignade gratuitement (par son Mouvement) — pré-jet uniquement.
    ...(pd.canBreak
      ? [{ key: 'break', label: "Briser l'Empoignade", onClick: breakGrapple, title: 'Avantage supérieur : briser l’Empoignade gratuitement (par ton Mouvement).', when: 'pre' } as RollAction]
      : []),
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="grapple"
      title="Empoignade"
      extra={<VsHeader actor={actor} target={foe} label="lutte au corps à corps" verb={<Icon id="melee/grapple" size="sm" />} />}
      rows={[foeRow, actorRow]}
      rolled={rolled}
      winnerIndex={winnerIndex}
      postRollExtra={journal}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
