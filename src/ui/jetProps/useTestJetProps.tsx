import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { canReroll } from '../../engine/fortune';
import { freeRerollOf } from '../../engine/activeFlags';
import { RollShell, type RollAction } from '../RollShell';
import { PortraitPicker } from '../PortraitPicker';
import { testBreakdown, testPending } from '../breakdown';
import { JournalLine } from '../NarratedLine';
import { ev } from '../../state/combatLog';
import { describeTest, amazingTestLabel } from '../../state/flowOutcomes';
import { rule } from '../../engine/policy';

/**
 * PARAMÉTRAGE de la coquille partagée `RollShell` pour le JET d'un Test de compétence de scène
 * (LDB 12). La situation « Test » est une cascade à une étape `jet:'test'`, rendue par `CascadeModal`
 * via ce hook (une seule fenêtre, comme l'attaque via `useAttackJetProps`). `pendingTest` reste le
 * porteur de données ; `resolveTest` (onConfirm) applique la branche réussite/échec ET ferme la cascade.
 *
 * Rendu calqué sur l'étape-jet de cascade : QUI tente le Test → PORTRAIT (jamais le nom en clair).
 *  - Plusieurs candidats : `PortraitPicker` (choix du lanceur par portrait, sélectionné mis en avant) ;
 *  - candidat unique / après le jet : le portrait vit DANS la ligne de jet (`RollRow.row.combatant`).
 * Le cadre de jet porte la COMPÉTENCE (`pt.skill`), pas l'intitulé de situation (`pt.label` = titre).
 */
export function useTestJetProps(): ComponentProps<typeof RollShell> | null {
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
  const cancel = useGame((s) => s.testCancel);
  if (!pt) return null;
  const rolled = pt.roll != null;
  const actor = party.find((c) => c.id === pt.actorId);
  const multi = !rolled && !!pt.candidates && pt.candidates.length > 1;
  const skillLabel = pt.skill ?? pt.label;
  const pendingLine = testPending(skillLabel, pt.skillValue, pt.target, pt.difficulty);
  // Option « Succès / échec stupéfiants » (LDB 12 l.151) : badge du double, pilotée par la règle.
  const amazing = rule('test-critiques-doubles') ? amazingTestLabel(pt) : null;
  // Barre : « Continuer » post-jet + « Annuler » pré-jet SI le test est annulable (action de COMBAT ;
  // referme la cascade sans dépenser l'Action). Les tests de dialogue/scène n'ont pas `cancellable`.
  const actions: RollAction[] = [{ key: 'confirm', label: 'Continuer', kind: 'primary', onClick: resolve, when: 'post' }];
  if (pt.cancellable) actions.unshift({ key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: cancel, when: 'pre' });

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
    /* Pré-jet : choix du LANCEUR par PORTRAIT (picker mutualisé). Avec plusieurs candidats, le picker
       porte les portraits (sélectionné mis en avant) et la ligne reste sans portrait (le picker montre
       déjà qui) ; avec un seul, le portrait vit dans la ligne. */
    setup: multi ? (
      <PortraitPicker
        choices={pt.candidates!.map((c) => ({
          c: party.find((h) => h.id === c.id)!,
          caption: <>cible {c.target}</>,
          title: `${c.name} — cible ${c.target}${c.psychDetail ? ` · ${c.psychDetail}` : ''}`,
        }))}
        selectedId={pt.actorId}
        onPick={setActor}
      />
    ) : undefined,
    rows: [
      {
        /* Pré-jet : ligne en attente (portrait sauf en mode picker — le picker montre déjà qui) ;
           post-jet : la ligne PORTE le portrait de l'acteur (comme la cascade). */
        row: rolled
          ? { combatant: actor, d: testBreakdown(skillLabel, pt.skillValue, { roll: pt.roll!, target: pt.target, sl: pt.sl, success: pt.success }, pt.difficulty) }
          : (multi ? { pending: pendingLine } : { combatant: actor, pending: pendingLine }),
        rolled,
        onRoll: roll,
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
        /* Détermination (LDB 17 l.62) : AVANT le jet, si un malus psy social pèse, la dépense l'ignore. */
        determination: !rolled && pt.psychMod ? { resolve: actor?.resolve ?? 0, onResolve: determination } : undefined,
      },
    ],
    outcome: rolled ? <JournalLine className="rm-journal" event={ev('info', describeTest(pt), pt.actorId)} combatants={party} /> : undefined,
    /* Option « Succès / échec stupéfiants » (LDB 12 l.151) : badge du double (libellé seul, aucune
       mécanique nouvelle), gaté par la règle. */
    postRollExtra: amazing ? (
      <div className="amazing-row">
        <span
          className={`chip amazing-chip ${amazing.success ? 'amazing-success' : 'amazing-failure'}`}
          title="Test réussi/raté sur un double (LDB 12 l.151)"
        >
          ✦ {amazing.text}
        </span>
      </div>
    ) : undefined,
    actions,
    /* Échap = Annuler, seulement si le test est annulable (pré-jet ; RollShell ne l'attache pas post-jet). */
    onCancel: pt.cancellable ? cancel : undefined,
  };
}
