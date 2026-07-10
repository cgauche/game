import type { ReactNode } from 'react';
import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { availableResistance } from '../engine/menace';
import { freeRerollOf } from '../engine/activeFlags';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { useAttackJetProps } from './jetProps/useAttackJetProps';
import { useTrampleJetProps } from './jetProps/useTrampleJetProps';
import { useDefenseJetProps } from './jetProps/useDefenseJetProps';
import { useFumbleJetProps } from './jetProps/useFumbleJetProps';
import { useTestJetProps } from './jetProps/useTestJetProps';
import { useExtendedTestJetProps } from './jetProps/useExtendedTestJetProps';
import { DisengageModal } from './DisengageModal';
import { ForceDoorModal } from './ForceDoorModal';
import { CastModal } from './CastModal';
import { type PanelRowData as PanelRow } from './RollPanel';
import { OptionChooser } from './OptionChooser';
import { DrBar } from './DrBar';
import { CIBLE_TYPES } from '../engine/psychology';
import { CriticalBody } from './RevealModal';
import { JournalLine } from './NarratedLine';
import { Icon } from './Icon';
import { ev, type CombatEventKind } from '../state/combatLog';
import { cascadeAppliers, stepInteraction } from '../state/cascade';
import { FLOWS } from '../state/rollFlowSpecs';
import type { CascadeStep, CascadeRoll } from '../state/pendings';
import type { Combatant } from '../engine/types';

/**
 * CASCADE de jets SÉQUENTIELS (nuit / voyage) — c'est LA coquille de jet partagée `RollShell`,
 * paramétrée comme `DefenseModal` : plusieurs RANGÉES de jet avec portraits (`RollShell rows`). Chaque
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
  const pursuit = useGame((s) => s.pursuit); // manche de poursuite (purpose:'pursuite') — porte partyRole/encounter
  const pursuitAbandon = useGame((s) => s.pursuitAbandon);
  const pendingCast = useGame((s) => s.pendingCast); // étape-jet `cast` : hôte la situation d'incantation (réactif, pas de hook conditionnel)
  const roll = useGame((s) => s.cascadeRoll);
  const reroll = useGame((s) => s.cascadeReroll);
  const bonusSL = useGame((s) => s.cascadeBonusSL);
  const darkPact = useGame((s) => s.cascadeDarkPact);
  const force = useGame((s) => s.cascadeForceSuccess);
  const resistAct = useGame((s) => s.cascadeResist); // Résistance (Menace) : auto-succès du talent (LDB 10)
  const setForcedRoll = useGame((s) => s.cascadeSetForcedRoll); // Résilience : dé CHOISI (Peur étendue, LDB 17 l.73)
  const determine = useGame((s) => s.cascadeDetermine); // Détermination (immunité Psychologie de rencontre)
  const next = useGame((s) => s.cascadeNext);
  const choose = useGame((s) => s.cascadeChoose); // étape « choix » : pose l'option retenue
  const resolveAll = useGame((s) => s.cascadeResolveAll); // « Tout lancer » → bilan
  const finish = useGame((s) => s.cascadeFinish); // « Terminer » du bilan
  const attackProps = useAttackJetProps(); // étape-jet d'attaque : rendue dans CETTE coquille (une fenêtre)
  const trampleProps = useTrampleJetProps(); // étape-jet de Piétinement : jet + son Critique dans UNE fenêtre
  const defenseProps = useDefenseJetProps(); // étape-jet de défense réactive : défense + son Critique dans UNE fenêtre
  const fumbleProps = useFumbleJetProps(); // étape-jet de Maladresse : Tableau des Oups ! dans la MÊME fenêtre
  const testProps = useTestJetProps(); // étape-jet de Test de scène : même coquille, une seule fenêtre
  const extendedProps = useExtendedTestJetProps(); // étape-jet de Test étendu (Rounds cumulés)

  if (!p) return null;
  const pool: Combatant[] = battle?.combatants ?? party;
  const actorOf = (s: CascadeStep) => (s.actorId ? pool.find((c) => c.id === s.actorId) : undefined);

  // Libellé de rangée = la COMPÉTENCE lancée (« Résistance », « Calme »…), comme Défense affiche
  // « Attaque »/« Parade » — pas le texte de l'étape (le but vit dans le sous-titre).
  const rowLabel = (s: CascadeStep) => s.rollLabel ?? 'Jet';
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
  const rowOf = (s: CascadeStep): PanelRow | null => {
    const a = actorOf(s);
    if (s.result) return { combatant: a, d: breakdown(s, s.result), note: noteFor(s) }; // jet validé
    if (s.outcome?.length) return { combatant: a, note: noteFor(s) }; // affichage/choix validé : note seule
    return null;
  };
  // Un panneau figé (`PanelRow` : breakdown + note) → rangées TÉMOINS du shell (`interactive:false`,
  // aucun cycle d'influence : jet déjà subi). Source unique de la conversion « pile figée → rangées ».
  const witnessRows = (panelRows: PanelRow[]): RollRowData[] =>
    panelRows.map((r, i) => ({ key: i, row: r, rolled: true, interactive: false as const }));

  // BILAN « Tout lancer » : curseur EN FIN — toutes les étapes résolues, chaque conséquence visible.
  // Un seul bouton « Terminer » (ferme + enchaîne la suite). Pas d'influence (jets déjà subis).
  if (p.cursor >= p.participants.length) {
    const allRows = p.participants.map(rowOf).filter((r): r is PanelRow => r !== null);
    return (
      <RollShell
        title={<><Icon id={p.icon || 'nav/dice'} size="sm" /> {p.title}</>}
        subtitle={<>Bilan · {p.participants.length} jet{p.participants.length > 1 ? 's' : ''}</>}
        rolled
        rows={witnessRows(allRows)}
        actions={[{ key: 'finish', label: 'Terminer', kind: 'primary', onClick: () => finish(), when: 'always' }]}
      />
    );
  }

  const cur = p.participants[p.cursor];
  if (!cur) return null;
  // ÉTAPE-JET : REGISTRE data-driven du rendu par TYPE de jet (ajouter un type = 1 entrée ici). Les
  // cinq jets RollShell (attaque/défense/Maladresse/Test/Test étendu) sont rendus via leur hook de
  // props dans la MÊME coquille restée montée → jet ET conséquences vivent dans UNE fenêtre jusqu'à
  // « Terminer » (leur `xConfirm`/`xNext` enchaîne le curseur / ferme la cascade). Les hooks de props
  // sont appelés INCONDITIONNELLEMENT au top-level (le registre ne mappe que le RENDU). Trois cas
  // BESPOKE (non-RollShell) rendent leur propre modale : désengagement (menu 3 phases, choix d'abord),
  // enfoncement de porte (multi PARALLÈLE, rangées par participant), incantation (`CastModal` — s'efface
  // pendant un ciblage CARTE (pickingTargets / pose de zone) pour déférer à la carte).
  const JET_RENDERERS: Record<NonNullable<CascadeStep['jet']>, () => JSX.Element | null> = {
    attack: () => (attackProps ? <RollShell {...attackProps} /> : null),
    trample: () => (trampleProps ? <RollShell {...trampleProps} /> : null),
    defense: () => (defenseProps ? <RollShell {...defenseProps} /> : null),
    fumble: () => (fumbleProps ? <RollShell {...fumbleProps} /> : null),
    test: () => (testProps ? <RollShell {...testProps} /> : null),
    extended: () => (extendedProps ? <RollShell {...extendedProps} /> : null),
    disengage: () => <DisengageModal />,
    forceDoor: () => <ForceDoorModal />,
    cast: () => (pendingCast && !pendingCast.pickingTargets && !pendingCast.zone?.placing ? <CastModal /> : null),
  };
  if (cur.jet) return JET_RENDERERS[cur.jet]();
  const interaction = stepInteraction(cur);
  const isLast = p.cursor + 1 >= p.participants.length;
  // Étapes DÉJÀ validées (figées), avec portrait ET conséquence (note) — pile persistante (tous types).
  const doneRows = p.participants.slice(0, p.cursor).map(rowOf).filter((r): r is PanelRow => r !== null);
  // Action « Continuer » / « Terminer » (dernière étape) — bouton primaire d'enchaînement, partagé par
  // les étapes AFFICHAGE et CHOIX (conséquences pures, aucun jet à attendre) : `when:'always'`.
  const continueAction: RollAction = { key: 'next', label: isLast ? 'Terminer' : 'Continuer', kind: 'primary', onClick: () => next(), when: 'always' };

  // AFFICHAGE : conséquence pure — pas de jet, pas d'influence. Charge RICHE (`reveal`, ex. Coup
  // Critique) → panneau détaillé partagé `CriticalBody` ; sinon contenu pré-posé (`outcome`) en note.
  if (interaction === 'affichage') {
    const rev = cur.reveal;
    if (rev && rev.kind === 'critical') {
      const revActor = rev.actorId ? pool.find((c) => c.id === rev.actorId) : undefined;
      const revSubject = rev.subjectId ? pool.find((c) => c.id === rev.subjectId) : undefined;
      return (
        <RollShell
          title={<><Icon id={p.icon || 'nav/dice'} size="sm" /> {p.title}</>}
          subtitle={null}
          rolled
          rows={witnessRows(doneRows)}
          postRollExtra={<CriticalBody entry={rev} actor={revActor} subject={revSubject} />}
          actions={[continueAction]}
          disableEscClose
        />
      );
    }
    return (
      <RollShell
        title={<><Icon id={p.icon || 'nav/dice'} size="sm" /> {p.title}</>}
        subtitle={<><strong><Icon id={cur.icon || 'journal/info'} size="sm" /> {cur.label}</strong>{p.participants.length > 1 ? ` · ${p.cursor + 1}/${p.participants.length}` : ''}</>}
        rolled
        rows={witnessRows([...doneRows, { combatant: actorOf(cur), note: noteFor(cur) }])}
        actions={[continueAction]}
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
      const loc = dev.mode === 'melee' ? (dev.res.critLocation ?? dev.res.location ?? 'corps') : dev.location;
      canDevier = (subj?.armour?.[loc] ?? 0) > 0;
    }
    const revActor = rev?.actorId ? pool.find((c) => c.id === rev.actorId) : undefined;
    const revSubject = rev?.subjectId ? pool.find((c) => c.id === rev.subjectId) : undefined;
    return (
      <RollShell
        title={<><Icon id={p.icon || 'nav/dice'} size="sm" /> {p.title}</>}
        subtitle={<><strong><Icon id={cur.icon || 'journal/info'} size="sm" /> {cur.label}</strong>{p.participants.length > 1 ? ` · ${p.cursor + 1}/${p.participants.length}` : ''}</>}
        rolled
        rows={witnessRows(doneRows)}
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
        actions={[continueAction]}
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
  const curPending: PanelRow = { combatant: actor, pending: pendingOf(cur) };
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
  // Résistance (Menace) (LDB 10) : étape taguée `menace` + spec du talent disponible (non consommée
  // cette séance) + issue encore défavorable → auto-succès offert (avant le jet ou après un échec).
  const resistAvail = cur.menace != null && availableResistance(actor, cur.menace) != null && (!res || !res.success);

  // Rangée INTERACTIVE de l'étape COURANTE : pré-jet en attente puis résultat, porteuse du cycle
  // d'influence (Chance/+1 DR/Pacte/Résilience/forcedRoll/resist/Détermination).
  const curRow: RollRowData = {
    actor,
    row: res ? { combatant: actor, d: breakdown(cur, res) } : curPending,
    rolled,
    onRoll: () => roll(cur.id),
    fortune: actor.fortune ?? 0,
    freeReroll: freeRerollOf(actor),
    rerollable: !!res && canReroll(failed, !!cur.rerolled),
    onReroll: () => reroll(cur.id),
    onBonusSL: () => bonusSL(cur.id),
    darkPactable: !!res && failed && actor.kind === 'hero',
    onDarkPact: () => darkPact(cur.id),
    resilience: actor.resilience ?? 0,
    onForce: () => force(cur.id),
    forceShow: rolled && !res?.success,
    resist: resistAvail ? { menace: cur.menace!, onResist: () => resistAct(cur.id) } : undefined,
    // Résilience : dé CHOISI sur une Peur de combat étendue (le DR gagné suit le dé, LDB 17 l.73).
    forcedRoll: forcedDie ? { ...forcedDie, onSet: (r) => setForcedRoll(cur.id, r) } : undefined,
    // Psychologie (rencontre OU combat) : Détermination (immunité, LDB 17 l.62) AVANT le jet.
    determination: !res && (cur.encounterPsych || cur.combatPsych) ? { resolve: actor.resolve ?? 0, onResolve: () => determine(cur.id) } : undefined,
  };

  const jetActions: RollAction[] = [
    // « Tout lancer » : tant qu'il reste >1 jet, résout d'un coup le reste (RNG, sans influence) PUIS
    // montre le bilan — bouton PRÉSENT avant ET après le jet (parité `cancelAfterRoll`). Pas d'Échap :
    // la cascade est SUBIE, on ne ferme pas — le bouton est une action explicite, pas une sortie.
    ...(!isLast ? [{ key: 'all', label: <><Icon id="nav/dice" size="sm" /> Tout lancer</>, kind: 'ghost', onClick: () => resolveAll(), title: "Résoudre d'un coup tous les jets restants (sans influence)", when: 'always' } as RollAction] : []),
    // Poursuite terrestre (purpose:'pursuite') : renoncer coûte la manche — le groupe qui FUIT se
    // laisse rattraper (combat si une rencontre est fournie, LDB 15 l.518) ; côté poursuivant, la
    // proie s'échappe (state/pursuitFlow.pursuitAbandon porte la vraie conséquence).
    ...(p.purpose === 'pursuite' ? [{
      key: 'break',
      label: pursuit?.partyRole === 'pursuing' ? 'Abandonner la poursuite' : 'Abandonner la fuite',
      kind: 'ghost',
      onClick: () => pursuitAbandon(),
      title: pursuit?.partyRole === 'pursuing'
        ? 'Le groupe renonce à traquer sa proie — la poursuite est perdue.'
        : pursuit?.encounter
          ? 'Le groupe cesse de fuir et fait face — les poursuivants fondent sur lui (LDB 15 l.518).'
          : 'Le groupe cesse de fuir et fait face.',
      when: 'always',
    } as RollAction] : []),
    { key: 'next', label: isLast ? 'Terminer' : 'Continuer', kind: 'primary', onClick: () => next(), when: 'post' },
  ];

  return (
    <RollShell
      title={<><Icon id={p.icon || 'nav/dice'} size="sm" /> {p.title}</>}
      subtitle={<><strong><Icon id={cur.icon || 'nav/dice'} size="sm" /> {cur.label}</strong>{p.participants.length > 1 ? ` · jet ${p.cursor + 1}/${p.participants.length}` : ''}</>}
      /* Test ÉTENDU = barre de DR cumulé (prevDR + DR du jet après coup) : Peur de COMBAT (vers l'Indice)
         OU cartographie de voyage (Établir des cartes, vers `drTarget` = 2 × Étapes — porté par le poste). */
      extra={peur ? <DrBar cum={peur.prevDR + (res?.success ? Math.max(0, res.sl) : 0)} target={peur.indice} />
        : cur.meta?.extendedDrTarget != null
          ? <DrBar cum={Number(cur.meta.extendedDrDone ?? 0) + (res?.success ? Math.max(0, res.sl) : 0)} target={Number(cur.meta.extendedDrTarget)} />
          : undefined}
      rolled={rolled}
      /* Rangées : validées FIGÉES (témoins) + courante interactive (pré-jet en attente, post-jet résolue). */
      rows={[...witnessRows(doneRows), curRow]}
      /* Issue de l'étape COURANTE = case journal proéminente, sous les rangées (>1 rangée → postRollExtra). */
      postRollExtra={res && ocText ? <JournalLine className="rm-journal" event={ev(ocEv, ocText, actor.id)} combatants={pool} /> : undefined}
      actions={jetActions}
      disableEscClose
    />
  );
}
