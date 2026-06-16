import type { ReactNode } from 'react';
import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { useAttackJetProps } from './jetProps/useAttackJetProps';
import { useTestJetProps } from './jetProps/useTestJetProps';
import { useExtendedTestJetProps } from './jetProps/useExtendedTestJetProps';
import { DisengageModal } from './DisengageModal';
import { ForceDoorModal } from './ForceDoorModal';
import { CastModal } from './CastModal';
import { RollPanel, type RollRowData } from './RollPanel';
import { OptionChooser } from './OptionChooser';
import { DrBar } from './DrBar';
import { CIBLE_TYPES } from '../engine/psychology';
import { CriticalBody } from './RevealModal';
import { JournalLine } from './NarratedLine';
import { ev, type CombatEventKind } from '../state/combatLog';
import { cascadeAppliers, stepInteraction } from '../state/cascade';
import { FLOWS } from '../state/rollFlows';
import type { CascadeStep, CascadeRoll } from '../state/pendings';
import type { Combatant } from '../engine/types';

/**
 * CASCADE de jets SÉQUENTIELS (nuit / voyage) — c'est LA coquille de jet partagée `RollFlowShell`,
 * paramétrée comme `DefenseModal` : plusieurs LIGNES de jet avec portraits (`RollPanel rows`). Chaque
 * étape validée reste FIGÉE avec son jet ET sa CONSÉQUENCE (note de ligne) — on ne perd pas les
 * conséquences en enchaînant. L'étape COURANTE est active (pending → résultat) avec son cycle Chance/
 * +1 DR/Pacte/Résilience ; « Continuer » enchaîne. « Tout lancer » résout d'un coup le reste puis
 * affiche le BILAN (curseur EN FIN) — la modale reste ouverte, « Terminer » ferme. Cascade SUBIE →
 * pas d'« Annuler » / pas d'Échap.
 */
export function CascadeModal() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const p = useGame((s) => s.pendingCascade);
  const pendingCast = useGame((s) => s.pendingCast); // étape-jet `cast` : hôte la situation d'incantation (réactif, pas de hook conditionnel)
  const roll = useGame((s) => s.cascadeRoll);
  const reroll = useGame((s) => s.cascadeReroll);
  const bonusSL = useGame((s) => s.cascadeBonusSL);
  const darkPact = useGame((s) => s.cascadeDarkPact);
  const force = useGame((s) => s.cascadeForceSuccess);
  const setForcedRoll = useGame((s) => s.cascadeSetForcedRoll); // Résilience : dé CHOISI (Peur étendue, LDB 17 l.73)
  const determine = useGame((s) => s.cascadeDetermine); // Détermination (immunité Psychologie de rencontre)
  const next = useGame((s) => s.cascadeNext);
  const choose = useGame((s) => s.cascadeChoose); // étape « choix » : pose l'option retenue
  const resolveAll = useGame((s) => s.cascadeResolveAll); // « Tout lancer » → bilan
  const finish = useGame((s) => s.cascadeFinish); // « Terminer » du bilan
  const attackProps = useAttackJetProps(); // étape-jet d'attaque : rendue dans CETTE coquille (une fenêtre)
  const testProps = useTestJetProps(); // étape-jet de Test de scène : même coquille, une seule fenêtre
  const extendedProps = useExtendedTestJetProps(); // étape-jet de Test étendu (Rounds cumulés)

  if (!p) return null;
  const pool: Combatant[] = battle?.combatants ?? party;
  const actorOf = (s: CascadeStep) => (s.actorId ? pool.find((c) => c.id === s.actorId) : undefined);

  // Libellé de rangée = la COMPÉTENCE lancée (« Résistance », « Calme »…), comme Défense affiche
  // « Attaque »/« Parade » — pas le texte de l'étape (le but vit dans le sous-titre). L'icône
  // distingue deux « Résistance » dans la pile figée (Exposition 🥶 vs Marche forcée 🥾 vs Contagion 🤒).
  const rowLabel = (s: CascadeStep) => `${s.icon ?? ''} ${s.rollLabel ?? 'Jet'}`.trim();
  const breakdown = (s: CascadeStep, r: CascadeRoll) => {
    const b = s.base ?? s.target ?? 0;
    return { label: rowLabel(s), base: b, modifier: (s.target ?? b) - b, target: s.target ?? b, roll: r.roll, success: r.success, sl: r.sl };
  };
  const pendingOf = (s: CascadeStep) => {
    const b = s.base ?? s.target ?? 0;
    return { label: rowLabel(s), base: b, mods: s.base != null && s.target != null && s.target !== s.base ? [{ label: 'difficulté', value: s.target - s.base }] : [] };
  };
  // Conséquence (issue style journal) d'une étape — rendue sous le jet, elle PERSISTE quand on
  // enchaîne (« on ne perd pas les conséquences »). Une étape VALIDÉE porte sa conséquence RÉELLE
  // chiffrée dans `outcome` (lignes de l'applier : « récupère 8 PB », « contracte : Vérole… ») → on
  // l'affiche telle quelle. Tant qu'elle n'est pas validée (étape courante post-jet), repli sur
  // l'issue GÉNÉRIQUE du registre (la valeur dépend du jet FINAL, figé à la validation).
  const noteFor = (s: CascadeStep): ReactNode => {
    const a = actorOf(s);
    // Jet : lignes de l'applier (`outcome`) ou repli générique du registre. Affichage/choix : contenu
    // pré-posé dans `outcome` (la conséquence à montrer telle quelle). Sinon : rien à noter.
    const lines = s.outcome?.length
      ? s.outcome
      : (s.result ? [cascadeAppliers[s.kind]?.describe?.(s.result.success, a?.name ?? '') ?? (s.result.success ? `${a?.name ?? ''} réussit.` : `${a?.name ?? ''} échoue.`)] : undefined);
    if (!lines) return undefined;
    // Ton : succès→soin (vert), échec→état (rouge), affichage sans jet→neutre (info).
    const k: CombatEventKind = s.result ? (s.result.success ? 'heal' : 'condition') : 'info';
    return <>{lines.map((l, i) => <JournalLine key={i} event={ev(k, l, s.actorId)} combatants={pool} />)}</>;
  };
  const rowOf = (s: CascadeStep): RollRowData | null => {
    const a = actorOf(s);
    if (s.result) return { combatant: a, d: breakdown(s, s.result), note: noteFor(s) }; // jet validé
    if (s.outcome?.length) return { combatant: a, note: noteFor(s) }; // affichage/choix validé : note seule
    return null;
  };

  // BILAN « Tout lancer » : curseur EN FIN — toutes les étapes résolues, chaque conséquence visible.
  // Un seul bouton « Terminer » (ferme + enchaîne la suite). Pas d'influence (jets déjà subis).
  if (p.cursor >= p.participants.length) {
    const allRows = p.participants.map(rowOf).filter((r): r is RollRowData => r !== null);
    return (
      <RollFlowShell
        title={`${p.icon ?? '🎲'} ${p.title}`}
        subtitle={<>Bilan · {p.participants.length} jet{p.participants.length > 1 ? 's' : ''}</>}
        rolled
        onRoll={() => {}}
        rows={allRows}
        fortune={0}
        rerollable={false}
        onReroll={() => {}}
        confirmLabel="Terminer"
        onConfirm={() => finish()}
      />
    );
  }

  const cur = p.participants[p.cursor];
  if (!cur) return null;
  // ÉTAPE-JET de combat : le jet (attaque) est rendu via son hook de props dans la MÊME coquille
  // restée montée → le jet et ses conséquences vivent dans UNE seule fenêtre, jusqu'à « Terminer ».
  if (cur.jet === 'attack') return attackProps ? <RollFlowShell {...attackProps} /> : null;
  // ÉTAPE-JET de Test de scène : rendue via son hook dans la MÊME coquille (`resolveTest` ferme la cascade).
  if (cur.jet === 'test') return testProps ? <RollFlowShell {...testProps} /> : null;
  // ÉTAPE-JET de Test ÉTENDU : Rounds cumulés via `extendedTestNext` (ferme la cascade à la réussite).
  if (cur.jet === 'extended') return extendedProps ? <RollFlowShell {...extendedProps} /> : null;
  // ÉTAPE-JET de Désengagement : menu/Esquive/Fuite (3 phases) rendu par `DisengageModal` (bespoke,
  // non-RollFlowShell : choix d'abord) ; `pendingDisengage` porte les données, ses résolveurs ferment la cascade.
  if (cur.jet === 'disengage') return <DisengageModal />;
  // ÉTAPE-JET d'enfoncement de porte : flux multi PARALLÈLE (N héros frappent) rendu par `ForceDoorModal`
  // (bespoke : rangées par participant) ; `pendingForceDoor` porte les données, ses résolveurs ferment la cascade.
  if (cur.jet === 'forceDoor') return <ForceDoorModal />;
  // ÉTAPE-JET d'incantation : la situation « lancer un sort » (jet → opposition de cible → Contre-sort →
  // Surincantation → critique → effets) est rendue par `CastModal` (bespoke) ; `pendingCast` porte les
  // données, ses résolveurs (castConfirm/castCommitZone/oppositionConfirm/counterspellConfirm/castCancel)
  // ferment la cascade. Pendant un ciblage CARTE (pickingTargets / pose de zone), la modale s'efface
  // (comme l'ancienne entrée d'arbitre `cast`) → on défère à la carte.
  if (cur.jet === 'cast') {
    return pendingCast && !pendingCast.pickingTargets && !pendingCast.zone?.placing ? <CastModal /> : null;
  }
  const interaction = stepInteraction(cur);
  const isLast = p.cursor + 1 >= p.participants.length;
  // Étapes DÉJÀ validées (figées), avec portrait ET conséquence (note) — pile persistante (tous types).
  const doneRows = p.participants.slice(0, p.cursor).map(rowOf).filter((r): r is RollRowData => r !== null);

  // AFFICHAGE : conséquence pure — pas de jet, pas d'influence. Charge RICHE (`reveal`, ex. Coup
  // Critique) → panneau détaillé partagé `CriticalBody` ; sinon contenu pré-posé (`outcome`) en note.
  if (interaction === 'affichage') {
    const rev = cur.reveal;
    if (rev && rev.kind === 'critical') {
      const revActor = rev.actorId ? pool.find((c) => c.id === rev.actorId) : undefined;
      const revSubject = rev.subjectId ? pool.find((c) => c.id === rev.subjectId) : undefined;
      return (
        <RollFlowShell
          title={`${p.icon ?? '🎲'} ${p.title}`}
          subtitle={null}
          rolled
          onRoll={() => {}}
          rows={doneRows.length ? doneRows : undefined}
          postRollExtra={<CriticalBody entry={rev} actor={revActor} subject={revSubject} />}
          fortune={0}
          rerollable={false}
          onReroll={() => {}}
          confirmLabel={isLast ? 'Terminer' : 'Continuer'}
          onConfirm={() => next()}
          disableEscClose
        />
      );
    }
    return (
      <RollFlowShell
        title={`${p.icon ?? '🎲'} ${p.title}`}
        subtitle={<><strong>{cur.icon ?? 'ℹ️'} {cur.label}</strong>{p.participants.length > 1 ? ` · ${p.cursor + 1}/${p.participants.length}` : ''}</>}
        rolled
        onRoll={() => {}}
        rows={[...doneRows, { combatant: actorOf(cur), note: noteFor(cur) }]}
        fortune={0}
        rerollable={false}
        onReroll={() => {}}
        confirmLabel={isLast ? 'Terminer' : 'Continuer'}
        onConfirm={() => next()}
        disableEscClose
      />
    );
  }

  // CHOIX : le joueur tranche (l'option pilote la conséquence) — pas de jet, pas d'influence. Une
  // DÉVIATION (P3a) porte le Critique pré-tiré (panneau riche `CriticalBody`) ; « Dévier » exige du PA.
  if (interaction === 'choix') {
    const rev = cur.reveal;
    const dev = cur.deviation;
    let canDevier = true;
    if (dev) {
      const subj = pool.find((c) => c.id === dev.targetId);
      const loc = dev.res.location ?? 'corps';
      canDevier = (subj?.armour?.[loc] ?? 0) > 0;
    }
    const revActor = rev?.actorId ? pool.find((c) => c.id === rev.actorId) : undefined;
    const revSubject = rev?.subjectId ? pool.find((c) => c.id === rev.subjectId) : undefined;
    return (
      <RollFlowShell
        title={`${p.icon ?? '🎲'} ${p.title}`}
        subtitle={<><strong>{cur.icon ?? '🤔'} {cur.label}</strong>{p.participants.length > 1 ? ` · ${p.cursor + 1}/${p.participants.length}` : ''}</>}
        rolled
        onRoll={() => {}}
        rows={doneRows.length ? doneRows : undefined}
        postRollExtra={
          <>
            {rev?.kind === 'critical' && <CriticalBody entry={rev} actor={revActor} subject={revSubject} />}
            {!rev && cur.outcome?.length ? <div className="rm-log">{cur.outcome.map((l, i) => <p key={i}>{l}</p>)}</div> : null}
            <OptionChooser
              layout="grid"
              groupLabel={cur.label}
              options={(cur.options ?? []).map((o) => ({
                key: o.key, label: o.label, title: o.detail,
                disabled: o.key === 'devier' && !canDevier,
                selected: cur.chosen === o.key, primary: cur.chosen === o.key,
                onSelect: () => choose(cur.id, o.key),
              }))}
            />
          </>
        }
        fortune={0}
        rerollable={false}
        onReroll={() => {}}
        confirmLabel={isLast ? 'Terminer' : 'Continuer'}
        onConfirm={() => next()}
        disableEscClose
      />
    );
  }

  // JET : étape influençable (comportement historique) — requiert l'acteur.
  const actor = actorOf(cur);
  if (!actor) return null;
  const res = cur.result;
  const rolled = cur.target == null ? true : !!res;
  const failed = !!res && !res.success;
  const curPending: RollRowData = { combatant: actor, pending: pendingOf(cur) };
  // Issue de l'étape COURANTE = case journal proéminente (les figées gardent leur note compacte).
  const ocText = res ? (cascadeAppliers[cur.kind]?.describe?.(res.success, actor.name) ?? (res.success ? `${actor.name} réussit.` : `${actor.name} échoue.`)) : null;
  const ocEv: CombatEventKind = res?.success ? 'heal' : 'condition';
  // Peur de COMBAT = Test ÉTENDU (LDB 21 l.27) : barre de DR cumulé vers l'Indice (#23). Après le jet,
  // on montre le cumul MIS À JOUR (prevDR + DR du jet) ; avant, l'état d'entrée (prevDR).
  const peur = cur.combatPsych && !CIBLE_TYPES.has(cur.combatPsych.kind) && cur.combatPsych.kind !== 'terreur' ? cur.combatPsych : null;
  // Résilience « Je ne faillirai pas ! » (LDB 17 l.73) : sur une Peur de combat (Test ÉTENDU), le DR
  // gagné dépend du dé → on expose le sélecteur de dé (source unique `FLOWS.cascade.picker`). Les étapes
  // BINAIRES (Terreur/cible/Test de scène) renvoient `null` → réussite au DR max, sans choix.
  const forcedDie = FLOWS.cascade.picker?.(cur, actor);

  return (
    <RollFlowShell
      title={`${p.icon ?? '🎲'} ${p.title}`}
      subtitle={<><strong>{cur.icon ?? '🎲'} {cur.label}</strong>{p.participants.length > 1 ? ` · jet ${p.cursor + 1}/${p.participants.length}` : ''}</>}
      extra={peur ? <DrBar cum={peur.prevDR + (res?.success ? Math.max(0, res.sl) : 0)} target={peur.indice} /> : undefined}
      rolled={rolled}
      onRoll={() => roll(cur.id)}
      /* Pré-jet : panneau multi-lignes (validées figées + leur conséquence + courante en attente). */
      setup={<RollPanel rows={[...doneRows, curPending]} />}
      /* Post-jet : mêmes lignes, la courante désormais lancée (sa conséquence = la case journal ci-dessous). */
      rows={res ? [...doneRows, { combatant: actor, d: breakdown(cur, res) }] : undefined}
      outcome={ocText ? <JournalLine className="rm-journal" event={ev(ocEv, ocText, actor.id)} combatants={pool} /> : undefined}
      fortune={actor.fortune ?? 0}
      freeReroll={freeRerollOf(actor)}
      rerollable={!!res && canReroll(failed, !!cur.rerolled)}
      onReroll={() => reroll(cur.id)}
      onBonusSL={() => bonusSL(cur.id)}
      darkPactable={!!res && failed && actor.kind === 'hero'}
      onDarkPact={() => darkPact(cur.id)}
      resilience={actor.resilience ?? 0}
      onForce={() => force(cur.id)}
      forceShow={rolled && !res?.success}
      /* Résilience : dé CHOISI sur une Peur de combat étendue (le DR gagné suit le dé, LDB 17 l.73). */
      forcedRoll={forcedDie ? { ...forcedDie, onSet: (r) => setForcedRoll(cur.id, r) } : undefined}
      /* Psychologie (rencontre OU combat) : Détermination (immunité, LDB 17 l.62) AVANT le jet — comme l'ex-PsychModal/EncounterPsychModal. */
      determination={!res && (cur.encounterPsych || cur.combatPsych) ? { resolve: actor.resolve ?? 0, onResolve: () => determine(cur.id) } : undefined}
      confirmLabel={isLast ? 'Terminer' : 'Continuer'}
      onConfirm={() => next()}
      /* « Tout lancer » : tant qu'il reste >1 jet, résout d'un coup le reste (RNG, sans influence) PUIS
         montre le bilan — slot secondaire partagé du shell (comme « Subir » de Défense). Pas d'Échap :
         la cascade est SUBIE, on ne ferme pas — le bouton est une action explicite, pas une sortie. */
      onCancel={!isLast ? () => resolveAll() : undefined}
      cancelLabel="🎲 Tout lancer"
      cancelTitle="Résoudre d'un coup tous les jets restants (sans influence)"
      cancelAfterRoll
      disableEscClose
    />
  );
}
