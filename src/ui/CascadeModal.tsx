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
import { CriticalBody } from './RevealModal';
import { JournalLine } from './NarratedLine';
import { Icon } from './Icon';
import { ev, type CombatEventKind } from '../state/combatLog';
import { stepInteraction, stepReady } from '../state/cascade';
import { FLOWS } from '../state/rollFlowSpecs';
import type { CascadeStep, CascadeRoll } from '../state/pendings';
import type { Combatant } from '../engine/types';
import { buildParticipantRows, rollAllUnrolledRows } from './buildParticipantRows';
import { Prose } from './Prose';

/** Une étape-JET est PRÉSENTABLE avec son acteur (comportement historique) OU sans acteur quand
 *  elle est MONDIALE (`worldOwner`, seam #275 Décision 3 — désertion/Moral, aucun `actorId` par
 *  conception) : rendre `null` dans ce second cas privait TOUS les sièges — y compris l'owner
 *  (MJ) — de la modale (#P0-2). Exporté pour test direct (pas de harnais de rendu React ici). */
export function jetStepPresentable(step: CascadeStep, actor: Combatant | undefined): boolean {
  return !!actor || !!step.worldOwner;
}

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
  return <CascadeBody />;
}

/** Corps de la cascade — `embedded` (#333) bascule chaque `RollShell` en zone embarquée (sans `Modal`)
 *  pour l'incrustation dans l'écran-hub de voyage. Défaut `false` = modale flottante (inchangé). */
export function CascadeBody({ embedded = false }: { embedded?: boolean } = {}) {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const p = useGame((s) => s.pendingCascade);
  const pursuit = useGame((s) => s.pursuit); // manche de poursuite (purpose:'pursuite') — porte partyRole/encounter
  const pursuitAbandon = useGame((s) => s.pursuitAbandon);
  const pendingCast = useGame((s) => s.pendingCast); // étape-jet `cast` : hôte la situation d'incantation (réactif, pas de hook conditionnel)
  const batchRoll = useGame((s) => s.cascadeBatchRoll); // étape « batch » — un Test générique par participant (seam #275 Décision 4 cran 1)
  const batchReroll = useGame((s) => s.cascadeBatchReroll);
  const batchBonusSL = useGame((s) => s.cascadeBatchBonusSL);
  const batchDarkPact = useGame((s) => s.cascadeBatchDarkPact);
  const batchForce = useGame((s) => s.cascadeBatchForceSuccess);
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
  // l'affiche telle quelle. `cons` vide (#295 Décision 1b) ⇒ rien à noter : la rangée ✓/✗ ±DR
  // (breakdown, ci-dessous) porte SEULE le verdict — aucun repli « X réussit »/« X échoue ».
  const noteFor = (s: CascadeStep): ReactNode => {
    if (!s.outcome?.length) return undefined;
    // Ton : succès→soin (vert), échec→état (rouge), affichage sans jet→neutre (info).
    const k: CombatEventKind = s.result ? (s.result.success ? 'heal' : 'condition') : 'info';
    return <>{s.outcome.map((l, i) => <JournalLine key={i} event={ev(k, l, s.actorId)} combatants={pool} />)}</>;
  };
  const rowOf = (s: CascadeStep): PanelRow | null => {
    const a = actorOf(s);
    // Étape BATCH committée : sa conséquence (resultLine, #331) se lit SUR PLACE — note SEULE (pas de
    // RollLine mono factice `base 0` : le batch n'a ni acteur ni cible d'étape, le verdict est agrégé).
    if (s.participants) return s.outcome?.length ? { combatant: a, note: noteFor(s) } : null;
    if (s.result) return { combatant: a, d: breakdown(s, s.result), note: noteFor(s) }; // jet validé
    if (s.outcome?.length) return { combatant: a, note: noteFor(s) }; // affichage/choix validé : note seule
    return null;
  };
  // Un panneau figé (`PanelRow` : breakdown + note) → rangées TÉMOINS du shell (`interactive:false`,
  // aucun cycle d'influence : jet déjà subi). Source unique de la conversion « pile figée → rangées ».
  const witnessRows = (panelRows: PanelRow[]): RollRowData[] =>
    panelRows.map((r, i) => ({ key: i, row: r, rolled: true, interactive: false as const }));
  // DONNÉE de Test ÉTENDU d'une rangée (arbitrage user 2026-07-11 : la barre est RENDUE par `RollRow`
  // — site UNIQUE — pas ici ; ceci ne calcule que `{cum, target}`). `done` = DR cumulés AVANT ce jet,
  // `+ SL` du jet réussi. Générique : mono (`meta`) ou batch (participant), toute la CLASSE des jets étendus.
  const extendedDrData = (done: number | undefined, target: number | undefined, res: CascadeRoll | null | undefined): { cum: number; target: number } | undefined => {
    if (target == null) return undefined;
    const gain = res?.success ? Math.max(0, res.sl) : 0;
    return { cum: (done ?? 0) + gain, target: Number(target) };
  };
  // Note de conséquence d'une rangée-participant (batch) : `part.outcome` porte l'attribution par le
  // portrait (pas de note agrégée à l'étape) ; ton succès→soin / échec→état.
  const partNote = (part: { id: string; outcome?: string[]; result?: CascadeRoll | null }): ReactNode => {
    if (!part.outcome?.length) return undefined;
    const k: CombatEventKind = part.result ? (part.result.success ? 'heal' : 'condition') : 'info';
    return <>{part.outcome.map((l, i) => <JournalLine key={i} event={ev(k, l, part.id)} combatants={pool} />)}</>;
  };
  // Rangées TÉMOINS d'un pas VALIDÉ (pile persistante) — un pas BATCH est DÉPLIÉ en une rangée par
  // participant (breakdown + sa note + sa barre de Test étendu PERSISTANTE) ; les autres pas → une rangée.
  const stepWitnessRows = (s: CascadeStep): RollRowData[] => {
    if (s.participants) {
      return s.participants.flatMap((part) => {
        const a = pool.find((c) => c.id === part.id);
        if (!a) return [];
        const res = part.result;
        const d = res ? { label: part.label ?? a.name, base: part.base, mods: part.mods, modifier: res.target - part.base, target: res.target, roll: res.roll, success: res.success, sl: res.sl } : undefined;
        const extendedDr = extendedDrData(part.extendedDrDone, part.extendedDrTarget, res);
        return [{ key: part.id, row: { combatant: a, d, note: partNote(part) }, rolled: true, interactive: false as const, ...(extendedDr ? { extendedDr } : {}) }];
      });
    }
    const pr = rowOf(s);
    if (!pr) return [];
    const extendedDr = extendedDrData(s.meta?.extendedDrDone as number | undefined, s.meta?.extendedDrTarget as number | undefined, s.result);
    return [{ key: s.id, row: pr, rolled: true, interactive: false as const, ...(extendedDr ? { extendedDr } : {}) }];
  };

  // Nombre de JETS DE DÉ réels (arbitrage user 2026-07-11) : un pas BATCH = ses N rangées ; un pas-jet
  // = 1 ; l'agrégation / la météo / les affichages = 0. Sert au « Bilan · N jets » et à « jet N/M ».
  const diceOf = (s: CascadeStep) => (s.participants ? s.participants.length : s.target != null || s.jet ? 1 : 0);
  const totalJets = p.participants.reduce((n, s) => n + diceOf(s), 0);

  // BILAN « Tout lancer » : curseur EN FIN — toutes les étapes résolues, chaque conséquence visible.
  // Un seul bouton « Terminer » (ferme + enchaîne la suite). Pas d'influence (jets déjà subis).
  if (p.cursor >= p.participants.length) {
    return (
      <RollShell
        title={<><Icon id={p.icon || 'nav/dice'} size="sm" /> {p.title}</>}
        subtitle={<>Bilan · {totalJets} jet{totalJets > 1 ? 's' : ''}</>}
        rolled
        rows={p.participants.flatMap(stepWitnessRows)}
        actions={[{ key: 'finish', label: 'Terminer', onClick: () => finish(), when: 'always' }]}
        embedded={embedded}
      />
    );
  }

  const cur = p.participants[p.cursor];
  if (!cur) return null;
  // ENJEU surfaçable (#331) : ce que l'échec de l'étape COURANTE coûte, ÉNONCÉ sous le titre AVANT le
  // jet (le mécanisme est déjà dans l'applier — cf. « on ne sait ni à quoi ça correspond »). Verbatim
  // Source, porté par la donnée (`step.stake`, posé à la construction par le flux propriétaire).
  const stakeNote = cur.stake ? <div className="rm-threat"><Icon id="ui/warning" size="sm" /> <Prose md={cur.stake} /></div> : null;
  // ÉTAPE-JET : REGISTRE data-driven du rendu par TYPE de jet (ajouter un type = 1 entrée ici). Les
  // cinq jets RollShell (attaque/défense/Maladresse/Test/Test étendu) sont rendus via leur hook de
  // props dans la MÊME coquille restée montée → jet ET conséquences vivent dans UNE fenêtre jusqu'à
  // « Terminer » (leur `xConfirm`/`xNext` enchaîne le curseur / ferme la cascade). Les hooks de props
  // sont appelés INCONDITIONNELLEMENT au top-level (le registre ne mappe que le RENDU). Trois cas
  // BESPOKE (non-RollShell) rendent leur propre modale : désengagement (menu 3 phases, choix d'abord),
  // enfoncement de porte (multi PARALLÈLE, rangées par participant), incantation (`CastModal` — s'efface
  // pendant un ciblage CARTE (pickingTargets / pose de zone) pour déférer à la carte).
  const JET_RENDERERS: Record<NonNullable<CascadeStep['jet']>, () => JSX.Element | null> = {
    attack: () => (attackProps ? <RollShell {...attackProps} embedded={embedded} /> : null),
    trample: () => (trampleProps ? <RollShell {...trampleProps} embedded={embedded} /> : null),
    defense: () => (defenseProps ? <RollShell {...defenseProps} embedded={embedded} /> : null),
    fumble: () => (fumbleProps ? <RollShell {...fumbleProps} embedded={embedded} /> : null),
    test: () => (testProps ? <RollShell {...testProps} embedded={embedded} /> : null),
    extended: () => (extendedProps ? <RollShell {...extendedProps} embedded={embedded} /> : null),
    disengage: () => <DisengageModal />,
    forceDoor: () => <ForceDoorModal />,
    cast: () => (pendingCast && !pendingCast.pickingTargets && !pendingCast.zone?.placing ? <CastModal /> : null),
  };
  if (cur.jet) return JET_RENDERERS[cur.jet]();
  const interaction = stepInteraction(cur);
  const isLast = p.cursor + 1 >= p.participants.length;
  // Étapes DÉJÀ validées (figées), avec portrait ET conséquence (note) + barre de Test étendu PERSISTANTE
  // — pile persistante (tous types ; un pas BATCH est déplié en rangées-participants).
  const doneWitnessRows = p.participants.slice(0, p.cursor).flatMap(stepWitnessRows);
  // Action « Continuer » / « Terminer » (dernière étape) — bouton primaire d'enchaînement, partagé par
  // les étapes AFFICHAGE et CHOIX (conséquences pures, aucun jet à attendre) : `when:'always'`.
  const continueAction: RollAction = { key: 'next', label: isLast ? 'Terminer' : 'Continuer', onClick: () => next(), when: 'always' };

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
          rows={doneWitnessRows}
          postRollExtra={<CriticalBody entry={rev} actor={revActor} subject={revSubject} />}
          actions={[continueAction]}
          disableEscClose
          embedded={embedded}
        />
      );
    }
    return (
      <RollShell
        title={<><Icon id={p.icon || 'nav/dice'} size="sm" /> {p.title}</>}
        subtitle={<><strong><Icon id={cur.icon || 'journal/info'} size="sm" /> {cur.label}</strong>{p.participants.length > 1 ? ` · ${p.cursor + 1}/${p.participants.length}` : ''}</>}
        rolled
        rows={[...doneWitnessRows, ...witnessRows([{ combatant: actorOf(cur), note: noteFor(cur) }])]}
        actions={[continueAction]}
        disableEscClose
        embedded={embedded}
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
        rows={doneWitnessRows}
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
        embedded={embedded}
      />
    );
  }

  // BATCH : Test d'équipage MULTI (participants — seam de jet #275 Décision 4 cran 1) — patron
  // `ForceDoorModal` (frappe PARALLÈLE) : chaque contributeur lance SON rôle indépendamment, son
  // propre cycle Chance/+1 DR/Pacte/Résilience ; « Continuer » n'agit QUE quand `stepReady` (tous les
  // interactifs ont un `result` — les témoins PNJ, `interactive:false`, ne freinent jamais).
  if (interaction === 'batch') {
    // Rangées-participants via le builder mutualisé (#328) : la modale ne fournit QUE la PRÉSENTATION
    // (label/base/mods déjà résolus à la construction, GÉNÉRIQUES) + son bundle d'actions de flux ; les
    // dérivations d'éligibilité (rerollable/darkPactable/forceShow) vivent dans `buildParticipantRows`.
    const rows: RollRowData[] = buildParticipantRows(cur.participants!, pool, {
      onRoll: batchRoll, onReroll: batchReroll, onBonusSL: batchBonusSL, onDarkPact: batchDarkPact, onForce: batchForce,
      row: (part, actor, res) => {
        const label = part.label ?? actor.name;
        return res
          ? { combatant: actor, d: { label, base: part.base, mods: part.mods, modifier: res.target - part.base, target: res.target, roll: res.roll, success: res.success, sl: res.sl } }
          : { combatant: actor, pending: { label, base: part.base, mods: part.mods ?? [] } };
      },
      // Test ÉTENDU d'une rangée (cartographie de voyage) : DONNÉE seule — `RollRow` rend la barre (site
      // UNIQUE), visible AVANT et après le jet, persistante (arbitrage user 2026-07-11).
      extendedDrOf: (part) => extendedDrData(part.extendedDrDone, part.extendedDrTarget, part.result),
    });
    const ready = stepReady(cur);
    // Deux « Tout lancer » (#328) : PAR RANGÉES (lance d'un coup les contributeurs restants de CETTE
    // étape, ≥2 non lancés — mutualisé) et CASCADE (résout d'office tout le reste de la cascade, sans
    // influence — `cascadeResolveAll`, comme la branche jet).
    const rollAllRows = rollAllUnrolledRows(cur.participants!, batchRoll);
    const batchActions: RollAction[] = [
      ...(rollAllRows ? [{ key: 'rollRows', label: <><Icon id="nav/dice" size="sm" /> Tout lancer</>, onClick: rollAllRows, title: 'Lancer toutes les rangées non encore lancées', when: 'always' } as RollAction] : []),
      ...(!isLast ? [{ key: 'all', label: <><Icon id="nav/dice" size="sm" /> Tout résoudre</>, onClick: () => resolveAll(), title: "Résoudre d'un coup tous les jets restants de la cascade (sans influence)", when: 'always' } as RollAction] : []),
      ...(ready ? [continueAction] : []),
    ];
    return (
      <RollShell
        title={<><Icon id={p.icon || 'nav/dice'} size="sm" /> {p.title}</>}
        subtitle={<><strong><Icon id={cur.icon || 'nav/dice'} size="sm" /> {cur.label}</strong>{p.participants.length > 1 ? ` · ${p.cursor + 1}/${p.participants.length}` : ''}</>}
        extra={stakeNote ?? undefined}
        rolled={ready}
        rows={[...doneWitnessRows, ...rows]}
        actions={batchActions}
        disableEscClose
        embedded={embedded}
      />
    );
  }

  // JET : étape influençable (comportement historique — requiert l'acteur) OU étape MONDIALE
  // (`worldOwner`, seam #275 Décision 3 — désertion/Moral) : aucun acteur PRÉSENTABLE par
  // conception, l'ownership est déjà routée en amont (sentinel `WORLD_STEP_OWNER`, ne pas y
  // toucher ICI) — rendu générique (titre = `cur.label` déjà composé par le seam, pas de portrait).
  const actor = actorOf(cur);
  if (!jetStepPresentable(cur, actor)) return null;
  const res = cur.result;
  const rolled = cur.target == null ? true : !!res;
  const failed = !!res && !res.success;
  const curPending: PanelRow = { combatant: actor, pending: pendingOf(cur) };
  // `outcome` (résumé de conséquence) n'existe que sur une étape COMMITTÉE ; l'étape COURANTE
  // s'appuie sur la rangée ✓/✗ ±DR (breakdown) comme SEUL verdict (#295 Décision 1b) : aucun
  // prologue « X réussit »/« X échoue » ici.
  // Résilience « Je ne faillirai pas ! » (LDB 17 l.73) : sur une Peur de combat (Test ÉTENDU), le DR
  // gagné dépend du dé → on expose le sélecteur de dé (source unique `FLOWS.cascade.picker`). Les étapes
  // BINAIRES (Terreur/cible/Test de scène) renvoient `null` → réussite au DR max, sans choix.
  const forcedDie = FLOWS.cascade.picker?.(cur, actor);
  // Résistance (Menace) (LDB 10) : étape taguée `menace` + spec du talent disponible (non consommée
  // cette séance) + issue encore défavorable → auto-succès offert (avant le jet ou après un échec).
  const resistAvail = !!actor && cur.menace != null && availableResistance(actor, cur.menace) != null && (!res || !res.success);

  // Rangée INTERACTIVE de l'étape COURANTE : pré-jet en attente puis résultat, porteuse du cycle
  // d'influence (Chance/+1 DR/Pacte/Résilience/forcedRoll/resist/Détermination) — étape MONDIALE
  // (`worldOwner`, `actor` absent) : cycle d'influence NUL (Chance/Pacte/Résilience/Détermination
  // sont des ressources de HÉROS), seul « Lancer » reste actionnable pour le siège owner.
  // DONNÉE de Test étendu de CETTE rangée (arbitrage user 2026-07-11 : `RollRow` rend la barre, site
  // UNIQUE ; plus le bandeau global du shell qui disparaissait au pas suivant — persistée via `stepWitnessRows`).
  const curExtendedDr = extendedDrData(cur.meta?.extendedDrDone as number | undefined, cur.meta?.extendedDrTarget as number | undefined, res);
  const curRow: RollRowData = {
    actor,
    row: res ? { combatant: actor, d: breakdown(cur, res) } : curPending,
    rolled,
    ...(curExtendedDr ? { extendedDr: curExtendedDr } : {}),
    onRoll: () => roll(cur.id),
    fortune: actor?.fortune ?? 0,
    freeReroll: freeRerollOf(actor),
    rerollable: !!res && canReroll(failed, !!cur.rerolled),
    onReroll: () => reroll(cur.id),
    onBonusSL: () => bonusSL(cur.id),
    darkPactable: !!res && failed && actor?.kind === 'hero',
    onDarkPact: () => darkPact(cur.id),
    resilience: actor?.resilience ?? 0,
    onForce: () => force(cur.id),
    forceShow: rolled && !res?.success,
    resist: resistAvail ? { menace: cur.menace!, onResist: () => resistAct(cur.id) } : undefined,
    // Résilience : dé CHOISI sur une Peur de combat étendue (le DR gagné suit le dé, LDB 17 l.73).
    forcedRoll: forcedDie ? { ...forcedDie, onSet: (r) => setForcedRoll(cur.id, r) } : undefined,
    // Psychologie (rencontre OU combat) : Détermination (immunité, LDB 17 l.62) AVANT le jet.
    determination: actor && !res && (cur.encounterPsych || cur.combatPsych) ? { resolve: actor.resolve ?? 0, onResolve: () => determine(cur.id) } : undefined,
  };

  const jetActions: RollAction[] = [
    // « Tout lancer » : tant qu'il reste >1 jet, résout d'un coup le reste (RNG, sans influence) PUIS
    // montre le bilan — bouton PRÉSENT avant ET après le jet (parité `cancelAfterRoll`). Pas d'Échap :
    // la cascade est SUBIE, on ne ferme pas — le bouton est une action explicite, pas une sortie.
    ...(!isLast ? [{ key: 'all', label: <><Icon id="nav/dice" size="sm" /> Tout lancer</>, onClick: () => resolveAll(), title: "Résoudre d'un coup tous les jets restants (sans influence)", when: 'always' } as RollAction] : []),
    // Poursuite terrestre (purpose:'pursuite') : renoncer coûte la manche — le groupe qui FUIT se
    // laisse rattraper (combat si une rencontre est fournie, LDB 15 l.518) ; côté poursuivant, la
    // proie s'échappe (state/pursuitFlow.pursuitAbandon porte la vraie conséquence).
    ...(p.purpose === 'pursuite' ? [{
      key: 'break',
      label: pursuit?.partyRole === 'pursuing' ? 'Abandonner la poursuite' : 'Abandonner la fuite',
      onClick: () => pursuitAbandon(),
      title: pursuit?.partyRole === 'pursuing'
        ? 'Le groupe renonce à traquer sa proie — la poursuite est perdue.'
        : pursuit?.encounter
          ? 'Le groupe cesse de fuir et fait face — les poursuivants fondent sur lui (LDB 15 l.518).'
          : 'Le groupe cesse de fuir et fait face.',
      when: 'always',
    } as RollAction] : []),
    { key: 'next', label: isLast ? 'Terminer' : 'Continuer', onClick: () => next(), when: 'post' },
  ];

  return (
    <RollShell
      title={<><Icon id={p.icon || 'nav/dice'} size="sm" /> {p.title}</>}
      /* « jet N/M » : N = jets de dé jusqu'ici + celui-ci, M = total des jets RÉELS (arbitrage user
         2026-07-11 — l'agrégation/la météo/les affichages ne comptent pas). */
      subtitle={<><strong><Icon id={cur.icon || 'nav/dice'} size="sm" /> {cur.label}</strong>{totalJets > 1 ? ` · jet ${p.participants.slice(0, p.cursor).reduce((n, s) => n + diceOf(s), 0) + 1}/${totalJets}` : ''}</>}
      extra={stakeNote ?? undefined}
      rolled={rolled}
      /* Rangées : validées FIGÉES (témoins) + courante interactive (pré-jet en attente, post-jet résolue).
         La barre de Test étendu vit désormais SUR la rangée (`curRow.extra`), pas dans le bandeau global. */
      rows={[...doneWitnessRows, curRow]}
      actions={jetActions}
      disableEscClose
      embedded={embedded}
    />
  );
}
