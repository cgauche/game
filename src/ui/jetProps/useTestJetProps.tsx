import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { FLOWS } from '../../state/rollFlowSpecs';
import { canReroll } from '../../engine/fortune';
import { freeRerollOf } from '../../engine/activeFlags';
import { RollShell, type RollAction } from '../RollShell';
import { PortraitPicker } from '../PortraitPicker';
import { testValueSplit, testBreakdown, testPending } from '../breakdown';
import { recapLineOfEvent } from '../../gameIso/combatNarration';
import { ev } from '../../state/combatLog';
import { describeTest, amazingTestLabel } from '../../state/flowOutcomes';
import { rule } from '../../engine/policy';
import { CodexRef } from '../compendium/CodexRef';

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
  const determination = useGame((s) => s.testDetermine);
  const forceSuccess = useGame((s) => s.testForceSuccess);
  const reverseVerb = useGame((s) => s.testReverse);
  const setActor = useGame((s) => s.testSetActor);
  const resolve = useGame((s) => s.resolveTest);
  const cancel = useGame((s) => s.testCancel);
  if (!pt) return null;
  const rolled = pt.roll != null;
  const actor = party.find((c) => c.id === pt.actorId);
  const multi = !rolled && !!pt.candidates && pt.candidates.length > 1;
  const skillLabel = pt.skill ?? pt.label;
  // Mod d'environnement (météo maritime — Précipitations, MDG 13 l.187-201) : ligne de mod dédiée,
  // au même titre que la Difficulté — `envMod` est DÉJÀ intégré à `pt.target` (PAS à `skillValue`)
  // par `openSkillTest` (seaWeatherTestMod, POINT UNIQUE), ici seulement pour l'AFFICHAGE.
  const envMods = pt.envMod ? [{ label: pt.envLabel ?? 'Météo', value: pt.envMod }] : undefined;
  // Soutien (LDB 12 l.187-200) ET composantes de la valeur de Test (États, séquelles, passifs, effets,
  // outil — #1178) : FONDUS dans `skillValue` par `openSkillTest`, la primitive partagée les rend à
  // leurs lignes de mod NOMMÉES et rebase l'affichage sur le Niveau de Compétence nu (LDB 09 l.17).
  // `fused` = le malus psy social, lui aussi fondu mais annoncé par le sous-titre (`psychDetail`).
  const { base, mods: supMods } = testValueSplit(actor, pt.skillValue, {
    support: pt.support, skill: pt.skillId, characteristic: pt.char, spec: pt.spec, sense: pt.sense, fused: pt.psychMod ?? 0,
  });
  const extraMods = [...supMods, ...(envMods ?? [])];
  const pendingLine = testPending(skillLabel, base, pt.target, pt.difficulty, extraMods, pt.easedBy, pt.clamped);
  // Capricieux (MSRC 15 l.149-159) : le d10 de l'interlocuteur ne touche NI `skillValue` NI `target` —
  // il décale le DR du Test résolu (`FLOWS.test`), donc il s'affiche comme une ligne de mod de DR.
  const capLabel = pt.capriciousRoll == null ? null
    : `Capricieux (d10 ${pt.capriciousRoll} → ${pt.capriciousDR ? `${pt.capriciousDR > 0 ? '+' : '−'}${Math.abs(pt.capriciousDR)} DR` : 'DR indiqué'})`;
  // Option « Succès / échec stupéfiants » (LDB 12 l.151) : badge du double, pilotée par la règle.
  const amazing = rule('test-critiques-doubles') ? amazingTestLabel(pt) : null;
  // Inversion de Test (LDB 23 l.209/218, LDB 10 — CHOIX du joueur, #558) : offerte dès qu'une voie
  // (Talent/jeton) est applicable (`reverseAvailable`, pure) ; `reversePreview` rend l'issue LISIBLE
  // avant le clic (le jeton, libre, peut dégrader un succès existant — jamais un automatisme).
  const reverseAvail = rolled && FLOWS.test.reverseAvailable(useGame.getState, useGame.setState);
  const reversePreview = reverseAvail ? FLOWS.test.reversePreview(useGame.getState, useGame.setState) : null;
  // Barre : « Continuer » post-jet + « Annuler » pré-jet SI le test est annulable (action de COMBAT ;
  // referme la cascade sans dépenser l'Action). Les tests de dialogue/scène n'ont pas `cancellable`.
  const actions: RollAction[] = [{ key: 'confirm', label: 'Continuer', onClick: resolve, when: 'post' }];
  if (pt.cancellable) actions.unshift({ key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' });

  return {
    flowKey: 'test',
    variant: 'test',
    title: pt.label,
    /* Sous-titre = modulateurs portés par l'INTERLOCUTEUR : le malus psy social (valeur, déjà dans la
       cible) et la table Capricieux (DR du Test résolu). La cible/valeur vit dans le cadre de jet. */
    subtitle: pt.psychMod || capLabel ? (
      <>
        {pt.psychMod ? (
          <span className="test-psych-mod" title="Trait psychologique envers l'interlocuteur">
            {pt.psychDetail ?? `psychologie ${pt.psychMod}`}
          </span>
        ) : null}
        {pt.psychMod && capLabel ? ' · ' : null}
        {capLabel ? (
          <span className="test-psych-mod" title="Capricieux (MSRC 15) : le d10 de l'interlocuteur décale le DR du Test">
            {capLabel}
          </span>
        ) : null}
      </>
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
          title: `${c.label} — cible ${c.target}${c.psychDetail ? ` · ${c.psychDetail}` : ''}`,
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
          ? { combatant: actor, d: testBreakdown(skillLabel, base, { roll: pt.roll!, target: pt.target, sl: pt.sl, success: pt.success, clamped: pt.clamped }, pt.difficulty, extraMods, pt.easedBy) }
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
        reverse: reverseAvail ? { onReverse: reverseVerb, preview: reversePreview } : undefined,
        /* Détermination (LDB 17 l.62) : AVANT le jet, si un malus psy social pèse, la dépense l'ignore. */
        determination: !rolled && pt.psychMod ? { resolve: actor?.resolve ?? 0, onResolve: determination } : undefined,
      },
    ],
    outcome: rolled ? [recapLineOfEvent(ev('info', describeTest(pt), pt.actorId), party)] : undefined,
    /* Option « Succès / échec stupéfiants » (LDB 12 l.151) : badge du double (libellé seul, aucune
       mécanique nouvelle), gaté par la règle. */
    postRollExtra: amazing ? (
      <div className="amazing-row">
        <CodexRef
          category="regles"
          id="double-critique-maladresse"
          label="Critique et Maladresse (double)"
          className={`chip amazing-chip ${amazing.success ? 'amazing-success' : 'amazing-failure'}`}
        >
          ✦ {amazing.text}
        </CodexRef>
      </div>
    ) : undefined,
    actions,
    /* Échap = Annuler, seulement si le test est annulable (pré-jet ; RollShell ne l'attache pas post-jet). */
    onCancel: pt.cancellable ? cancel : undefined,
  };
}
