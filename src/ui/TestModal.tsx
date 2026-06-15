import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { OptionChooser } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeTest } from '../state/flowOutcomes';

/**
 * Test de compétence interactif (brique « tests », hors combat). On clique
 * « Lancer » pour faire le jet, puis on peut dépenser un point de Chance pour
 * relancer avant d'acquitter le résultat (LDB Destin). Test obligatoire (pas d'« Annuler »).
 */
export function TestModal() {
  const pt = useGame((s) => s.pendingTest);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.testRoll);
  const reroll = useGame((s) => s.testReroll);
  const bonusSL = useGame((s) => s.testBonusSL);
  const darkPact = useGame((s) => s.testDarkPact);
  const determination = useGame((s) => s.testDetermination);
  const forceSuccess = useGame((s) => s.testForceSuccess);
  const setActor = useGame((s) => s.testSetActor);
  const resolve = useGame((s) => s.resolveTest);
  if (!pt) return null;
  const rolled = pt.roll != null;
  const actor = party.find((c) => c.id === pt.actorId);

  return (
    <RollFlowShell
      variant="test"
      title={pt.label}
      subtitle={
        <>
          <strong>{pt.actorName}</strong> — cible {pt.target}
          {pt.psychMod ? (
            <span className="test-psych-mod" title="Trait psychologique envers l'interlocuteur">
              {' '}
              · {pt.psychDetail ?? `psychologie ${pt.psychMod}`}
            </span>
          ) : null}
        </>
      }
      rolled={rolled}
      onRoll={roll}
      /* Choix du LANCEUR (avant le jet) : le joueur désigne qui du groupe tente — au lieu d'un
         meilleur imposé. Chaque option montre sa cible effective (valeur + difficulté). */
      setup={!rolled && pt.candidates && pt.candidates.length > 1 ? (
        <OptionChooser
          layout="grid"
          groupLabel="Qui tente le Test ?"
          options={pt.candidates.map((c) => ({
            key: c.id,
            label: c.name,
            value: c.target,
            selected: c.id === pt.actorId,
            title: `${c.name} — cible ${c.target}${c.psychDetail ? ` · ${c.psychDetail}` : ''}`,
            onSelect: () => setActor(c.id),
          }))}
        />
      ) : undefined}
      /* Détermination (LDB 17 l.62) : AVANT le jet, si un malus psy social pèse sur le Test
         (Animosité/Préjugé envers l'interlocuteur), la dépense l'ignore. */
      determination={!rolled && pt.psychMod ? { resolve: actor?.resolve ?? 0, onResolve: determination } : undefined}
      breakdown={rolled ? testBreakdown(pt.label, pt.skillValue, { roll: pt.roll!, target: pt.target, sl: pt.sl, success: pt.success }, pt.difficulty) : undefined}
      pending={testPending(pt.label, pt.skillValue, pt.target, pt.difficulty)}
      outcome={rolled && <JournalLine className="rm-journal" event={ev('info', describeTest(pt), pt.actorId)} combatants={party} />}
      fortune={actor?.fortune ?? 0}
      freeReroll={freeRerollOf(actor)}
      rerollable={rolled && pt.roll != null && canReroll(pt.roll > pt.target, !!pt.rerolled)}
      onReroll={reroll}
      onBonusSL={bonusSL}
      darkPactable={rolled && pt.roll! > pt.target}
      onDarkPact={darkPact}
      resilience={actor?.resilience ?? 0}
      onForce={forceSuccess}
      forceShow={rolled && !pt.success}
      confirmLabel="Continuer"
      onConfirm={resolve}
    />
  );
}
