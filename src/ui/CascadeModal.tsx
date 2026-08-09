import { useEffect, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { availableResistance } from '../engine/menace';
import { freeRerollOf } from '../engine/activeFlags';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { VsHeader } from './VsHeader';
import { StakeRule, OutcomeNote, sameCertainOps } from './StakeNote';
import { branchCertainOps } from '../state/combat/flowEval';
import { resolveStake } from '../data';
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
import { OptionChooser, type RollOption } from './OptionChooser';
import { CriticalBody, RevealBody } from './RevealBody';
import { ModalSubject } from './ModalSubject';
import { RecapLineList } from './RecapLine';
import { RuleDivider } from './Ornaments';
import { TableRollLine } from './RollLine';
import { supportSplit, testBreakdown, testPending, opposedLines } from './breakdown';
import type { ModLine } from '../engine/combat';
import { Icon } from './Icon';
import { stepInteraction, stepReady, tableStepDefs, tableStepDie, naturalRollForTableRow, liveTableDecl } from '../state/cascade';
import { ownsLocally } from '../state/netOwnership';
import { tableStepForcedDie } from './forcedDieRow';
import { frozenOpposedRow, opposedResponded } from './opposedFrozen';
import type { CascadeStep, CascadeRollStep, CascadeRoll, BatchParticipant } from '../state/pendings';
import type { Combatant } from '../engine/types';
import { buildParticipantRows, rollAllUnrolledRows } from './buildParticipantRows';

/** Une étape-JET est PRÉSENTABLE avec son acteur (comportement historique) OU sans acteur quand
 *  elle est MONDIALE (`worldOwner`, seam #275 Décision 3 — désertion/Moral, aucun `actorId` par
 *  conception) : rendre `null` dans ce second cas privait TOUS les sièges — y compris l'owner
 *  (MJ) — de la modale (#P0-2). Exporté pour test direct (pas de harnais de rendu React ici). */
export function jetStepPresentable(step: CascadeStep, actor: Combatant | undefined): boolean {
  return !!actor || !!step.worldOwner;
}

/** Clé React d'une rangée-témoin/participant — SCOPÉE PAR ÉTAPE. Deux pas BATCH successifs partagent
 *  leurs participants (Capitaine/Timonier/Navigateur d'Orientation ET d'Entretien) : keyer par le seul
 *  id de participant collisionne (pas figé + pas courant côte à côte → « two children with the same
 *  key »). Site UNIQUE de la clé, partagé par la pile figée et la rangée batch courante. */
export const witnessRowKey = (stepId: string, participantId?: string): string =>
  participantId != null ? `${stepId}:${participantId}` : stepId;

/** Fourchette d'une ligne de table, telle qu'elle se lit sur le tableau imprimé : bornes cadrées sur
 *  les faces du dé (d100 → « 01-50 », d10 → « 1-5 »). Une ligne à borne unique ne s'écrit pas « 7-7 ». */
export function fourchette(min: number, max: number, dieMax: number): string {
  const pad = (n: number) => (dieMax >= 100 ? String(n).padStart(2, '0') : String(n));
  return min === max ? pad(min) : `${pad(min)}-${pad(max)}`;
}

/** Sous-titre d'étape — SOURCE UNIQUE des six branches de la cascade (table / affichage riche /
 *  affichage / choix / batch / jet) : la POSITION dans la séquence, et elle seule. Le libellé de
 *  l'étape et son renvoi de règle sont portés par le TITRE de la fenêtre (`CascadeBody.titleNode`,
 *  qui suit le pas courant) — les redire ici empilerait deux tuiles pour la même information.
 *  `undefined` quand il n'y a rien à situer (séquence à une étape) : un fragment JSX vide n'est pas
 *  `null`, la coquille rendrait un `<p>` vide, soit une bande de marge sans contenu sous le titre.
 *  `count` porte le rang de l'étape par défaut (`n/m`), ou le compte de JETS RÉELS pour la branche
 *  jet (`prefix: 'jet '`, `total` = `totalJets`, arbitrage user 2026-07-11). */
export function stepSubtitle(count: { cursor: number; total: number; prefix?: string }): ReactNode {
  if (count.total <= 1) return undefined;
  return `${count.prefix ?? ''}${count.cursor + 1}/${count.total}`;
}

/** Nom de table de la rangée de tirage : rendu SEULEMENT s'il apporte autre chose que ce qui est déjà
 *  à l'écran (titre de fenêtre, libellé d'étape). Sinon la même phrase se lit trois fois. */
export function tableLineLabel(defLabel: string | undefined, stepLabel: string | undefined, modalTitle: unknown): string {
  const dejaLu = [typeof modalTitle === 'string' ? modalTitle : '', stepLabel ?? ''].map((s) => s.trim().toLowerCase());
  const l = (defLabel ?? stepLabel ?? '').trim();
  return dejaLu.includes(l.toLowerCase()) ? '' : l;
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
  const determine = useGame((s) => s.cascadeDetermine); // Détermination (immunité Psychologie de rencontre)
  const next = useGame((s) => s.cascadeNext);
  const choose = useGame((s) => s.cascadeChoose); // étape « choix » : pose l'option retenue
  const tableRoll = useGame((s) => s.cascadeTableRoll); // étape « table » : tire le dé sur le tableau déclaré
  const tableSetForcedRoll = useGame((s) => s.cascadeTableSetForcedRoll); // mode table : POSE le dé (champ ou ligne)
  const resolveAll = useGame((s) => s.cascadeResolveAll); // « Tout lancer » → bilan
  const finish = useGame((s) => s.cascadeFinish); // « Terminer » du bilan
  const attackProps = useAttackJetProps(); // étape-jet d'attaque : rendue dans CETTE coquille (une fenêtre)
  const trampleProps = useTrampleJetProps(); // étape-jet de Piétinement : jet + son Critique dans UNE fenêtre
  const defenseProps = useDefenseJetProps(); // étape-jet de défense réactive : défense + son Critique dans UNE fenêtre
  const fumbleProps = useFumbleJetProps(); // étape-jet de Maladresse : Tableau des Oups ! dans la MÊME fenêtre
  const testProps = useTestJetProps(); // étape-jet de Test de scène : même coquille, une seule fenêtre
  const extendedProps = useExtendedTestJetProps(); // étape-jet de Test étendu (Rounds cumulés)
  const net = useGame((s) => s.net);

  // AUTO-FERMETURE d'une étape d'AFFICHAGE (#942 L8) : l'étape qui DÉCLARE `autoCloseMs` (gravité de
  // sa révélation) enchaîne d'elle-même passé le délai — « Continuer » reste servi et ferme avant. Le
  // minuteur est réarmé PAR ÉTAPE (clé = son id) ; il n'a rien à voir avec la Cadence de combat (une
  // cadence MANUELLE auto-ferme aussi : c'était le comportement de la révélation témoin). COOP : seul
  // le siège PROPRIÉTAIRE de l'étape l'arme (`actorId` absent ⇒ l'hôte, cf. `ownsLocally`) — deux
  // sièges qui tirent `cascadeNext` avanceraient de deux crans.
  const autoStep = p ? p.participants[p.cursor] : undefined;
  const autoCloseMs = autoStep?.autoCloseMs;
  const autoStepId = autoStep?.id;
  const autoOwned = autoStep ? ownsLocally(useGame.getState(), autoStep.actorId) : false;
  useEffect(() => {
    if (autoCloseMs == null || !autoOwned) return;
    const t = window.setTimeout(() => useGame.getState().cascadeNext(), autoCloseMs);
    return () => window.clearTimeout(t);
  }, [autoStepId, autoCloseMs, autoOwned]);
  // BARRE DE TEMPS de l'auto-fermeture, réservée au GRAVE (arbitrage 2026-06-11) : le compte à
  // rebours d'un Critique/d'une mutation se VOIT, l'informatif mineur disparaît sans cérémonie. Le
  // délai, lui, court pour les deux. `key` = l'étape, pour que l'animation CSS reparte à zéro d'une
  // étape à la suivante.
  const autoCloseBar = autoCloseMs != null && autoStep?.reveal?.severity === 'grave'
    ? <div className="reveal-timer" key={autoStepId}><i style={{ animationDuration: `${autoCloseMs}ms` }} /></div>
    : null;

  if (!p) return null;
  const pool: Combatant[] = battle?.combatants ?? party;
  const actorOf = (s: CascadeStep) => (s.actorId ? pool.find((c) => c.id === s.actorId) : undefined);
  // COOP : une rangée par participant n'est pilotable que par le siège qui possède son acteur (patron
  // `ShipManeuverModal`/`CrewTestModal`) — sinon l'affordance est morte (l'intent est refusé par l'hôte).
  const owns = (id: string) => net.mode === 'local' || ownsLocally(useGame.getState(), id);

  // Base AFFICHÉE + lignes de mod NOMMÉES d'une étape QUI LANCE (`CascadeRollStep` : cible ET libellé
  // de ligne par le TYPE) : le libellé est la COMPÉTENCE lancée (« Résistance », « Calme »…), comme
  // Défense affiche « Attaque »/« Parade » — pas le texte de l'étape (le but vit dans le sous-titre).
  // Le Soutien (LDB 12) arrive par DEUX voies selon le producteur de l'étape : la porte du seam pose
  // une `base` NUE et le Soutien DÉJÀ nommé dans `step.mods` (rien à défaire, `s.support` absent) ;
  // un flux qui bâtit son étape à la main le FOND encore dans `step.base` et le porte en `s.support`,
  // que `supportSplit` (primitive PARTAGÉE) en défait ici. La Difficulté, elle, n'est PAS un mod
  // (#1072) : elle voyage en donnée de LIGNE (`step.difficulty`, posée par la porte du seam et les flux).
  const stepLine = (s: CascadeRollStep): { label: string; base: number; mods: ModLine[] } => {
    const raw = s.base ?? s.target;
    const { base, mods } = supportSplit(raw, s.support);
    // Les modificateurs circonstanciels NOMMÉS de l'étape (`step.mods`) rejoignent le Soutien : un
    // malus RAW qui n'est pas une Difficulté se LIT sur la ligne, jamais fondu dans la cible.
    return { label: s.rollLabel, base, mods: [...mods, ...(s.mods ?? [])] };
  };
  const breakdown = (s: CascadeRollStep, r: CascadeRoll) => {
    const l = stepLine(s);
    // L'ÉCRÊTAGE mesuré à la construction (`step.clamped`) voyage avec la ligne : le réconciliateur
    // le NOMME (« plafond 99 ») au lieu de l'avouer « autres » (#1117).
    return testBreakdown(l.label, l.base, { roll: r.roll, target: s.target, sl: r.sl, success: r.success, ...(s.clamped ? { clamped: s.clamped } : {}) }, s.difficulty, l.mods, s.easedBy);
  };
  const pendingOf = (s: CascadeRollStep) => {
    const l = stepLine(s);
    return testPending(l.label, l.base, s.target, s.difficulty, l.mods, s.easedBy, s.clamped);
  };
  /** Étape qui LANCE — la ligne de jet n'existe que là (les étapes d'affichage/choix/table/batch
   *  n'ont ni cible ni libellé de ligne : elles se rendent par leur note). */
  const isRollStep = (s: CascadeStep): s is CascadeRollStep => s.target != null;
  // Conséquence (issue style journal) d'une étape — rendue sous le jet, elle PERSISTE quand on
  // enchaîne (« on ne perd pas les conséquences »). Une étape VALIDÉE porte sa conséquence RÉELLE
  // chiffrée dans `outcome` (lignes STRUCTURÉES #349 : « récupère 8 PB », « contracte : Vérole… »,
  // déjà tonées par leur `Consequence` d'origine, `rollSeam.resultLines`) → rendu par le renderer
  // PARTAGÉ (`RecapLineList`, `ui/RecapLine.tsx`), MÊME brique que `TravelDayBody`/`dayCardSummary`.
  // `cons` vide (#295 Décision 1b) ⇒ rien à noter : la rangée ✓/✗ ±DR (breakdown, ci-dessous) porte
  // SEULE le verdict — aucun repli « X réussit »/« X échoue ».
  const noteFor = (s: CascadeStep): ReactNode => {
    if (!s.outcome?.length) return undefined;
    return <RecapLineList lines={s.outcome} />;
  };
  const rowOf = (s: CascadeStep): PanelRow | null => {
    const a = actorOf(s);
    // Étape BATCH committée : sa conséquence (resultLine, #331) se lit SUR PLACE — note SEULE (pas de
    // RollLine mono factice `base 0` : le batch n'a ni acteur ni cible d'étape, le verdict est agrégé).
    if (s.participants) return s.outcome?.length ? { combatant: a, note: noteFor(s) } : null;
    if (s.result && isRollStep(s)) return { combatant: a, d: breakdown(s, s.result), note: noteFor(s) }; // jet validé
    if (s.outcome?.length) return { combatant: a, note: noteFor(s) }; // affichage/choix validé : note seule
    return null;
  };
  // Un panneau figé (`PanelRow` : breakdown + note) → rangées TÉMOINS du shell (`interactive:false`,
  // aucun cycle d'influence : jet déjà subi). Source unique de la conversion « pile figée → rangées ».
  const witnessRows = (panelRows: PanelRow[], fixedMark = false): RollRowData[] =>
    panelRows.map((r, i) => ({ key: i, row: r, rolled: true, interactive: false as const, fixedMark }));
  // DONNÉE de Test ÉTENDU d'une rangée (arbitrage user 2026-07-11 : la barre est RENDUE par `RollRow`
  // — site UNIQUE — pas ici ; ceci ne calcule que `{cum, target}`). `done` = DR cumulés AVANT ce jet,
  // `+ SL` du jet réussi. Générique : mono (`meta`) ou batch (participant), toute la CLASSE des jets étendus.
  const extendedDrData = (done: number | undefined, target: number | undefined, res: CascadeRoll | null | undefined): { cum: number; target: number } | undefined => {
    if (target == null) return undefined;
    const gain = res?.success ? Math.max(0, res.sl) : 0;
    // Un Test étendu SE TERMINE à la cible (LDB 12 l.170-186) : le cumul affiché est BORNÉ à la cible — un
    // jet de complétion à gros DR ne déborde pas la barre en « 5/2 »/« 6/2 » (F1). Site UNIQUE du datum.
    return { cum: Math.min((done ?? 0) + gain, Number(target)), target: Number(target) };
  };
  // Note de conséquence d'une rangée-participant (batch) : `part.outcome` (lignes STRUCTURÉES #349)
  // porte l'attribution par le portrait (pas de note agrégée à l'étape) — MÊME renderer partagé.
  const partNote = (part: Pick<BatchParticipant, 'outcome'>): ReactNode => {
    if (!part.outcome?.length) return undefined;
    return <RecapLineList lines={part.outcome} />;
  };
  // Rangées TÉMOINS d'un pas VALIDÉ (pile persistante) — un pas BATCH est DÉPLIÉ en une rangée par
  // participant (breakdown + sa note + sa barre de Test étendu PERSISTANTE) ; les autres pas → une rangée.
  const stepWitnessRows = (s: CascadeStep): RollRowData[] => {
    if (s.participants) {
      return s.participants.flatMap((part) => {
        const a = pool.find((c) => c.id === part.id);
        if (!a) return [];
        const res = part.result;
        const d = res ? { label: part.label ?? a.label, base: part.base, mods: part.mods, ...(part.difficulty ? { difficulty: part.difficulty } : {}), modifier: res.target - part.base, target: res.target, roll: res.roll, success: res.success, sl: res.sl } : undefined;
        const extendedDr = extendedDrData(part.extendedDrDone, part.extendedDrTarget, res);
        return [{ key: witnessRowKey(s.id, part.id), row: { combatant: a, d, note: partNote(part) }, rolled: true, interactive: false as const, ...(extendedDr ? { extendedDr } : {}) }];
      });
    }
    const pr = rowOf(s);
    if (!pr) return [];
    const extendedDr = extendedDrData(s.meta?.extendedDrDone as number | undefined, s.meta?.extendedDrTarget as number | undefined, s.result);
    // `fixedMark` : le dé de l'étape a été SAISI (option « Dés fixés ») — la marque suit le jet dans la
    // pile figée comme dans le journal (`step.fixed`, écrit par la fabrique de flux ou le mode table).
    return [{ key: witnessRowKey(s.id), row: pr, rolled: true, interactive: false as const, fixedMark: !!s.fixed, ...(extendedDr ? { extendedDr } : {}) }];
  };

  // Nombre de JETS DE DÉ réels (arbitrage user 2026-07-11) : un pas BATCH = ses N rangées ; un pas-jet
  // = 1 ; l'agrégation / la météo / les affichages = 0. Sert au « Bilan · N jets » et à « jet N/M ».
  const diceOf = (s: CascadeStep) => (s.participants ? s.participants.length : s.target != null || s.jet ? 1 : 0);
  const totalJets = p.participants.reduce((n, s) => n + diceOf(s), 0);

  // BILAN « Tout lancer » : curseur EN FIN — toutes les étapes résolues, chaque conséquence visible.
  // Un seul bouton « Terminer » (ferme + enchaîne la suite). Pas d'influence (jets déjà subis).
  // TITRE NEUTRE (arbitrage user 2026-08-06, #1117 : « Neutre "Bilan" ») : le récap couvre TOUS les
  // pas, il ne peut pas emprunter le nom d'un seul d'entre eux. Le compte de jets reste au
  // sous-titre, qui ne redit donc plus le mot du titre.
  if (p.cursor >= p.participants.length) {
    return (
      <RollShell
        title={<><Icon id={p.icon || 'nav/dice'} size="sm" /> Bilan</>}
        subtitle={<>{totalJets} jet{totalJets > 1 ? 's' : ''}</>}
        rolled
        rows={p.participants.flatMap(stepWitnessRows)}
        actions={[{ key: 'finish', label: 'Terminer', onClick: () => finish(), when: 'always' }]}
        embedded={embedded}
      />
    );
  }

  const cur = p.participants[p.cursor];
  if (!cur) return null;
  // ENJEU (#331/#1117) : ce que le jet de l'étape COURANTE met en jeu, ÉNONCÉ sous le titre AVANT le
  // jet (le mécanisme est déjà dans l'applier — cf. « on ne sait ni à quoi ça correspond »). L'étape
  // ne porte qu'une RÉFÉRENCE de donnée : la coquille `RollShell` la résout et rend la PHRASE
  // (`StakeNote`, zone Z3b, classe propriétaire `.rm-stake`).
  // Le RENVOI, lui, vit sur la LIGNE DE TITRE (arbitrage user 2026-08-06) : affordance compacte
  // accolée au libellé d'étape, pas un lien textuel sous la phrase. Sa cible se DÉRIVE de la même
  // entrée d'enjeu (`resolveStake`) ; une étape de CHOIX, sans enjeu, garde son `stakeRule` propre.
  const stakeProps = cur.stake ? { stake: cur.stake } : {};
  const stakeRule = (cur.stake ? resolveStake(cur.stake).rule : undefined) ?? cur.stakeRule;
  // TITRE = le pas COURANT (arbitrage user 2026-08-06, #1117). Une séquence APPEND (`pushStep`,
  // `state/cascade.ts`) et n'écrit son `title` qu'à la CRÉATION : la fenêtre resterait titrée par le
  // PREMIER pas pendant qu'on en joue un autre. Dérivation au RENDU (aucune écriture d'état) ; repli
  // sur le titre de séquence pour un pas sans libellé. Le titre porte l'icône du pas COURANT (elle
  // suit le même curseur) et le renvoi de règle, accolé au libellé d'étape (arbitrage user
  // 2026-08-06 : « Je pensais que tu allais mettre un "i" a coté de "Cauchemars" ») — même
  // déclencheur-icône que la barre d'action (`CodexRef` + glyphe `journal/info`), jamais un lien
  // textuel sous la phrase d'enjeu. La nuance de #1078 tient : les CHIPS restent leurs propres
  // portes (aucun ⓘ voisin) — ceci ne vaut que pour la ligne de TITRE. Le sous-titre, lui, ne garde
  // que la position (« jet N/M »).
  const modalTitle = cur.label ?? p.title;
  const titleNode = (
    <>
      <Icon id={cur.icon || p.icon || 'nav/dice'} size="sm" /> {modalTitle}
      {cur.label && stakeRule ? <StakeRule rule={stakeRule} label={modalTitle} /> : null}
    </>
  );
  // ENCADRÉ « Réussite / Échec » en régime CALCULÉ (#1117) : les deux fabriques d'étape
  // `triggeredTest` (`state/combat/triggeredTest.ts`) SÉRIALISENT déjà les Flows de branche dans le
  // `meta` — l'encadré se DÉRIVE donc de leurs ops effectives (`branchCertainOps` → `GameOpChips`),
  // règles optionnelles comprises, au lieu d'être une phrase stockée qui mentirait dès qu'une option
  // change le comportement. Rendu SEULEMENT quand au moins une branche est certaine.
  // Le repli des Conditions se fait contre le combattant de l'étape (et son référent `casterId`) :
  // une branche gardée par un `if` d'appartenance a une réponse POUR LUI. Une fois le jet tranché
  // (`cur.result`), le MÊME encadré se filtre à la branche réalisée : c'est le verdict, et il est
  // structurellement le même objet que la promesse d'avant le jet.
  const stepActor = actorOf(cur);
  const stepCaster = typeof cur.meta?.casterId === 'string' ? pool.find((c) => c.id === cur.meta!.casterId) : undefined;
  const outcomeNote = (
    <OutcomeNote
      onSuccess={branchCertainOps(cur.meta?.onSuccess, stepActor, stepCaster)}
      onFail={branchCertainOps(cur.meta?.onFail, stepActor, stepCaster)}
      {...(cur.result ? { realized: cur.result.success ? ('success' as const) : ('fail' as const) } : {})}
    />
  );
  // Le MÊME encadré, pour UNE RANGÉE d'une bande (étape BATCH) : la promesse et le verdict sont
  // PAR PARTICIPANT (chaque rangée gagne ou perd son propre jet), et se replient contre SON acteur.
  const rowOutcomeNote = (partId: string, res: CascadeRoll | null) => (
    <OutcomeNote
      onSuccess={branchCertainOps(cur.meta?.onSuccess, pool.find((c) => c.id === partId), stepCaster)}
      onFail={branchCertainOps(cur.meta?.onFail, pool.find((c) => c.id === partId), stepCaster)}
      {...(res ? { realized: res.success ? ('success' as const) : ('fail' as const) } : {})}
    />
  );
  // Test OPPOSÉ (#579/#990) : le jet ADVERSAIRE FIGÉ (`meta.opposed.aT`) est une rangée TÉMOIN, masquée
  // tant que ce siège n'a pas répondu. Il vaut pour l'étape ENTIÈRE — une bande de N défenseurs
  // s'oppose à un SEUL jet (LDB 13 l.77), donc la rangée est la MÊME et se pose EN TÊTE, une fois.
  const opp = cur.meta?.opposed;
  const oppActor = opp?.attackerId ? pool.find((c) => c.id === opp.attackerId) : undefined;
  const oppResponders = cur.participants
    ? cur.participants.map((p) => ({ id: p.id, interactive: p.interactive !== false, result: p.result }))
    : [{ id: cur.actorId, interactive: true, result: cur.result }];
  const oppRow: RollRowData | null = opp ? {
    key: 'opposed-attacker',
    ...frozenOpposedRow(useGame.getState(), {
      ownerId: opp.attackerId,
      responded: opposedResponded(useGame.getState(), oppResponders),
      row: {
        combatant: oppActor,
        // Ligne d'un Test OPPOSÉ : Difficulté déclarée UNE fois à la fabrique (LDB 12 l.166) — celle
        // de l'opposition, portée par le freeze, donc LUE des deux côtés (le camp qui a pré-jeté
        // l'affichait « Intermédiaire » par défaut tant qu'elle ne voyageait pas). Base NUE de
        // l'attaquant (`aT.base`) pour que le modificateur de Difficulté se lise sur la ligne.
        ...opposedLines([{
          label: opp.attackerName ? (opp.attackerLabel ? `${opp.attackerName} — ${opp.attackerLabel}` : opp.attackerName) : (opp.attackerLabel ?? 'Adversaire'),
          base: opp.aT.base ?? opp.aT.target,
          r: { roll: opp.aT.roll, target: opp.aT.target, sl: opp.aT.sl, success: opp.aT.success },
        }], opp.difficulty)[0],
      },
    }),
  } : null;
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
  /** Rangées de l'étape COURANTE, coupées de la pile des étapes validées par un filet titré
   *  (`RuleDivider`, primitive d'ornement partagée) : la prose d'une conséquence déjà appliquée ne
   *  doit pas se lire comme la légende du tirage en cours. Sans pile, rien à couper. */
  const currentRows = (rows: RollRowData[]): RollRowData[] =>
    doneWitnessRows.length && rows.length
      ? [{ ...rows[0], separator: <RuleDivider label="Étape en cours" /> }, ...rows.slice(1)]
      : rows;

  // MODE TABLE (#942 L3) — les DEUX affordances de POSE du dé d'une étape à table, une seule
  // sémantique (POSER LE DÉ) et un seul délégué : le champ « Fixer le dé » (sélecteur dérivé par la
  // COUTURE UNIQUE `tableStepForcedDie` — gate `canFixDie`, borne = les faces du dé, valeur
  // ré-éditable) et la grille des LIGNES (clic = le dé naturel qui atteint cette ligne, `mod`
  // compris — sinon la ligne cliquée glisserait sous le modificateur). Servies AVANT le tirage comme
  // APRÈS (l'étape passe alors en interaction `'affichage'`) : un dé posé se corrige, il ne se subit pas.
  const tableAffordances = (s: CascadeStep): { rows: RollRowData[]; lines: ReactNode } => {
    // La déclaration servie à l'écran est celle qui TIRERA (`liveTableDecl` : modificateur vivant) —
    // une grille calculée sur un `mod` périmé ferait glisser la ligne cliquée.
    const decl = s.table && liveTableDecl(useGame.getState(), s);
    if (!decl) return { rows: [], lines: null };
    const die = tableStepForcedDie(useGame.getState(), s, (r) => tableSetForcedRoll(s.id, r));
    if (!die.forcedRoll) return { rows: [], lines: null };
    const mod = decl.mod ?? 0;
    const dieMax = tableStepDie(decl);
    const options: RollOption[] = (tableStepDefs[decl.tableId]?.rows ?? []).map((r) => {
      const nat = naturalRollForTableRow(decl, r);
      return {
        key: r.id,
        /* La FOURCHETTE est portée par la tuile, libellé ou pas : c'est ce qui fait lire une table
           d100 (« Corps 01-50 / Esprit 51-100 ») au lieu d'un choix binaire libre. */
        label: <>{r.label ? `${r.label} ` : ''}<span className="rm-range">{fourchette(r.min, r.max, dieMax)}</span></>,
        disabled: nat == null,
        primary: decl.result?.id === r.id,
        selected: decl.result?.id === r.id, // ligne ÉLUE = état ferré (aria-pressed), pas un simple style
        describedBy: nat == null ? `${s.id}-unreachable` : undefined,
        title: nat == null
          ? `Hors d'atteinte : avec le modificateur ${mod > 0 ? '+' : ''}${mod}, aucun dé de 1 à ${dieMax} ne tombe dans [${r.min}-${r.max}]`
          : `Poser le dé à ${nat}${mod !== 0 ? ` (dé effectif ${nat + mod})` : ''}`,
        onSelect: nat == null ? undefined : () => tableSetForcedRoll(s.id, nat),
      };
    });
    const unreachable = options.filter((o) => o.disabled).length;
    return {
      // Rangée porteuse du SEUL sélecteur (un tirage sur table n'a ni cible ni DR à pré-afficher) :
      // `rolled:false` sans `onRoll` → ni bouton de rangée, ni « Lancer » hissé, ni cycle d'influence.
      rows: [{ key: `${s.id}:die`, row: { combatant: actorOf(s) }, rolled: false, forcedRoll: die.forcedRoll, fixedMark: die.fixedMark }],
      lines: (
        <>
          <OptionChooser layout="grid" groupLabel="Choisir la ligne" options={options} />
          {/* La RAISON du grisage se lit à l'écran, jamais au seul `title` : au doigt et au clavier,
              une ligne éteinte sans explication est une affordance morte (patron `GatedAction`). */}
          {unreachable > 0 && (
            <p className="hint" id={`${s.id}-unreachable`}>
              {unreachable} ligne{unreachable > 1 ? 's' : ''} grisée{unreachable > 1 ? 's' : ''} : hors d'atteinte avec le modificateur {mod > 0 ? '+' : '−'}{Math.abs(mod)} (dé de 1 à {dieMax}).
            </p>
          )}
        </>
      ),
    };
  };

  // TABLE (#942 L2) : dé NON JETÉ sur le tableau déclaré (`cur.table`) — bouton de jet
  // standard, la rangée `TableRollLine` annonce SUR QUOI on tire (le résultat s'y inscrira). Le tirage
  // naturel reste le DÉFAUT : les affordances de pose (#942 L3) s'ajoutent, ne remplacent rien.
  if (interaction === 'table') {
    const def = tableStepDefs[cur.table!.tableId];
    const aff = tableAffordances(cur);
    const tableActions: RollAction[] = [
      { key: 'roll', label: <><Icon id="nav/dice" size="sm" /> Lancer</>, onClick: () => tableRoll(cur.id), when: 'pre' },
      ...(!isLast ? [{ key: 'all', label: <><Icon id="nav/dice" size="sm" /> Tout lancer</>, onClick: () => resolveAll(), title: "Résoudre d'un coup tous les jets restants (sans influence)", when: 'always' } as RollAction] : []),
    ];
    return (
      <RollShell
        title={titleNode}
        subtitle={stepSubtitle({ cursor: p.cursor, total: p.participants.length })}
        rolled={false}
        rows={[...doneWitnessRows, ...currentRows(aff.rows)]}
        extra={<TableRollLine table={tableLineLabel(def?.label, cur.label, modalTitle)} />}
        setup={aff.lines}
        actions={tableActions}
        disableEscClose
        embedded={embedded}
      />
    );
  }

  // AFFICHAGE : conséquence pure — pas de jet, pas d'influence. Charge RICHE (`reveal` : Coup Critique,
  // entretien de Round, mutation, effet d'auteur, entrée de zone) → panneau partagé `RevealBody`, routé
  // par `kind` ; sinon contenu pré-posé (`outcome`) en note. TABLE déjà tirée (`table.result`) → la
  // rangée `TableRollLine` (dé + ligne atteinte) puis le reste des lignes de l'entrée : même
  // présentation canonique que la Maladresse et les révélations.
  if (interaction === 'affichage') {
    const rev = cur.reveal;
    if (rev) {
      const revActor = rev.actorId ? pool.find((c) => c.id === rev.actorId) : undefined;
      const revSubject = rev.subjectId ? pool.find((c) => c.id === rev.subjectId) : undefined;
      return (
        <RollShell
          title={titleNode}
          subtitle={stepSubtitle({ cursor: p.cursor, total: p.participants.length })}
          rolled
          /* Le CONCERNÉ (`RevealEntry.subjectId`) porte son portrait EN TÊTE de l'étape : on sait
             toujours à qui la révélation s'applique. Le Coup Critique le rend déjà dans son en-tête
             A→B (`CriticalBody`) — une seule surface, jamais deux portraits du même sujet. */
          extra={revSubject && rev.kind !== 'critical' ? <ModalSubject c={revSubject} /> : undefined}
          rows={doneWitnessRows}
          postRollExtra={<><RevealBody entry={rev} actor={revActor} subject={revSubject} />{autoCloseBar}</>}
          actions={[continueAction]}
          disableEscClose
          embedded={embedded}
        />
      );
    }
    const tbl = cur.table?.result;
    // Étape à TABLE déjà tirée : les affordances de POSE restent servies tant que l'étape est
    // COURANTE (le dé se re-pose, la ligne se re-choisit) — le tirage n'est pas un aller sans retour.
    const aff = tableAffordances(cur);
    return (
      <RollShell
        title={titleNode}
        subtitle={stepSubtitle({ cursor: p.cursor, total: p.participants.length })}
        rolled
        /* La marque « dé fixé » n'a qu'UNE surface : l'étiquette du sélecteur quand il est servi,
           la pastille de rangée sinon (siège voisin, option éteinte). */
        rows={[...doneWitnessRows, ...currentRows([...witnessRows([{ combatant: actorOf(cur), note: noteFor(cur) }], !!cur.fixed && !aff.rows.length), ...aff.rows])]}
        /* `extra` est la zone STABLE de l'étape à table : l'état AVANT tirage la sert déjà (branche
           `table` ci-dessus), celui-ci l'ÉPAISSIT du résultat. Une zone stable qui grossit respecte
           l'invariant de géométrie (`docs/charte-ui.md` § « Invariant de GÉOMÉTRIE d'une fenêtre de
           jet ») — c'est `postRollExtra` qui en ferait une zone à présence dépendante de la phase. */
        /* VALEUR EN TÊTE : la rangée de tirage (dé + opération + ligne atteinte) est le PREMIER
           contenu de l'étape résolue — c'est le verdict, il ne se cherche pas sous une grille. */
        extra={tbl ? (
          <>
            <TableRollLine table={tableLineLabel(tableStepDefs[cur.table!.tableId]?.label, cur.label, modalTitle)} roll={tbl.roll} die={tbl.die} mod={cur.table!.mod ?? 0} result={tbl.lines[0] ?? ''} />
            {tbl.lines.slice(1).map((l, i) => <p key={i} className="rm-log">{l}</p>)}
            {aff.lines}
          </>
        ) : undefined}
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
        title={titleNode}
        subtitle={stepSubtitle({ cursor: p.cursor, total: p.participants.length })}
        rolled
        rows={doneWitnessRows}
        postRollExtra={
          <>
            {rev?.kind === 'critical' && <CriticalBody entry={rev} actor={revActor} subject={revSubject} />}
            {!rev && cur.outcome?.length ? <RecapLineList lines={cur.outcome} /> : null}
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
    // ANNONCE MUTUALISÉE de la bande (arbitrage user 2026-08-09, en jeu : « "Réussite : rien. / Échec :
    // Surpris" sur chaque ligne de test c'est normal ? ») : une promesse IDENTIQUE répétée sur N rangées
    // est du bruit — à la table, elle s'annonce UNE fois. Les rangées PAS ENCORE jouées qui annoncent la
    // MÊME chose (égalité STRUCTURELLE des ops certaines, `sameCertainOps` — jamais le HTML rendu) sont
    // regroupées : leur bloc monte en tête de bande (zone `extra`, sous l'enjeu) et disparaît de leurs
    // lignes. Restent PAR RANGÉE : (a) une rangée qui DIVERGE avant le jet (porteur de Vigilance : sa
    // branche d'échec est indécidable, donc silencieuse) ; (b) le VERDICT d'une rangée résolue, individuel
    // par nature. Quand toutes les rangées ont joué, l'annonce n'a plus d'objet et s'efface.
    const bandOps = (partId: string) => {
      const a = pool.find((c) => c.id === partId);
      return { onSuccess: branchCertainOps(cur.meta?.onSuccess, a, stepCaster), onFail: branchCertainOps(cur.meta?.onFail, a, stepCaster) };
    };
    const groupes: { ops: ReturnType<typeof bandOps>; ids: string[] }[] = [];
    for (const part of cur.participants!.filter((x) => !x.result)) {
      const o = bandOps(part.id);
      const g = groupes.find((x) => sameCertainOps(x.ops.onSuccess, o.onSuccess) && sameCertainOps(x.ops.onFail, o.onFail));
      if (g) g.ids.push(part.id); else groupes.push({ ops: o, ids: [part.id] });
    }
    // Le groupe HISSÉ est le plus nombreux, et seulement s'il couvre ≥ 2 rangées : mutualiser une
    // annonce unique la déplacerait loin de sa ligne sans rien économiser.
    const mutualise = groupes.filter((g) => g.ids.length >= 2).sort((a, b) => b.ids.length - a.ids.length)[0];
    const bandNote = mutualise ? <OutcomeNote onSuccess={mutualise.ops.onSuccess} onFail={mutualise.ops.onFail} /> : null;
    // Rangées-participants via le builder mutualisé (#328) : la modale ne fournit QUE la PRÉSENTATION
    // (label/base/mods déjà résolus à la construction, GÉNÉRIQUES) + son bundle d'actions de flux ; les
    // dérivations d'éligibilité (rerollable/darkPactable/forceShow) vivent dans `buildParticipantRows`.
    // Clés SCOPÉES PAR ÉTAPE (`witnessRowKey`) : la rangée batch COURANTE côtoie les rangées FIGÉES d'un
    // pas batch précédent aux MÊMES participants (Orientation puis Entretien) — sans scope, collision de
    // clé + duplication visuelle. `buildParticipantRows` keye par id nu (correct pour ses 6 autres
    // appelants MONO-étape) ; ici on re-scope au site qui compose plusieurs pas.
    // Rangées du flux `cascadeBatch` (la coquille hôte porte la cascade) : `flowKey` de RANGÉE.
    const rows: RollRowData[] = buildParticipantRows(cur.participants!, pool, {
      onRoll: batchRoll, onReroll: batchReroll, onBonusSL: batchBonusSL, onDarkPact: batchDarkPact, onForce: batchForce,
      interactiveOf: (part) => part.interactive !== false && owns(part.id),
      row: (part, actor, res) => {
        const label = part.label ?? actor.label;
        return res
          ? { combatant: actor, d: { label, base: part.base, mods: part.mods, ...(part.difficulty ? { difficulty: part.difficulty } : {}), modifier: res.target - part.base, target: res.target, roll: res.roll, success: res.success, sl: res.sl } }
          : { combatant: actor, pending: { label, base: part.base, mods: part.mods ?? [], ...(part.difficulty ? { difficulty: part.difficulty } : {}) } };
      },
      // ISSUES de la rangée (#1117) : la MÊME dérivation que l'étape MONO, mais PAR PARTICIPANT — le
      // VERDICT d'une rangée résolue et la promesse d'une rangée DIVERGENTE. Une rangée dont l'annonce est
      // montée en tête de bande n'a plus rien à dire ici : elle se tait plutôt que de répéter.
      issues: (part) => (!part.result && mutualise?.ids.includes(part.id) ? undefined : rowOutcomeNote(part.id, part.result)),
      // Test ÉTENDU d'une rangée (cartographie de voyage) : DONNÉE seule — `RollRow` rend la barre (site
      // UNIQUE), visible AVANT et après le jet, persistante (arbitrage user 2026-07-11).
      extendedDrOf: (part) => extendedDrData(part.extendedDrDone, part.extendedDrTarget, part.result),
    }).map((r) => ({ ...r, flowKey: 'cascadeBatch' as const, key: witnessRowKey(cur.id, String(r.key)) }));
    const ready = stepReady(cur);
    // Deux « Tout lancer » (#328) : PAR RANGÉES (lance d'un coup les contributeurs restants de CETTE
    // étape, ≥2 non lancés — mutualisé) et CASCADE (résout d'office tout le reste de la cascade, sans
    // influence — `cascadeResolveAll`, comme la branche jet).
    const rollAllRows = rollAllUnrolledRows(cur.participants!, batchRoll, (x) => x.interactive !== false && owns(x.id));
    const batchActions: RollAction[] = [
      ...(rollAllRows ? [{ key: 'rollRows', label: <><Icon id="nav/dice" size="sm" /> Tout lancer</>, onClick: rollAllRows, title: 'Lancer toutes MES rangées non encore lancées (les rangées d’un autre siège lui restent)', when: 'always' } as RollAction] : []),
      ...(!isLast ? [{ key: 'all', label: <><Icon id="nav/dice" size="sm" /> Tout résoudre</>, onClick: () => resolveAll(), title: "Résoudre d'un coup tous les jets restants de la cascade (sans influence)", when: 'always' } as RollAction] : []),
      ...(ready ? [continueAction] : []),
    ];
    return (
      <RollShell
        title={titleNode}
        subtitle={stepSubtitle({ cursor: p.cursor, total: p.participants.length })}
        {...stakeProps}
        extra={bandNote}
        rolled={ready}
        rows={[...doneWitnessRows, ...(oppRow ? [oppRow] : []), ...rows]}
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
  const curPending: PanelRow = { combatant: actor, ...(isRollStep(cur) ? { pending: pendingOf(cur) } : {}) };
  // `outcome` (résumé de conséquence) n'existe que sur une étape COMMITTÉE ; l'étape COURANTE
  // s'appuie sur la rangée ✓/✗ ±DR (breakdown) comme SEUL verdict (#295 Décision 1b) : aucun
  // prologue « X réussit »/« X échoue » ici.
  // Résistance (Menace) (LDB 10) : étape taguée `menace` + spec du talent disponible (non consommée
  // cette séance) + issue encore défavorable → auto-succès offert (avant le jet ou après un échec).
  const resistAvail = !!actor && cur.menace != null && availableResistance(actor, cur.menace) != null && (!res || !res.success);

  // En-tête A→B du Test opposé : il n'existe QUE pour un défenseur unique (une bande n'a pas de « B »
  // — chaque rangée porte son portrait, la rangée témoin porte l'attaquant).
  const oppHeader = opp && oppActor && actor ? <VsHeader actor={oppActor} target={actor} label={opp.attackerLabel} /> : null;

  // Rangée INTERACTIVE de l'étape COURANTE : pré-jet en attente puis résultat, porteuse du cycle
  // d'influence (Chance/+1 DR/Pacte/Résilience/forcedRoll/resist/Détermination) — étape MONDIALE
  // (`worldOwner`, `actor` absent) : cycle d'influence NUL (Chance/Pacte/Résilience/Détermination
  // sont des ressources de HÉROS), seul « Lancer » reste actionnable pour le siège owner.
  // DONNÉE de Test étendu de CETTE rangée (arbitrage user 2026-07-11 : `RollRow` rend la barre, site
  // UNIQUE ; persistée via `stepWitnessRows`, elle reste lisible aux pas suivants).
  const curExtendedDr = extendedDrData(cur.meta?.extendedDrDone as number | undefined, cur.meta?.extendedDrTarget as number | undefined, res);
  const curRow: RollRowData = {
    // Étape COURANTE du flux `cascade` : `key` = son id de slot → `RollShell` dérive le sélecteur
    // de dé sur la BONNE étape (la coquille n'a pas de `flowKey` propre).
    flowKey: 'cascade',
    key: cur.id,
    actor,
    row: res && isRollStep(cur) ? { combatant: actor, d: breakdown(cur, res) } : curPending,
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
    // Psychologie (rencontre OU combat) : Détermination (immunité, LDB 17 l.62) AVANT le jet.
    determination: actor && !res && (cur.encounterPsych || cur.combatPsych) ? { resolve: actor.resolve ?? 0, onResolve: () => determine(cur.id) } : undefined,
  };

  const jetActions: RollAction[] = [
    // « Tout lancer » : tant qu'il reste >1 jet, résout d'un coup le reste (RNG, sans influence) PUIS
    // montre le bilan — bouton PRÉSENT avant ET après le jet (parité `cancelAfterRoll`). Pas d'Échap :
    // la cascade est SUBIE, on ne ferme pas — le bouton est une action explicite, pas une sortie.
    ...(!isLast ? [{ key: 'all', label: <><Icon id="nav/dice" size="sm" /> Tout lancer</>, onClick: () => resolveAll(), title: "Résoudre d'un coup tous les jets restants (sans influence)", when: 'always' } as RollAction] : []),
    // Poursuite terrestre (purpose:'pursuite') : renoncer coûte la manche — le groupe qui FUIT se
    // laisse rattraper (combat si une rencontre est fournie, LDB 15 l.94) ; côté poursuivant, la
    // proie s'échappe (state/pursuitFlow.pursuitAbandon porte la vraie conséquence).
    ...(p.purpose === 'pursuite' ? [{
      key: 'break',
      label: pursuit?.partyRole === 'pursuing' ? 'Abandonner la poursuite' : 'Abandonner la fuite',
      onClick: () => pursuitAbandon(),
      title: pursuit?.partyRole === 'pursuing'
        ? 'Le groupe renonce à traquer sa proie — la poursuite est perdue.'
        : pursuit?.encounter
          ? 'Le groupe cesse de fuir et fait face — les poursuivants fondent sur lui.'
          : 'Le groupe cesse de fuir et fait face.',
      when: 'always',
    } as RollAction] : []),
    { key: 'next', label: isLast ? 'Terminer' : 'Continuer', onClick: () => next(), when: 'post' },
  ];

  return (
    <RollShell
      title={titleNode}
      /* « jet N/M » : N = jets de dé jusqu'ici + celui-ci, M = total des jets RÉELS (arbitrage user
         2026-07-11 — l'agrégation/la météo/les affichages ne comptent pas). */
      subtitle={stepSubtitle({
        cursor: p.participants.slice(0, p.cursor).reduce((n, s) => n + diceOf(s), 0),
        total: totalJets,
        prefix: 'jet ',
      })}
      {...stakeProps}
      extra={<>{oppHeader}{outcomeNote}</>}
      rolled={rolled}
      /* Rangées : validées FIGÉES (témoins) + rangée de l'adversaire figé (Test opposé, #579) + courante
         interactive (pré-jet en attente, post-jet résolue). La barre de Test étendu appartient à la
         RANGÉE qui cumule (`curRow.extendedDr`). */
      rows={[...doneWitnessRows, ...(oppRow ? [oppRow] : []), curRow]}
      actions={jetActions}
      disableEscClose
      embedded={embedded}
    />
  );
}
