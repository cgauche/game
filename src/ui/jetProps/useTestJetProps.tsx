import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { canReroll } from '../../engine/fortune';
import { freeRerollOf } from '../../engine/activeFlags';
import { RollFlowShell } from '../RollFlowShell';
import { RollPanel } from '../RollPanel';
import { PortraitPicker } from '../PortraitPicker';
import { testBreakdown, testPending } from '../breakdown';
import { JournalLine } from '../NarratedLine';
import { ev } from '../../state/combatLog';
import { describeTest } from '../../state/flowOutcomes';

/**
 * PARAMÉTRAGE de la coquille partagée `RollFlowShell` pour le JET d'un Test de compétence de scène
 * (LDB 12). La situation « Test » est une cascade à une étape `jet:'test'`, rendue par `CascadeModal`
 * via ce hook (une seule fenêtre, comme l'attaque via `useAttackJetProps`). `pendingTest` reste le
 * porteur de données ; `resolveTest` (onConfirm) applique la branche réussite/échec ET ferme la cascade.
 *
 * Rendu calqué sur l'étape-jet de cascade : QUI tente le Test → PORTRAIT (jamais le nom en clair).
 *  - Plusieurs candidats : `PortraitPicker` (choix du lanceur par portrait, sélectionné mis en avant) ;
 *  - candidat unique / après le jet : le portrait vit DANS la ligne de jet (`RollPanel {combatant}`).
 * Le cadre de jet porte la COMPÉTENCE (`pt.skill`), pas l'intitulé de situation (`pt.label` = titre).
 */
export function useTestJetProps(): ComponentProps<typeof RollFlowShell> | null {
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
  const multi = !rolled && !!pt.candidates && pt.candidates.length > 1;
  const skillLabel = pt.skill ?? pt.label;
  const pendingLine = testPending(skillLabel, pt.skillValue, pt.target, pt.difficulty);

  return {
    variant: 'test',
    title: pt.label,
    /* Sous-titre = uniquement le malus psy social, si présent (la cible/valeur vit dans le cadre de jet). */
    subtitle: pt.psychMod ? (
      <span className="test-psych-mod" title="Trait psychologique envers l'interlocuteur">
        {pt.psychDetail ?? `psychologie ${pt.psychMod}`}
      </span>
    ) : undefined,
    rolled,
    onRoll: roll,
    /* Pré-jet : choix du LANCEUR par PORTRAIT (picker mutualisé) + ligne de jet en attente. Avec
       plusieurs candidats, le picker porte les portraits (sélectionné mis en avant) et la ligne reste
       sans portrait (le picker montre déjà qui) ; avec un seul, le portrait vit dans la ligne. */
    setup: !rolled ? (
      <>
        {multi && (
          <PortraitPicker
            choices={pt.candidates!.map((c) => ({
              c: party.find((h) => h.id === c.id)!,
              caption: <>cible {c.target}</>,
              title: `${c.name} — cible ${c.target}${c.psychDetail ? ` · ${c.psychDetail}` : ''}`,
            }))}
            selectedId={pt.actorId}
            onPick={setActor}
          />
        )}
        <RollPanel rows={[multi ? { pending: pendingLine } : { combatant: actor, pending: pendingLine }]} />
      </>
    ) : undefined,
    /* Détermination (LDB 17 l.62) : AVANT le jet, si un malus psy social pèse, la dépense l'ignore. */
    determination: !rolled && pt.psychMod ? { resolve: actor?.resolve ?? 0, onResolve: determination } : undefined,
    /* Post-jet : la ligne de jet PORTE le portrait de l'acteur (comme la cascade) — on voit qui a lancé. */
    rows: rolled ? [{ combatant: actor, d: testBreakdown(skillLabel, pt.skillValue, { roll: pt.roll!, target: pt.target, sl: pt.sl, success: pt.success }, pt.difficulty) }] : undefined,
    outcome: rolled ? <JournalLine className="rm-journal" event={ev('info', describeTest(pt), pt.actorId)} combatants={party} /> : undefined,
    fortune: actor?.fortune ?? 0,
    freeReroll: freeRerollOf(actor),
    rerollable: rolled && pt.roll != null && canReroll(pt.roll > pt.target, !!pt.rerolled),
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: rolled && pt.roll! > pt.target,
    onDarkPact: darkPact,
    resilience: actor?.resilience ?? 0,
    onForce: forceSuccess,
    forceShow: rolled && !pt.success,
    confirmLabel: 'Continuer',
    onConfirm: resolve,
  };
}
