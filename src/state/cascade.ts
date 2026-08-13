/**
 * CASCADE séquentielle influençable — cœur générique (régime choisi par l'utilisateur pour les jets
 * de NUIT et de VOYAGE : un jet à la suite de l'autre, chacun influençable par la Chance/Résilience/
 * Pacte, AVANT que sa conséquence ne soit validée). Cf. docs/superpowers/specs/2026-06-14-multi-roll-
 * modal-design.md, Étape 3.
 *
 * Le JET d'une étape est kind-agnostique (Test « +0 » sur `step.target`, géré par `FLOWS.cascade`).
 * La CONSÉQUENCE d'une étape dépend de son `kind` et vit dans le REGISTRE `cascadeAppliers` (code,
 * identique hôte/invité — jamais une closure dans le pending, qui est snapshoté/transmis en coop).
 * Une conséquence peut INSÉRER des étapes suivantes (dépendance : un abri réussi réduit le nombre de
 * jets d'Exposition des campeurs).
 *
 * Deux pilotes du MÊME plan d'étapes (zéro duplication de la logique de conséquence) :
 *  - INTERACTIF (`advanceCascade` au fil de la modale `CascadeModal`) — nuit d'une journée, halte ;
 *  - IMMÉDIAT (`runCascadeImmediate`) — repos de plusieurs jours, reprise auto, triche de recette :
 *    on lance chaque étape (RNG, sans influence) et on applique sa conséquence, sans modale.
 */
import type { Get, Set } from './flowTypes';
import type { GameState } from './store';
import type { Combatant } from '../engine/types';
import { roll, type RNG } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import type { CascadeStep, PendingCascade, CascadeRoll, BatchParticipant, CascadeAggregate, CascadeTableDecl, CascadeTableResult, OpposedRowFreeze } from './pendings';
import type { StakeRef } from '../data';
import type { Consequence } from './rollSeam';
import type { BuiltCascadeStep } from './stepBrand';
import { resultLines } from './rollSeam';
import { toRecapLines } from './recapLine';
import { actorIn } from './combatants';
import { rollTest, evaluateTest, bestForcedRoll, resolveOpposed, opposedBranchSuccess, type TestResult } from '../engine/tests';
import { battleRng } from './battleRng';
import { traceLineOf } from '../engine/traceLine';

/**
 * Conséquence d'une étape, appliquée à la VALIDATION. Mute le héros (via get/set), renvoie les
 * conséquences (rendues par `resultLine`, #295 Lot 0) et d'éventuelles étapes à INSÉRER juste après
 * l'étape courante (dépendance). Vit dans le registre — pas dans le pending (coop). `step.result` est
 * garanti non-null si `step.target != null`. `ctx` donne les étapes DÉJÀ jouées
 * (`ctx.steps[0..index-1]` committées) : une escalade cumulative (Exposition au froid : 1ᵉʳ échec →
 * −10 CT/Ag/Dex, 2ᵉ → reste, 3ᵉ → Blessures) lit le nombre d'échecs précédents de CE héros — c'est
 * cette dépendance qui rend la séquence séquentielle.
 *
 * `consequences` (`Consequence[]`, rendu par `resultLine`) est la SEULE voie de dénouement — aucun
 * canal de chaîne libre n'existe dans ce type, le compilateur interdit toute réapparition.
 *
 * `insert` est MURÉ (#1262 V2) : une étape insérée porte la marque `BuiltCascadeStep`, donc elle sort
 * d'un constructeur de la porte (`rollSeam`/`revealStep`) — un littéral d'étape monté à la main dans
 * une conséquence ne compile plus. C'est le second canal d'entrée d'étapes du moteur, après la file
 * (`openSequence`) : les deux sont désormais fermés par le type.
 */
export type CascadeApplier = (
  get: Get,
  set: Set,
  step: CascadeStep,
  hero: Combatant | undefined,
  ctx: { steps: CascadeStep[]; index: number },
) => { consequences?: Consequence[]; insert?: readonly BuiltCascadeStep[] } | void;

/** Une entrée de registre : la conséquence appliquée (`apply`) seule. L'affichage de l'issue de
 *  modale a pour source UNIQUE `resultLine`/`Consequence[]` (#295 Lot 2 : `cons` vide ⇒ `''`, la
 *  rangée ✓/✗ ±DR porte alors seule le verdict), sans repli de secours. Ajouter un
 *  kind ne touche JAMAIS l'UI. */
export interface CascadeKind {
  apply: CascadeApplier;
}

/** Registre par `kind` — source unique extensible (+1 entrée par nature d'étape : `apply`).
 *  Peuplé par les modules de domaine (restFlow, travelFlow) à leur chargement et par les tests. */
export const cascadeAppliers: Record<string, CascadeKind> = {};

/** Enregistre (ou remplace) la conséquence d'un `kind` d'étape de cascade. */
export function registerCascadeApplier(kind: string, apply: CascadeApplier): void {
  cascadeAppliers[kind] = { apply };
}

/**
 * Registre des PRÉDICATS DE SUCCÈS d'une étape batch sommée — INVERSION de dépendance, patron
 * `cascadeAppliers` : le seuil de succès d'un domaine (naval : `crewTestSuccess`, MDG 14 l.13, seuil
 * réglable par règle optionnelle) est FOURNI par le flux propriétaire, la machinerie générique ne
 * connaît que l'id. L'étape porte l'id (`meta.aggregateSuccessRule`, chaîne SÉRIALISABLE) et non la
 * fonction : un pending est snapshoté en JSON (sauvegarde, coop) — une closure y serait effacée en
 * silence et l'étape retomberait sur un seuil qui n'est pas le sien.
 */
export const cascadeSuccessRules: Record<string, (sl: number) => boolean> = {};

/** Enregistre (ou remplace) le prédicat de succès d'un id de règle d'agrégat. */
export function registerCascadeSuccessRule(id: string, succeeds: (sl: number) => boolean): void {
  cascadeSuccessRules[id] = succeeds;
}

/** ÉMETTEUR `onOwnTestFailed` INJECTÉ (inversion de dépendance, patron `testRouter`) : `commitStep` déclenche
 *  le trigger pour l'acteur d'une étape à jet raté SANS importer `triggeredEffects` (qui rebouclerait
 *  cascade↔triggeredEffects→combatFlow→cascade). Câblé par `combatFlow` (effet de bord au chargement). */
type OwnTestFailedEmitter = (get: Get, actor: Combatant, sl: number) => string[];
let ownTestFailedEmitter: OwnTestFailedEmitter | undefined;
export function setOwnTestFailedEmitter(fn: OwnTestFailedEmitter): void { ownTestFailedEmitter = fn; }

/**
 * Conséquence d'une ISSUE de TEST ÉTENDU (`PendingExtendedTest.outcome`, #273 Étape 1) — calque exact
 * de `CascadeApplier` ci-dessus (mute get/set, renvoie des `Consequence[]`), appliquée à la CLÔTURE du
 * Test étendu (`extendedTestNext`, store.ts) qu'il ait atteint sa cible OU buté sur `maxAttempts`.
 * `reached` = `total ≥ targetDR` ; `false` = borne d'essais épuisée sans réussir (Commerce d'opportunité,
 * MDG 15 : « 10 DR en ≤ 3 tentatives » — l'échec de la borne EST une issue, jamais une boucle infinie).
 * Registre séparé de `cascadeAppliers` (un Test étendu n'est PAS une étape de cascade — `pendingExtendedTest`
 * coexiste comme porteur de données à côté d'une cascade-hôte à 1 étape `jet:'extended'`).
 */
export type ExtendedTestOutcomeApplier = (
  get: Get,
  set: Set,
  p: import('./pendings').PendingExtendedTest,
  total: number,
  reached: boolean,
) => { consequences?: Consequence[] } | void;

/** Registre par `kind` (`PendingExtendedTest.outcome.kind`) — source unique extensible, kind-agnostique. */
export const extendedTestOutcomeAppliers: Record<string, ExtendedTestOutcomeApplier> = {};

/** Enregistre (ou remplace) l'issue de domaine d'un `kind` de Test étendu. */
export function registerExtendedTestOutcome(kind: string, apply: ExtendedTestOutcomeApplier): void {
  extendedTestOutcomeAppliers[kind] = apply;
}

/**
 * REGISTRE des TABLES tirables par une étape (`CascadeStep.table.tableId`) — source unique
 * extensible, peuplée par les modules de DOMAINE à leur chargement (comme `cascadeAppliers`) : le
 * cœur générique ne nomme aucune table. `rows` porte les fourchettes `[min,max]` + l'id STABLE de
 * chaque ligne (le lookup est `findTableEntry`, brique partagée) ; `lines` rend les lignes
 * d'affichage de la ligne tirée, formatées par le MOTEUR du domaine (source unique du texte).
 *
 * Distinct du registre des tables d'EFFETS (`data/effectTables.ts`, `findEffectTableById`) : celui-là
 * résout des lignes `{min,max,ops}` — un `GameOp[]` appliqué à une cible, sans id de ligne stable ni
 * issue hors-ops (Effondrement, note verbatim). Les deux partagent la brique de lookup, pas la forme.
 */
export interface TableStepRow {
  min: number;
  max: number;
  /** id STABLE de la ligne (toute logique s'y attache — jamais le libellé). */
  id: string;
  /** Libellé de la ligne — AFFICHAGE seul (picker de lignes). Les `rows` sont passées PAR RÉFÉRENCE
   *  depuis la donnée du domaine (`STRUCTURE_CRITICALS` porte déjà son `label`) : zéro duplication. */
  label?: string;
}

export interface TableStepDef {
  /** Libellé de la table (rangée `TableRollLine`). */
  label: string;
  /** Faces du dé (défaut 100) — une déclaration d'étape peut le surcharger. */
  die?: number;
  rows: TableStepRow[];
  /** Lignes d'affichage de la ligne atteinte par le dé EFFECTIF (formatage du moteur de domaine). */
  lines: (effectiveRoll: number) => string[];
  /** Catégorie Codex où vivent les LIGNES de cette table (`criticalsTete`, `mutations`,
   *  `interludeEvents`…). Déclarée ICI parce que la table est le seul endroit qui la connaisse : un
   *  même `kind` d'étape tire sur N tables (une Blessure critique se joue sur celle de SA
   *  Localisation). C'est elle qui fait DESCENDRE l'enjeu à la ligne jouée après le tirage
   *  (`stakeAtTableRow`) ; absente, l'enjeu reste au foyer du `kind`. */
  entryCategory?: string;
}

export const tableStepDefs: Record<string, TableStepDef> = {};

/** Enregistre (ou remplace) une table tirable par une étape. */
export function registerTableStep(tableId: string, def: TableStepDef): void {
  tableStepDefs[tableId] = def;
}

/**
 * DÉCLARATION RÉSOLUE à l'instant du tirage — SITE UNIQUE qui compose une `CascadeTableDecl` : le
 * modificateur VIVANT (`modPerActor` : `factor` × le compteur de l'ACTEUR de l'étape) est versé dans
 * `mod`, qui reste additif. Tout pilote de tirage passe par ici, et la surface qui OFFRE la pose
 * (mode table) aussi : sinon la ligne montrée et la ligne appliquée divergeraient dès que le
 * compteur bouge entre l'ouverture de l'étape et le dé (rafale de Colères : la 1ʳᵉ expie un Péché,
 * la 2ᵉ doit tirer au NOUVEAU total — LDB 40 l.53). Sans `modPerActor`, la déclaration est rendue
 * TELLE QUELLE (aucun coût pour les tables à modificateur figé).
 */
export function liveTableDecl(s: GameState, step: CascadeStep): CascadeTableDecl {
  const decl = step.table;
  if (!decl?.modPerActor) return decl as CascadeTableDecl;
  const actor = step.actorId ? actorIn(s, step.actorId) : undefined;
  const live = (actor?.[decl.modPerActor.counter] ?? 0) * decl.modPerActor.factor;
  return { ...decl, mod: (decl.mod ?? 0) + live };
}

/**
 * RÉSOLVEUR UNIQUE d'un tirage sur table (#942 L2) — calque de `rollBatchParticipant` : tire le dé
 * (`decl.forcedRoll` le FIGE — l'injection : dé posé, test, `forcedRoll` moteur), applique `mod` AVANT
 * le lookup (convention de l'op `rollTable`, `engine/ops.ts`), trouve la ligne par `findTableEntry`
 * (brique partagée) et rend son id stable + ses lignes. PUR (RNG injecté), aucun concept de domaine.
 *
 * `keepHighest` (N > 1) : N tirages naturels, le PLUS ÉLEVÉ retenu — SEUL site du multi-lancer d'une
 * table, pour que le dé RETENU soit celui qui s'affiche ET celui qui résout (aucun pilote ne peut les
 * dissocier). Un `forcedRoll` (dé POSÉ) PRIME : on ne re-tire pas un dé délibérément choisi.
 *
 * Deux fail-fast, aucun repli silencieux :
 *  - table non enregistrée (un `tableId` fautif ne se résout jamais en silence) ;
 *  - dé EFFECTIF HORS de la plage couverte par la table : `findTableEntry` replie sur la DERNIÈRE
 *    ligne, donc un `mod` fautif (au-dessus comme en dessous de la plage) rendrait la MÊME ligne
 *    extrême — ici la borne est vérifiée et l'appelant est nommé (tableId/dé/mod). Seul le PLANCHER
 *    se déclare (`clamp`, table dont le RAW borne par le bas) ; le plafond reste un fail-fast.
 */
export function rollTableStep(decl: CascadeTableDecl, rng: RNG): CascadeTableResult {
  const def = tableStepDefs[decl.tableId];
  if (!def) throw new Error(`rollTableStep : table d'étape « ${decl.tableId} » non enregistrée (registerTableStep)`);
  const faces = decl.die ?? def.die ?? 100;
  let natural = decl.forcedRoll ?? roll(1, faces, rng);
  if (decl.forcedRoll == null) for (let i = 1; i < (decl.keepHighest ?? 1); i++) natural = Math.max(natural, roll(1, faces, rng));
  const raw = natural + (decl.mod ?? 0);
  const lo = def.rows[0].min;
  const hi = def.rows[def.rows.length - 1].max;
  const die = decl.clamp ? Math.max(raw, lo) : raw;
  if (die < lo || die > hi) {
    throw new Error(
      `rollTableStep : dé effectif ${die} hors de la plage [${lo}, ${hi}] de la table « ${decl.tableId} » (dé naturel ${natural}, mod ${decl.mod ?? 0}).`,
    );
  }
  const row = findTableEntry(def.rows, die);
  return { roll: natural, die, id: row.id, lines: def.lines(die) };
}

/**
 * RE-POSE POST-TIRAGE de l'enjeu d'une étape à TABLE (#1117 L2) — l'étape énonce son enjeu à la
 * CONSTRUCTION, mais la LIGNE jouée n'existe qu'APRÈS le dé : tant que le tirage n'est pas tombé,
 * l'enjeu ne peut parler que du `kind` (« une Blessure critique »), jamais de ce qui vient d'arriver
 * (« Blessure majeure à l'œil »). Cette fonction fait descendre la clé à l'entrée tirée, en versant
 * la catégorie Codex DÉCLARÉE PAR LA TABLE (`TableStepDef.entryCategory`) — le pilote de tirage n'a
 * donc rien à nommer, et un `kind` qui tire sur N tables descend chaque fois dans la bonne.
 *
 * SANS enjeu posé, table sans catégorie, ou enjeu AUTHORÉ par un document (aucune clé de dataset où
 * descendre) : la référence est rendue TELLE QUELLE (repli déclaré sur le foyer du `kind`, jamais un
 * renvoi fabriqué). PURE.
 */
export function stakeAtTableRow(stake: StakeRef | undefined, decl: CascadeTableDecl, result: CascadeTableResult): StakeRef | undefined {
  const category = tableStepDefs[decl.tableId]?.entryCategory;
  if (!stake || !category || stake.key == null) return stake;
  return { ...stake, key: { ...stake.key, entryId: result.id, entryCategory: category } };
}

/** Étape à table RÉSOLUE : la déclaration qui a tiré + son résultat + l'enjeu redescendu à la ligne
 *  jouée. SITE UNIQUE de la pose d'un `table.result` sur une étape — les quatre pilotes de tirage
 *  (modale, dé posé, résolution forcée, cascade immédiate) passent par ici, sinon l'un d'eux
 *  laisserait l'enjeu au `kind` pendant que les autres l'ont fait descendre. */
export function tableStepResolved(step: CascadeStep, decl: CascadeTableDecl, result: CascadeTableResult): CascadeStep {
  const stake = stakeAtTableRow(step.stake, decl, result);
  return { ...step, table: { ...decl, result }, ...(stake ? { stake } : {}) };
}

/** Type d'INTERACTION d'une étape, inféré de ses champs (zéro migration des étapes-jet existantes) :
 *  un Test (`target`), un TIRAGE SUR TABLE non résolu (`table` sans `result`, #942 L2), un batch
 *  multi (`participants` — seam de jet #275 Décision 4 cran 1, UNE rangée par contributeur), un choix
 *  du joueur (`options`), ou un pur affichage (aucun des quatre). */
export function stepInteraction(step: CascadeStep): 'jet' | 'table' | 'batch' | 'choix' | 'affichage' {
  if (step.target != null) return 'jet';
  if (step.table != null && step.table.result == null) return 'table';
  if (step.participants != null) return 'batch';
  if (step.options != null) return 'choix';
  return 'affichage';
}

/** L'étape est-elle prête à être validée ? jet → lancée (`result`) ; table → tirée (`table.result`) ;
 *  batch → TOUS les participants INTERACTIFS ont un `result` ; choix → tranchée (`chosen`) ;
 *  affichage → toujours.
 *
 *  CONTRAT d'une rangée TÉMOIN (`interactive:false`) : elle NAÎT avec son `result` — c'est son
 *  PRODUCTEUR qui le roule à la construction (`pursuitFlow.pursuitRow`, `ui/opposedFrozen`). Rien ne
 *  roule les rangées d'une étape ouverte : `rollBatchParticipants` n'est appelé QUE par les pilotes
 *  « tout résoudre »/immédiat (`resolveRemainingCascade`/`runCascadeImmediate`). Une témoin sans
 *  `result` n'en obtiendrait donc jamais — et comme elle ne freine pas ce prédicat, son jet serait
 *  simplement PERDU à la validation. */
export function stepReady(step: CascadeStep): boolean {
  switch (stepInteraction(step)) {
    case 'jet': return !!step.result;
    case 'table': return !!step.table!.result;
    case 'batch': return step.participants!.every((p) => p.interactive === false || !!p.result);
    case 'choix': return step.chosen != null;
    case 'affichage': return true;
  }
}

/**
 * ISSUE d'un jet de cascade OPPOSÉ à un jet d'adversaire FIGÉ — SOURCE UNIQUE (étape MONO du flux
 * `cascade`, rangée d'une étape BATCH) : `resolveOpposed` est le SEUL juge (LDB 12 l.160) et
 * `opposedBranchSuccess` la SEULE lecture de branche (statu quo à l'égalité parfaite). `bonusSL`
 * s'ajoute au DR du défenseur AVANT l'opposition (Piège-lame, LDB 62 l.280) sans entrer dans le `sl`
 * reporté ; `statuQuo` marque l'égalité parfaite — rien ne s'est passé, ce n'est pas un Test raté.
 *
 * `defBase` = le Niveau de Compétence NU du défenseur, quand l'émetteur l'a posé : il n'entre QUE
 * dans l'opposition. Absent ⇒ les deux camps retombent sur leurs cibles (tout-ou-rien d'`openValues`) :
 * le dé est jeté sur une cible DÉJÀ modifiée, l'opposer à un `base` d'attaquant comparerait deux
 * grandeurs distinctes. PURE.
 */
export function opposedCascadeRoll(def: TestResult, opp: OpposedRowFreeze, target: number, defBase?: number): CascadeRoll {
  const o = resolveOpposed(opp.aT, { ...def, sl: def.sl + (opp.bonusSL ?? 0), base: defBase });
  return {
    roll: def.roll, target, sl: def.sl,
    success: opposedBranchSuccess(o, opp.defenderMustWin),
    ...(o.winner === 'tie' ? { statuQuo: true as const } : {}),
  };
}

/** Jet d'UN participant batch — GÉNÉRIQUE : d100 contre sa cible EFFECTIVE (`target`, difficulté déjà
 *  appliquée à la construction), + `bonusSlOnSuccess` sur une réussite (Talent baké par le flux
 *  propriétaire). PUR (RNG injecté), aucun concept de domaine.
 *
 *  `opposed` — jet d'adversaire FIGÉ de l'étape (`meta.opposed`) : la rangée est alors un Test OPPOSÉ
 *  et son issue vient d'`opposedCascadeRoll`, pas de `roll ≤ cible`. UNE opposition figée vaut pour
 *  TOUTES les rangées de l'étape (LDB 13 l.77) — c'est le producteur qui l'a jetée, une seule fois. */
export function rollBatchParticipant(p: BatchParticipant, rng: RNG, opposed?: OpposedRowFreeze): CascadeRoll {
  const t = rollTest(p.target, 'intermediaire', rng);
  if (opposed) return opposedCascadeRoll(t, opposed, p.target, p.base);
  return { roll: t.roll, target: t.target, sl: t.sl + (t.success ? (p.bonusSlOnSuccess ?? 0) : 0), success: t.success };
}

/** Résilience « Je ne faillirai pas ! » (LDB 17 l.68) pour UN participant batch : DR MAXIMAL policy-aware
 *  sur sa cible (réussite forcée). PUR, générique. */
export function forceBatchParticipant(p: BatchParticipant): CascadeRoll {
  const die = bestForcedRoll(p.target);
  const ev = evaluateTest(die, p.target);
  return { roll: die, target: p.target, sl: ev.sl + (p.bonusSlOnSuccess ?? 0), success: true };
}

/** Agrège les jets d'une étape À PARTICIPANTS PRÊTE en un `CascadeRoll` scalaire — GÉNÉRIQUE (aucun
 *  concept de domaine) : `best` = le meilleur DR l'emporte ; `summed-dr` (défaut) = Σ des DR (les
 *  participants `essential` comptent DOUBLE, MDG 14 l.19) + `flatDR` (modificateur plat versé par le
 *  flux), plafonné à `capTo` s'il est fourni (plafond CHIFFRÉ par le flux — Manque de bras l.55) ;
 *  `opposed` = ce total net d'`opposeSl`. Le SEUIL de succès du total sommé est `successOf`, injecté par
 *  le flux propriétaire (naval : `crewTestSuccess`) ; absent = ≥ 1. PUR, aucun concept de domaine.
 *  SOURCE UNIQUE pour `CascadeStep.participants` (`BatchParticipant[]`, flag `essential`) — le même
 *  « essentiel ×2 » (l.19) est ré-implémenté sur une forme DISTINCTE par `maneuverCrewTotal`
 *  (`state/shipManeuver.ts`, pending MULTI de COMBAT `ShipManeuverParticipant[]`, `roleId` matché) : NON
 *  convergentes VOLONTAIREMENT, deux pendings de forme différente (#351). */
export function aggregateBatchRolls(
  parts: BatchParticipant[],
  aggregate: CascadeAggregate = 'summed-dr',
  opts: { flatDR?: number; capTo?: number; opposeSl?: number; successOf?: (sl: number) => boolean } = {},
): { sl: number; success: boolean } {
  if (aggregate === 'best') {
    const sl = parts.reduce((m, p) => (p.result && p.result.sl > m ? p.result.sl : m), -Infinity);
    const best = Number.isFinite(sl) ? sl : 0;
    return { sl: best, success: best > 0 };
  }
  let total = opts.flatDR ?? 0;
  for (const p of parts) if (p.result) total += p.essential ? p.result.sl * 2 : p.result.sl;
  if (opts.capTo != null && total > opts.capTo) total = opts.capTo;
  if (aggregate === 'opposed') { const sl = total - (opts.opposeSl ?? 0); return { sl, success: sl > 0 }; }
  return { sl: total, success: (opts.successOf ?? ((n: number) => n >= 1))(total) };
}

/** Agrège une étape « batch » PRÊTE (`stepReady`) en un `CascadeRoll` scalaire — même vocabulaire
 *  `result` qu'une étape mono, pour que l'applier `cascadeAppliers[kind]` reste kind-agnostique du
 *  nombre de contributeurs (seam de jet #275 Décision 4 cran 1). Les paramètres de formule vivent en
 *  `meta` NEUTRE (`aggregateFlatDR`/`aggregateCapTo`/`aggregateOpposeSl`/`aggregateSuccessRule`), versés
 *  à la construction. Un id de règle de succès INCONNU jette (fail-closed) : retomber en silence sur le
 *  seuil générique appliquerait à un domaine un seuil qui n'est pas le sien. */
function aggregateBatchStep(step: CascadeStep): CascadeRoll {
  const meta = step.meta;
  const flatDR = typeof meta?.aggregateFlatDR === 'number' ? meta.aggregateFlatDR : 0;
  const capTo = typeof meta?.aggregateCapTo === 'number' ? meta.aggregateCapTo : undefined;
  const opposeSl = typeof meta?.aggregateOpposeSl === 'number' ? meta.aggregateOpposeSl : 0;
  const ruleId = typeof meta?.aggregateSuccessRule === 'string' ? meta.aggregateSuccessRule : undefined;
  const successOf = ruleId ? cascadeSuccessRules[ruleId] : undefined;
  if (ruleId && !successOf) throw new Error(`aggregateBatchStep : règle de succès « ${ruleId} » non enregistrée (registerCascadeSuccessRule).`);
  const { sl, success } = aggregateBatchRolls(step.participants!, step.aggregate ?? 'summed-dr', { flatDR, capTo, opposeSl, successOf });
  return { roll: 0, target: 0, sl, success };
}

/**
 * OPPOSITION FIGÉE d'une étape, telle que la lisent les résolveurs de rangée (`meta.opposed`) —
 * SOURCE UNIQUE de la lecture : le jet d'adversaire est jeté UNE fois par le producteur et vaut pour
 * toutes les rangées. `undefined` = étape non opposée (jet simple sur la cible).
 *
 * CONTRAT d'une étape OPPOSÉE : sa `base` est NUE (Niveau de Compétence, `LDB 09 l.17`) — c'est elle
 * qui DÉPARTAGE à DR égal (`LDB 12 l.160`, `engine/tests.openValues`), et une valeur SOUTENUE y
 * comparerait deux grandeurs distinctes. `CascadeStepBase` ne peut plus porter de Soutien FONDU : le
 * Soutien est une ligne NOMMÉE de `mods` (`soutienMod`) pour TOUT producteur d'étape.
 */
export function stepOpposedFreeze(step: CascadeStep | undefined): OpposedRowFreeze | undefined {
  const opp = step?.meta?.opposed;
  if (!opp) return undefined;
  return {
    aT: opp.aT,
    ...(opp.bonusSL != null ? { bonusSL: opp.bonusSL } : {}),
    ...(opp.defenderMustWin ? { defenderMustWin: true } : {}),
  };
}

/** SURFACE des rangées d'une bande résolue par un pilote sans fenêtre, DÉCLARÉE par ce pilote : le
 *  procès-verbal structuré d'une traversée (`dayEntriesFromStep`, `seaVoyageFlow.ts`) montre déjà
 *  chaque dé, ligne par ligne — le journal ne les redit pas (#1291). Absente = le journal est la seule
 *  surface, il porte les dés. Déclaration d'APPEL (rien n'entre dans la sauvegarde), patron du mono
 *  `unwitnessed`. */
export type RowSurface = 'pv';

/**
 * Lance d'office les participants SANS influence (pilotes automatiques — `resolveRemainingCascade`/
 * `runCascadeImmediate`) : même Test générique que la modale (`rollBatchParticipant`), même opposition
 * figée, simplement sans le cycle Chance/Résilience du flux `cascadeBatch`.
 *
 * `autoResolved` — la rangée est roulée SANS FENÊTRE (`runCascadeImmediate` : bande de témoins d'une
 * fin de combat, cadence auto) : elle porte l'étampe `meta.autoResolved`, que `commitStep` lit pour
 * émettre SA ligne de trace (#1281). « Tout lancer » (`resolveRemainingCascade`) ne la pose PAS : sa
 * modale reste ouverte sur le BILAN, où chaque rangée montre son dé.
 */
function rollBatchParticipants(step: CascadeStep, autoResolved = false) {
  const opp = stepOpposedFreeze(step);
  return step.participants!.map((p) => (p.result ? p : {
    ...p,
    ...(autoResolved ? { meta: { ...p.meta, autoResolved: true } } : {}),
    result: rollBatchParticipant(p, battleRng(), opp),
  }));
}

/**
 * TRACES des jets d'une étape qu'AUCUNE SURFACE n'a montrés — une ligne par jet, DÉRIVÉE par le socle
 * (`traceLineOf`) : porteur — libellé : dé/cible → issue (DR). Deux formes, un seul dériveur :
 *  - BANDE : les rangées étampées `meta.autoResolved` (posée par `rollBatchParticipants(step, true)`) ;
 *  - MONO : l'étape à jet résolue par un pilote SANS fenêtre — le pilote le DÉCLARE (`unwitnessed`,
 *    `runCascadeImmediate`), il n'est pas déduit d'un champ d'étape (rien n'entre dans la sauvegarde).
 *
 * PARTITION : « Tout lancer » (`resolveRemainingCascade`) n'étampe rien et ne déclare rien — sa modale
 * reste ouverte sur le BILAN, où chaque rangée montre son dé. Et le journal n'est pas la SEULE surface
 * possible d'une rangée sans fenêtre : le pilote qui rend ses bandes sur un PROCÈS-VERBAL structuré
 * (traversée de mer, `rowSurface: 'pv'`) le DÉCLARE au même titre — chaque dé sur EXACTEMENT une
 * surface, jamais deux (#1291).
 *
 * Là où il l'est, le journal est la SEULE surface de ces jets — le cas nominatif que la doctrine #295
 * réserve (cf. `cascade-consequence-guard.test.ts`). `game-trigger-cadence-aware-no-silent` : moins
 * d'interruptions, jamais moins de traces.
 */
function unwitnessedTraceLines(get: Get, step: CascadeStep, unwitnessed: boolean, rowSurface?: RowSurface): string[] {
  const out: string[] = [];
  for (const row of rowSurface ? [] : step.participants ?? []) {
    if (!row.meta?.autoResolved || !row.result) continue;
    out.push(traceLineOf({
      who: actorIn(get(), row.id)?.label ?? row.id,
      label: row.label ?? step.rollLabel ?? undefined,
      ...row.result,
    }));
  }
  if (unwitnessed && !step.participants && step.result && stepInteraction(step) === 'jet') {
    out.push(traceLineOf({
      ...(step.actorId ? { who: actorIn(get(), step.actorId)?.label ?? step.actorId } : {}),
      label: step.rollLabel ?? step.label ?? undefined,
      ...step.result,
    }));
  }
  return out;
}

/** Pose le choix du joueur sur l'étape « choix » COURANTE (valide que `key ∈ options`). Analogue de
 *  `cascadeRoll` côté jet : prépare l'étape ; la VALIDATION (conséquence) reste à `advanceCascade`. */
export function setCascadeChoice(get: Get, set: Set, stepId: string, key: string): void {
  const p = get().pendingCascade;
  if (!p) return;
  const cur = p.participants[p.cursor];
  if (!cur || cur.id !== stepId) return;
  if (!cur.options?.some((o) => o.key === key)) return;
  set({ pendingCascade: { ...p, participants: p.participants.map((x, k) => (k === p.cursor ? { ...x, chosen: key } : x)) } });
}

/** Tire la TABLE de l'étape COURANTE (interaction `'table'`) — SEAM d'état, analogue de
 *  `setCascadeChoice`/`cascadeRoll` : pose `table.result` via le résolveur UNIQUE (`rollTableStep`,
 *  RNG de bataille) ; la VALIDATION (conséquence) reste à `advanceCascade`. No-op si l'étape n'est pas
 *  celle visée, n'a pas de table, ou est déjà tirée (un dé ne se relance pas en douce). */
export function rollCascadeTable(get: Get, set: Set, stepId: string): void {
  const p = get().pendingCascade;
  if (!p) return;
  const cur = p.participants[p.cursor];
  if (!cur || cur.id !== stepId || !cur.table || cur.table.result) return;
  // La déclaration RÉSOLUE (modificateur vivant versé) est celle qui tire ET celle qu'on POSE sur
  // l'étape : le `mod` qui a servi reste lisible (rangée + conséquence) au lieu d'être recalculé.
  const table = liveTableDecl(get(), cur);
  const result = rollTableStep(table, battleRng());
  set({ pendingCascade: { ...p, participants: p.participants.map((x, k) => (k === p.cursor ? tableStepResolved(x, table, result) : x)) } });
}

/** Faces du dé d'un tirage sur table : la DÉCLARATION l'emporte sur la table, d100 par défaut —
 *  même ordre de repli que `rollTableStep`, dérivé ici pour les appelants qui doivent BORNER une
 *  saisie (mode table) sans re-tirer. */
export function tableStepDie(decl: CascadeTableDecl): number {
  return decl.die ?? tableStepDefs[decl.tableId]?.die ?? 100;
}

/**
 * MODE TABLE (#942 L3) — dé NATUREL à poser pour atteindre la ligne `row` : le lookup se fait sur le
 * dé EFFECTIF (`naturel + mod`, cf. `rollTableStep`), donc le naturel est `min − mod`, ramené dans les
 * faces du dé. `null` = ligne HORS D'ATTEINTE (aucune face n'y atterrit avec ce `mod`) — l'affordance
 * est alors désactivée, jamais un dé qui glisse en silence sur la ligne voisine. PUR.
 */
export function naturalRollForTableRow(decl: CascadeTableDecl, row: TableStepRow): number | null {
  const mod = decl.mod ?? 0;
  const lo = Math.max(1, row.min - mod);
  const hi = Math.min(tableStepDie(decl), row.max - mod);
  return lo <= hi ? lo : null;
}

/** Ramène une SAISIE libre aux naturels que CETTE table peut résoudre (faces du dé ∩ plage couverte,
 *  `mod` compris) — sans quoi une saisie extrême sous `mod` sortirait de la plage et ferait lever
 *  `rollTableStep` en pleine modale. */
function clampTableNatural(decl: CascadeTableDecl, roll: number): number {
  const def = tableStepDefs[decl.tableId];
  const mod = decl.mod ?? 0;
  const lo = def ? Math.max(1, def.rows[0].min - mod) : 1;
  const hi = def ? Math.min(tableStepDie(decl), def.rows[def.rows.length - 1].max - mod) : tableStepDie(decl);
  return Math.min(Math.max(Math.floor(roll), lo), hi);
}

/**
 * MODE TABLE (#942 L3) — POSE LE DÉ de l'étape à table COURANTE : `roll` est le dé NATUREL (le `mod`
 * s'applique après, dans le résolveur UNIQUE). SEAM d'état des DEUX affordances de la modale (champ
 * « Fixer le dé » et clic sur une ligne) : une seule sémantique, un seul site. Le dé posé est TIRÉ
 * dans la foulée (`rollTableStep`) — poser le dé EST le tirage — et l'étape porte `fixed` : la marque
 * de provenance de la rangée (`RollRow.fixedMark`) et celle du journal (`fixedDieMark`, qui lit les
 * slots ouverts) en découlent sans code par site.
 *
 * AUCUNE gate de possession ici NI dans le délégué : l'option « Dés fixés » est CLIENT-SIDE (elle
 * n'arme que l'affordance de celui qui clique, `ui/forcedDieRow.ts`) et l'autorisation d'un geste reçu
 * par le réseau est celle du SIÈGE ÉMETTEUR (`netOwnership.intentAllowedFor`) — la ré-évaluer avec
 * l'état LOCAL de l'hôte ferait tomber en silence le geste légitime d'un invité (cf. le même arbitrage,
 * verbatim, sur `opSetForcedRoll`, `state/rollFlowFactory.ts`).
 *
 * Le dé se RE-POSE tant que l'étape est COURANTE (le résultat est recalculé) — même liberté que la
 * saisie post-jet d'un slot de flux : une valeur en cours de frappe n'est pas un engagement. Le
 * curseur qui avance ferme la fenêtre (`cur.id !== stepId`).
 */
export function setCascadeTableForcedRoll(get: Get, set: Set, stepId: string, roll: number): void {
  const p = get().pendingCascade;
  if (!p) return;
  const cur = p.participants[p.cursor];
  if (!cur || cur.id !== stepId || !cur.table || cur.committed) return;
  const live = liveTableDecl(get(), cur);
  const table: CascadeTableDecl = { ...live, forcedRoll: clampTableNatural(live, roll) };
  const result = rollTableStep(table, battleRng());
  set({ pendingCascade: { ...p, participants: p.participants.map((x, k) => (k === p.cursor ? { ...tableStepResolved(x, table, result), fixed: true } : x)) } });
}

/**
 * DOCTRINE UNIQUE du slot `pendingCascade` — partagée par `pushStep` et `startCascade` (#942 L1) :
 * il porte UNE séquence, et **rien n'y est jamais écrasé**.
 *  - slot LIBRE → la séquence s'ouvre ;
 *  - slot de MÊME `purpose` (en cours OU en BILAN, curseur en fin) → les étapes sont APPENDUES : le
 *    mono est le cas N=1 d'une séquence, pas un cycle distinct. Appender sur un bilan le RÉOUVRE, donc
 *    son dénouement (`travelHalt`/`combatEndBoundary`/… → `dispatchCascadeDone`) se joue au « Terminer »
 *    de la séquence FUSIONNÉE, jamais perdu — c'est pourquoi les bornes des deux fragments sont RÉUNIES
 *    et pourquoi ce dispatch est CUMULATIF (combatSlice.ts) ;
 *  - slot d'un AUTRE `purpose` → il est SUSPENDU (pile LIFO `suspendedCascades`) avant que la nouvelle
 *    séquence n'ouvre ; sa reprise est portée par la couture de CLÔTURE de cascade (`dispatchCascadeDone`,
 *    slot libre et hors combat) et par le teardown de combat.
 */

/** Pousse UNE étape déjà formée dans la séquence de `purpose` (doctrine du slot ci-dessus). Quand
 *  l'étape OUVRE la séquence, elle PRÊTE son `label`/`icon` au titre de la fenêtre (« Surprise »,
 *  « Imparfaite »…) — la situation qui l'a ouverte est le titre juste ; repli générique
 *  « Conséquences » si l'étape n'en porte pas. La variante FABRIQUE reçoit l'index d'append (ids
 *  uniques dans la séquence). SOURCE UNIQUE de l'append d'une étape (`pushCombatStep`
 *  = `pushStep(…, 'combat')`, `pushReveal` route par ici TOUTE révélation, #942 L8).
 *
 *  `purpose` accepte une FONCTION de l'état : un appelant qui n'a que `set` (les sites de conséquence
 *  d'attaque n'ont pas tous le `get`) doit pouvoir choisir sa séquence d'accueil SUR l'état — elle est
 *  alors évaluée DANS le même `set` atomique que l'append, donc sur l'état qui reçoit l'étape.
 *
 *  La FABRIQUE peut rendre `undefined` : un constructeur de la porte qui REFUSE sa déclaration
 *  (`rollSeam.refusePorte`) n'a aucune étape à donner, et l'index d'append n'est connu qu'ici — sans
 *  cette sortie, l'appelant devrait mimer la doctrine du slot pour décider en amont.
 *
 *  L'invariant de possession de bande (`assertBandeDeclarePossession`, ci-dessous) s'applique à l'APPEND
 *  comme à l'ouverture : une bande sans possession glissée par cette voie échapperait sinon à la garde. */
export function pushStep(set: Set, step: CascadeStep | ((index: number) => CascadeStep | undefined), purpose: PendingCascade['purpose'] | ((s: GameState) => PendingCascade['purpose'])): void {
  set((s) => {
    const p = typeof purpose === 'function' ? purpose(s) : purpose;
    const cur = s.pendingCascade;
    const same = cur && cur.purpose === p ? cur : null;
    const st = typeof step === 'function' ? step(same ? same.participants.length : 0) : step;
    if (!st) return {};
    assertBandeDeclarePossession([st]);
    if (same) return { pendingCascade: { ...same, participants: [...same.participants, st] } };
    const fresh: PendingCascade = { title: st.label ?? 'Conséquences', icon: st.icon ?? 'action/attack', purpose: p, cursor: 0, log: [], participants: [st] };
    // Slot occupé par un AUTRE purpose : on le SUSPEND (jamais un écrasement) — même `set` atomique
    // que `suspendActiveCascade`, dont `pushStep` n'a pas le `get`.
    return cur ? { pendingCascade: fresh, suspendedCascades: [...s.suspendedCascades, cur] } : { pendingCascade: fresh };
  });
}

/**
 * INVARIANT DE POSSESSION D'UNE BANDE (#1262 V2 L4, verdict de palier) : une étape À RANGÉES DÉCLARE
 * à qui elle appartient — plus d'UN porteur ⇒ `groupOwner` (owner `'*'` : chaque siège voit la fenêtre
 * où se tient SA rangée) ; un SEUL porteur ⇒ `actorId` = ce porteur. Sans l'un des deux, l'arbitre
 * (`modalArbiter`, entrée `cascade`) rend `undefined`, donc la fenêtre à l'HÔTE SEUL — et le siège du
 * porteur ne voit jamais sa rangée (`netOwnership.ownsLocally`).
 *
 * Les mints (`rollSeam.bandStep`, `buildBatchStep`) POSENT cette possession : la garde ne corrige
 * rien, elle FERME la forme — un montage manuscrit qui la perdrait n'entre pas dans une séquence.
 *
 * PORTÉE EXACTE, dite (garde de FORME : elle lit l'étape, jamais un call-site) — les DEUX portes
 * d'ENTRÉE d'étapes dans le slot, `startCascade` et `pushStep`. Ce qu'elle ne voit PAS :
 *  - une séquence RESTAURÉE d'une sauvegarde (`store.loadGame`) écrit le slot en direct. Ce sont les
 *    migrations qui en répondent — INÉGALEMENT : `bandifyNightSteps`/`bandifyPursuitSteps`/
 *    `bandifyCombatEndSteps` repassent par les FABRIQUES du jeu (donc par `bandStep`), mais
 *    `bandifyPsychStep` monte sa bande À LA MAIN (`saves.ts`) — sa possession n'est tenue que par son
 *    propre code et par son test ;
 *  - `runCascadeImmediate` bloqué sur un CHOIX sans défaut authoré : il installe `pendingCascade` en
 *    direct pour surfacer l'impasse (#351) — les étapes qu'il porte viennent de son appelant ;
 *  - les REMPLACEMENTS d'étape courante en vol : insertion de conséquence (`commitStep`), reminte du
 *    `cast` partagé (`combatFlow`) et du désengagement à deux joués (`combatSlice`) — ils réécrivent
 *    une étape DÉJÀ entrée, sans repasser par une porte.
 * DEV : la violation THROW ; en PROD elle se journalise et la séquence s'ouvre (même politique).
 */
function assertBandeDeclarePossession(steps: readonly CascadeStep[]): void {
  for (const st of steps) {
    const rows = st.participants;
    if (!rows?.length) continue;
    const porteurs = new Set(rows.map((r) => r.id)).size;
    if (st.groupOwner) continue;               // possession de GROUPE : toute forme
    if (porteurs <= 1 && st.actorId) continue; // porteur UNIQUE : nommé
    const msg = `[cascade] bande « ${st.id} » (${st.kind}) : ${porteurs} porteur(s) et AUCUNE possession déclarée `
      + '(`groupOwner` au-delà d\'un porteur, `actorId` pour un seul) — la fenêtre échoirait à l\'hôte seul, '
      + 'et le siège du porteur ne verrait jamais sa rangée.';
    console.error(msg);
    if (import.meta.env?.DEV) throw new Error(msg);
  }
}

/**
 * Ouvre une séquence interactive (≥ 1 étape influençable). Le curseur démarre sur la 1ʳᵉ étape.
 * Applique la DOCTRINE DU SLOT ci-dessus (append même purpose / suspension sinon) : aucun écrasement.
 * `restNights` du fragment déjà en place l'emporte (`??`) — un séjour multi-nuits porte SON compteur,
 * un fragment appendu ne le réécrit pas ; les bornes booléennes, elles, s'ADDITIONNENT (`||`).
 */
export function startCascade(
  get: Get,
  set: Set,
  opts: { title: string; icon?: string; purpose: PendingCascade['purpose']; steps: CascadeStep[]; log?: string[]; travelHalt?: boolean; roundBoundary?: boolean; combatEndBoundary?: boolean; restNights?: PendingCascade['restNights'] },
): void {
  if (!opts.steps.length) return;
  assertBandeDeclarePossession(opts.steps);
  const cur = get().pendingCascade;
  if (cur && cur.purpose === opts.purpose) {
    set({
      pendingCascade: {
        ...cur,
        participants: [...cur.participants, ...opts.steps],
        log: [...cur.log, ...(opts.log ?? [])],
        travelHalt: cur.travelHalt || opts.travelHalt,
        roundBoundary: cur.roundBoundary || opts.roundBoundary,
        combatEndBoundary: cur.combatEndBoundary || opts.combatEndBoundary,
        restNights: cur.restNights ?? opts.restNights,
      },
    });
    return;
  }
  if (cur) suspendActiveCascade(get, set);
  set({
    pendingCascade: {
      title: opts.title, icon: opts.icon, purpose: opts.purpose,
      participants: opts.steps, cursor: 0, log: opts.log ?? [], travelHalt: opts.travelHalt, roundBoundary: opts.roundBoundary, combatEndBoundary: opts.combatEndBoundary, restNights: opts.restNights,
    },
  });
}

/**
 * SEAM `onOwnTestFailed` d'une étape À PARTICIPANTS — calque EXACT du seam MONO (cf. `commitStep`
 * ci-dessous), joué PAR RANGÉE PERDANTE : le porteur est celui de la rangée (`part.id`), le DR est
 * celui de SON jet. Un effet déclenché sur ce trigger ne connaît pas la forme de la fenêtre — MSRC 16
 * l.152-158 (Crampes abdominales) verbatim : « Lorsqu'un Test se solde par un échec normal ou pire,
 * il se plie en deux de douleur […] et gagne l'État *Sonné*. » Une bande sourde le perdrait pour TOUS
 * ses héros. L'étampe `meta.noOwnTestFailed` coupe la ré-entrance, au niveau de la BANDE comme d'une
 * seule RANGÉE (`BatchParticipant.meta`, jumeau du `meta` d'étape).
 */
function batchOwnTestFailedLines(get: Get, step: CascadeStep): string[] {
  if (step.meta?.noOwnTestFailed) return [];
  const lines: string[] = [];
  for (const part of step.participants ?? []) {
    // `statuQuo` : égalité parfaite d'un Test opposé (LDB 12 l.160) — rien ne s'est passé, ce n'est pas un
    // Test raté : le trigger d'échec ne part pas.
    if (!part.result || part.result.success || part.result.statuQuo || part.meta?.noOwnTestFailed) continue;
    const actor = actorIn(get(), part.id);
    if (!actor) continue;
    lines.push(...(ownTestFailedEmitter?.(get, actor, part.result.sl) ?? []));
  }
  return lines;
}

/** Applique la conséquence d'une étape + ses insertions ; renvoie le tableau d'étapes mis à jour, les
 *  lignes de journal, et `suspended` (l'applier a fait basculer le slot ACTIF vers un AUTRE contexte —
 *  `startCombat`, cf. `suspendActiveCascade` — PENDANT sa propre exécution). Partagé par les trois
 *  pilotes (interactif, « tout résoudre », immédiat).
 *
 *  `unwitnessed` : le pilote DÉCLARE qu'aucune fenêtre n'a montré le jet de cette étape (pilote
 *  immédiat) — le goulot en dérive alors la ligne de dé (`unwitnessedTraceLines`). `rowSurface` : le
 *  même pilote DÉCLARE où ses RANGÉES de bande se montrent, quand ce n'est pas le journal (#1291). */
function commitStep(get: Get, set: Set, steps: CascadeStep[], i: number, liveMerge = false, unwitnessed = false, rowSurface?: RowSurface): { steps: CascadeStep[]; journal: string[]; suspended: boolean } {
  const before = get().pendingCascade;
  // Étape « batch » (participants — seam de jet #275 Décision 4 cran 1) : AGRÈGE les contributeurs
  // (déjà tous résolus, `stepReady`) en UN `CascadeRoll` scalaire — l'applier lit `step.result` comme
  // n'importe quelle étape mono, kind-agnostique du nombre de rangées. `aggregate:'none'` (#351) : jets
  // INDÉPENDANTS — RIEN à agréger, l'applier lit CHAQUE `participants[i].result` lui-même.
  let step = steps[i];
  if (step.participants && !step.result && step.aggregate !== 'none') step = { ...step, result: aggregateBatchStep(step) };
  const hero = step.actorId ? actorIn(get(), step.actorId) : undefined;
  // TRACE des jets qu'aucune SURFACE n'a montrés — AVANT la conséquence : le dé se lit d'abord, l'effet
  // ensuite, comme dans la fenêtre qui ne s'est pas ouverte.
  const traces = unwitnessedTraceLines(get, step, unwitnessed, rowSurface);
  for (const l of traces) get().log(l);
  const out = cascadeAppliers[step.kind]?.apply(get, set, step, hero, { steps, index: i });
  // `consequences` (#295 Lot 0) : rendu en LIGNES STRUCTURÉES (#349, `resultLines`) — seule voie de
  // dénouement. Le journal texte (`get().log`) reste alimenté depuis le même texte (`l.text`).
  const lines = out?.consequences ? resultLines(out.consequences) : [];
  for (const l of lines) get().log(l.text);
  // SEAM CENTRAL `onOwnTestFailed` (tests DIFFÉRÉS d'entretien + tests déclenchés de combat en cascade) :
  // toute étape à JET RATÉ (`faim`/`recovery`/`diseaseTick`/`diseasePersist`/`traumaFracture`/`contagion`/
  // `triggeredTest`… — TOUS passent par ce `commitStep`) émet le trigger pour son acteur. L'étampe
  // `meta.noOwnTestFailed` (posée sur le FM de palier 2 des Crampes) coupe la ré-entrance. Émetteur INJECTÉ
  // (`setOwnTestFailedEmitter`, patron `testRouter`) pour éviter le cycle cascade↔triggeredEffects. Sous-Test
  // du FM résolu INLINE (pas de `set` threadé : ouvrir une cascade IMBRIQUÉE dans un commitStep serait fragile).
  // Une BANDE émet PAR RANGÉE PERDANTE (`batchOwnTestFailedLines`) : le trigger est dû au Test, pas à la
  // forme de la fenêtre — SOURCE UNIQUE ici pour les deux formes, jamais un second site par applier.
  const interaction = stepInteraction(step);
  const ownTestFailedLines = interaction === 'batch'
    ? batchOwnTestFailedLines(get, step)
    : ((interaction === 'jet' && step.result && !step.result.success && !step.result.statuQuo && hero && !step.meta?.noOwnTestFailed)
      ? (ownTestFailedEmitter?.(get, hero, step.result.sl) ?? []) : []);
  for (const l of ownTestFailedLines) get().log(l);
  // L'étape VALIDÉE garde sa conséquence (`outcome`) pour rester LISIBLE dans la pile à l'écran. Une
  // étape d'AFFICHAGE porte son contenu d'avance (`outcome` pré-rempli) avec un applier muet → on le
  // PRÉSERVE (sinon le journal vide l'effacerait à la validation).
  const shown = lines.length ? lines : (step.outcome ?? []);
  // Pilote INTERACTIF (`liveMerge`) : l'applier d'une conséquence de combat FOLDÉE (déviation) re-déclenche
  // le reste de l'attaque, qui APPEND des étapes au pending (via pushReveal). On repart alors des
  // participants COURANTS (post-applier) pour préserver ces appends — le pending est EN PHASE ici
  // (advanceCascade). Les pilotes BATCH ne l'activent PAS (leur tableau local porte des jets/choix pas
  // encore posés dans le pending). SUSPENDUE (slot occupé par un autre contexte) → `get().pendingCascade`
  // vaut `null`, `live` retombe naturellement sur `undefined` (pas de merge, pas de crash).
  const live = liveMerge ? get().pendingCascade?.participants : undefined;
  const base = live && live.length >= steps.length && live[i]?.id === step.id ? live : steps;
  let next = base.map((x, k) => (k === i ? { ...x, ...(step.result ? { result: step.result } : {}), committed: true, outcome: shown } : x));
  if (out?.insert?.length) next = [...next.slice(0, i + 1), ...out.insert, ...next.slice(i + 1)];
  // NOTRE cascade a été PARQUÉE pendant l'exécution de l'applier — `suspendActiveCascade` (couture
  // universelle `startCombat`/`transitionTo`, qui vide le slot ; ou `startCascade` d'un AUTRE `purpose`,
  // #942 L1, qui le rend à la nouvelle cascade) : elle est dans `suspendedCascades`. Le retour l'expose,
  // JAMAIS écrit ici — ressusciter le slot écraserait le contexte qui l'a pris.
  // La PILE est le signe EXACT (pas la simple différence de référence du slot) : un applier qui APPEND
  // (conséquence foldée, liveMerge) ou qui rend la main à une cascade SUIVANTE de son propre flux
  // (journée de mer → jour d'après) ne parque rien et n'est pas une suspension.
  const after = get().pendingCascade;
  const parked = before !== null && get().suspendedCascades.lastIndexOf(before) >= 0;
  const suspended = before !== null && (after === null || parked);
  return { steps: next, journal: [...traces, ...lines.map((l) => l.text), ...ownTestFailedLines], suspended };
}

/** Cascade EN COURS de résolution suspendue EN PLEIN VOL (`commitStep` a détecté `suspended`) : MET À
 *  JOUR dans `suspendedCascades` l'entrée poussée par `suspendActiveCascade` (référence `stale`, poussée
 *  DEPUIS le slot actif AVANT que l'applier n'y touche) — `patch` = ses étapes À JOUR (celles que
 *  `commitStep` vient de committer/insérer), `null` = on la RETIRE (séquence FINIE : plus aucune étape
 *  restante à préserver). Ne ressuscite JAMAIS le slot actif (propriété d'un AUTRE contexte désormais,
 *  ex. combat) : SEULE la pile est touchée. No-op si `stale` n'y est plus (déjà résumée entre-temps,
 *  cas extrême hors coop synchrone). */
function reconcileSuspended(get: Get, set: Set, stale: PendingCascade, patch: Partial<PendingCascade> | null): void {
  const stack = get().suspendedCascades;
  const idx = stack.lastIndexOf(stale);
  if (idx < 0) return;
  set({ suspendedCascades: patch ? stack.map((x, k) => (k === idx ? { ...x, ...patch } : x)) : stack.filter((_, k) => k !== idx) });
}

/** SUSPEND la cascade ACTIVE (si une l'est) : la pousse en tête de `suspendedCascades` (pile LIFO) et
 *  vide le slot `pendingCascade`. Primitive GÉNÉRIQUE (kind-agnostique, aucune mention de domaine) —
 *  déclenchée par la couture universelle `startCombat`/`transitionTo` (state/combatSlice.ts,
 *  state/store.ts) : un combat qui s'ouvre PENDANT une cascade active (ex. un abordage déclenché par
 *  l'applier d'une étape de voyage) ne doit ni écraser ni perdre les étapes restantes — le slot
 *  `pendingCascade` redevient disponible pour les cascades DU COMBAT (jets d'attaque…), gates d'action
 *  inchangés (`targetingModes.ts`/`combatSlice.ts` continuent de lire `pendingCascade` = la cascade
 *  ACTIVE). No-op si aucune cascade n'est active. */
export function suspendActiveCascade(get: Get, set: Set): void {
  const p = get().pendingCascade;
  if (!p) return;
  set({ pendingCascade: null, suspendedCascades: [...get().suspendedCascades, p] });
}

/** RÉSUME la tête de pile (`suspendedCascades`, LIFO) dans le slot `pendingCascade` — SEULEMENT si le
 *  slot est LIBRE (jamais un écrasement). Déclenchée par la couture universelle de teardown de combat
 *  (`dismissVictory`/`dismissDefeat`, state/store.ts). Renvoie `true` si une cascade a été résumée. */
export function resumeSuspendedCascade(get: Get, set: Set): boolean {
  if (get().pendingCascade) return false;
  const stack = get().suspendedCascades;
  if (!stack.length) return false;
  const top = stack[stack.length - 1];
  set({ pendingCascade: top, suspendedCascades: stack.slice(0, -1) });
  return true;
}

/**
 * PURGE les étapes d'ENTRÉE DE ZONE des cascades PARQUÉES — couture du changement de scène
 * (`transitionTo`, state/store.ts). Une carte narrative d'entrée parquée (par un combat, par une
 * autre séquence) narre la scène qu'on QUITTE : reprise plus tard, elle s'afficherait par-dessus la
 * scène SUIVANTE. La purge est bornée à CETTE classe d'étapes (`reveal.kind === 'sceneEntry'`) —
 * toute autre séquence parquée (un jour de voyage suspendu par un abordage, un Test de rencontre)
 * traverse la transition INTACTE, avec son curseur. Une séquence vidée de toutes ses étapes sort de
 * la pile ; une séquence MIXTE garde son curseur POSÉ SUR LA MÊME ÉTAPE — il est décalé du nombre
 * d'étapes purgées qui le précédaient, puis borné au reste (sinon les étapes appendues DERRIÈRE la
 * carte seraient sautées : curseur en fin = état BILAN, la modale de reprise ne les jouerait jamais).
 */
export function dropSceneEntrySteps(get: Get, set: Set): void {
  const stack = get().suspendedCascades;
  const isSceneEntry = (s: CascadeStep) => s.reveal?.kind === 'sceneEntry';
  if (!stack.some((c) => c.participants.some(isSceneEntry))) return;
  const next = stack
    .map((c) => {
      if (!c.participants.some(isSceneEntry)) return c;
      const participants = c.participants.filter((s) => !isSceneEntry(s));
      const dropped = c.participants.filter((s, i) => i < c.cursor && isSceneEntry(s)).length;
      return { ...c, participants, cursor: Math.min(Math.max(c.cursor - dropped, 0), participants.length) };
    })
    .filter((c) => c.participants.length > 0);
  set({ suspendedCascades: next });
}

/**
 * Pilote INTERACTIF : valide l'étape courante (conséquence + insertions), avance le curseur. À la
 * fin, ferme le pending et RENVOIE la cascade finalisée (pour la suite propre au `purpose` — reprise
 * de voyage, bilan… — gérée par le store). Renvoie `null` tant qu'on avance encore. L'étape courante
 * influençable doit être lancée (sinon no-op : la modale force d'abord le jet).
 */
export function advanceCascade(get: Get, set: Set): PendingCascade | null {
  const p = get().pendingCascade;
  if (!p) return null;
  const cur = p.participants[p.cursor];
  if (cur && !stepReady(cur)) return null; // jet non lancé / choix non tranché → la modale force d'abord
  let steps = p.participants;
  let suspended = false;
  // La conséquence d'une étape vit sur l'ÉTAPE (`outcome`, affichée dans la pile) — pas dupliquée
  // dans `log` (réservé aux notes hors-jet : entretien). Évite le doublon « X contracte… » écran/journal.
  if (cur) { const r = commitStep(get, set, steps, p.cursor, true); steps = r.steps; suspended = r.suspended; } // liveMerge : préserve les appends d'une conséquence foldée
  const next = p.cursor + 1;
  // SUSPENDUE en plein vol (`startCombat`/`transitionTo` déclenché par l'applier de l'étape courante) :
  // le slot ne nous appartient plus — jamais de ressuscite ici.
  //  - étapes RESTANTES (curseur avant la fin) : met à jour l'entrée de pile (étapes/curseur À JOUR),
  //    la séquence reprendra où elle en est (couture de reprise) ;
  //  - suspendue à la DERNIÈRE étape : plus rien à préserver — la séquence est FINIE. On la RETIRE de
  //    la pile et on rend la cascade FINALISÉE, pour que l'appelant joue son dénouement (`purpose`).
  //    Sans ça, la couture de reprise la ressusciterait EN BILAN par-dessus le contexte qui a pris le
  //    slot, et le dénouement ne serait jamais joué.
  if (suspended) {
    if (next >= steps.length) { reconcileSuspended(get, set, p, null); return { ...p, participants: steps, log: p.log }; }
    reconcileSuspended(get, set, p, { participants: steps, cursor: Math.min(next, steps.length) });
    return null;
  }
  if (next >= steps.length) {
    set({ pendingCascade: null });
    return { ...p, participants: steps, log: p.log };
  }
  set({ pendingCascade: { ...p, participants: steps, cursor: next } });
  return null;
}

/** « Tout lancer » : RÉSOUT d'office les étapes restantes (RNG, sans influence) — on ne peut pas
 *  « dé-dormir », les conséquences subies s'appliquent quand même — puis place le curseur EN FIN
 *  (`cursor === participants.length`) = état BILAN. La modale RESTE ouverte pour montrer TOUTES les
 *  conséquences ; c'est `finalizeCascade` (« Terminer ») qui ferme et enchaîne la suite — on rend alors
 *  `null`. SEULE exception : la DERNIÈRE étape a SUSPENDU la séquence en plein vol (`startCombat`/
 *  `transitionTo` depuis son applier) — aucun BILAN n'est montrable (le slot appartient au nouveau
 *  contexte) et il ne reste AUCUNE étape à préserver : on retire l'entrée de la pile et on rend la
 *  cascade FINALISÉE pour que l'appelant joue son dénouement (même distinction qu'`advanceCascade`). */
export function resolveRemainingCascade(get: Get, set: Set): PendingCascade | null {
  const p = get().pendingCascade;
  if (!p) return null;
  let steps = p.participants;
  let log = p.log;
  for (let i = p.cursor; i < steps.length; i++) {
    const st = steps[i];
    if (stepInteraction(st) === 'jet' && !st.result) {
      const t = rollTest(st.target!, 'intermediaire', battleRng());
      const result: CascadeRoll = { roll: t.roll, target: st.target!, sl: t.sl, success: t.success };
      steps = steps.map((x, k) => (k === i ? { ...x, result } : x));
    } else if (stepInteraction(st) === 'table') {
      // TIRAGE SUR TABLE sans influence (« Tout lancer ») : mêmes résolveur ET composition de
      // déclaration que la modale (`liveTableDecl` — modificateur vivant au moment du jet).
      const table = liveTableDecl(get(), st);
      const rolled = rollTableStep(table, battleRng());
      steps = steps.map((x, k) => (k === i ? tableStepResolved(x, table, rolled) : x));
    } else if (stepInteraction(st) === 'batch') {
      steps = steps.map((x, k) => (k === i ? { ...x, participants: rollBatchParticipants(st) } : x));
    } else if (stepInteraction(st) === 'choix' && st.chosen == null) {
      // « Tout résoudre » ne TRANCHE pas un CHOIX du joueur (dévier/subir, piéger…) : on s'arrête dessus.
      set({ pendingCascade: { ...p, participants: steps, cursor: i, log } });
      return null;
    } // affichage : rien à résoudre avant la conséquence
    const r = commitStep(get, set, steps, i);
    steps = r.steps;
    log = [...log, ...r.journal];
    // SUSPENDUE en plein vol (l'applier a déclenché `startCombat`/`transitionTo`) : le slot ne nous
    // appartient plus — jamais de ressuscite/écrase du slot actif.
    if (r.suspended) {
      if (i + 1 >= steps.length) { reconcileSuspended(get, set, p, null); return { ...p, participants: steps, log }; }
      reconcileSuspended(get, set, p, { participants: steps, cursor: Math.min(i + 1, steps.length), log });
      return null;
    }
  }
  set({ pendingCascade: { ...p, participants: steps, cursor: steps.length, log } });
  return null;
}

/** « Terminer » du BILAN (curseur en fin) : ferme la cascade et RENVOIE la cascade finalisée (suite
 *  propre au `purpose` — reprise de voyage… — gérée par le store). */
export function finalizeCascade(get: Get, set: Set): PendingCascade | null {
  const p = get().pendingCascade;
  if (!p) return null;
  set({ pendingCascade: null });
  return p;
}

/**
 * Pilote IMMÉDIAT (sans modale) : lance chaque étape (RNG) et applique sa conséquence dans l'ordre,
 * insertions comprises. Pour les repos de plusieurs jours, la reprise automatique et la triche de
 * recette. Renvoie les étapes RÉSOLUES (pour un éventuel bilan en lecture seule) — PEUT être un
 * PRÉFIXE du tableau d'entrée (combat ouvert en plein vol, OU choix sans défaut authoré, cf. ci-dessous) :
 * l'appelant DOIT vérifier `get().battle` / `get().pendingCascade` avant d'enchaîner une finalisation.
 *
 * `ctx` (optionnel) : titre/`purpose` du fragment — SEULEMENT nécessaire pour un appelant qui résout
 * un tableau DE PLUSIEURS étapes dont l'une peut ouvrir un combat en plein vol (`startCombat`, ex. la
 * cascade auto-pilotée d'un jour de voyage routine) : si le combat s'ouvre AVANT la fin du tableau, les
 * étapes RESTANTES (non encore committées) sont poussées en pile (`suspendedCascades`) — jamais perdues
 * ni résolues À L'AVEUGLE pendant que le combat tourne. Sans `ctx` (mono-étape, l'immense majorité des
 * appels), rien à préserver : la boucle s'arrête simplement (comportement historique).
 *
 * CHOIX sans `defaultChoice` authoré : jamais tranché en silence (`options[0]`) — la cascade s'arrête
 * PENDANTE, surfacée via `pendingCascade` (patron `resolveRemainingCascade`, #351).
 *
 * `ctx.rowSurface` : l'appelant DÉCLARE que les rangées de ses BANDES se montrent ailleurs qu'au
 * journal (procès-verbal structuré de traversée) — le socle n'en trace alors pas les dés (#1291). Les
 * étapes MONO du même tableau gardent leur ligne : elles n'ont pas de rangée au PV.
 */
export function runCascadeImmediate(get: Get, set: Set, steps: CascadeStep[], ctx?: { title: string; purpose: PendingCascade['purpose']; log?: string[]; rowSurface?: RowSurface }): CascadeStep[] {
  let cur = steps;
  for (let i = 0; i < cur.length; i++) {
    const st = cur[i];
    // Jet POSÉ PAR CE PILOTE : aucune fenêtre ne s'ouvrira dessus — le goulot (`commitStep`) en dérive
    // sa ligne de dé. Une étape qui ARRIVE déjà résolue (jet montré ailleurs) n'en reçoit pas.
    let unwitnessed = false;
    if (stepInteraction(st) === 'jet' && !st.result) {
      const t = rollTest(st.target!, 'intermediaire', battleRng());
      const result: CascadeRoll = { roll: t.roll, target: st.target!, sl: t.sl, success: t.success };
      cur = cur.map((x, k) => (k === i ? { ...x, result } : x));
      unwitnessed = true;
    } else if (stepInteraction(st) === 'table') {
      const table = liveTableDecl(get(), st); // même composition de déclaration que la modale
      const rolled = rollTableStep(table, battleRng());
      cur = cur.map((x, k) => (k === i ? tableStepResolved(x, table, rolled) : x));
    } else if (stepInteraction(st) === 'batch') {
      cur = cur.map((x, k) => (k === i ? { ...x, participants: rollBatchParticipants(st, true) } : x)); // résolue d'office → étampe de trace (#1281)
    } else if (stepInteraction(st) === 'choix' && st.chosen == null) {
      if (st.defaultChoice == null) {
        // Aucun défaut AUTEURISÉ (patron `resolveRemainingCascade` l.317-320) : on ne tranche PAS en
        // silence — la cascade s'arrête PENDANTE, surfacée (`pendingCascade`) pour que l'appelant/la
        // modale la reprenne (devtools `advanceRiverDay`/`skipToArrival`, cadence commandée, tout
        // futur appelant immédiat).
        set({
          pendingCascade: { title: ctx?.title ?? st.label ?? 'Choix', purpose: ctx?.purpose ?? 'test', participants: cur, cursor: i, log: ctx?.log ?? [] },
        });
        return cur;
      }
      cur = cur.map((x, k) => (k === i ? { ...x, chosen: st.defaultChoice! } : x));
    } // affichage : rien à résoudre avant la conséquence
    const r = commitStep(get, set, cur, i, false, unwitnessed, ctx?.rowSurface);
    cur = r.steps;
    // Un combat s'est ouvert PENDANT cette résolution immédiate (l'applier a appelé `startCombat` —
    // no-op de suspension ici puisque CE tableau n'était PAS dans le slot actif) : le reste du tableau
    // ne doit PAS continuer à se résoudre en silence pendant que le combat tourne — on le préserve.
    if (get().battle && i + 1 < cur.length) {
      if (ctx) set({ suspendedCascades: [...get().suspendedCascades, { title: ctx.title, purpose: ctx.purpose, participants: cur.slice(i + 1), cursor: 0, log: ctx.log ?? [] }] });
      return cur;
    }
  }
  return cur;
}

/** Un groupe de conséquences déjà calculées (lignes prêtes à afficher) — brique d'entrée pour
 *  rapatrier les conséquences d'un jet INLINE dans la modale. */
export interface ConsequenceGroup {
  kind: string;
  label: string;
  lines: string[];
  icon?: string;
  actorId?: string;
}

/** Construit une SÉQUENCE d'étapes d'AFFICHAGE à partir de groupes de conséquences (imparfaite/colère,
 *  critique, Assommante…) — pour les montrer INLINE dans la séquence. Les groupes
 *  vides sont ignorés (pas de bruit). Les mutations restent appliquées par le moteur ; ces étapes ne
 *  font qu'AFFICHER (applier muet → `commitStep` préserve l'`outcome` pré-posé). */
export function buildConsequenceSteps(groups: ConsequenceGroup[]): CascadeStep[] {
  return groups
    .filter((g) => g.lines.length > 0)
    .map((g, i): CascadeStep => ({
      id: `cons-${g.kind}-${i}`,
      kind: g.kind,
      actorId: g.actorId,
      icon: g.icon,
      label: g.label,
      outcome: toRecapLines(g.lines),
    }));
}
