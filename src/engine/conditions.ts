/**
 * États (conditions) — Livre de base, chapitre « États ».
 * Gestion minimale pour le combat tactique : ajout, empilement, retrait.
 */
import { Combatant, ActiveEffect, ConditionInstance, CATEGORY_BY_SOURCE_KIND } from './types';
import { evalCondition, type ConditionCtx, type ActorView } from './flowCore';
import { tickRound } from './duration';
import { conditionLabel, findConditionById, findPsychologyById, findSpellById, refLabel, skills } from '../data';
import { slugId } from '../data/slug';
import { t } from '../i18n';
import { rule } from './policy';
import { groupAdvantage } from './advantagePool';
import { bonus, effectiveChar } from './characteristics';
import { d100, RNG, defaultRNG } from './dice';
import { passiveMods, passiveGlobalTestMod, passiveGlobalTestParts, settleHealedCriticals } from './trauma';
import type { GameOp } from './ops';
import type { CodexTarget } from './ruleRefs';
import { rollTest, isDoubleRoll, type TestResult } from './tests';
import { dropExpiredGrantedTraits } from './grantedTraits';
import { dropExpiredGrantedResources } from './grantedResources';
import { dropExpiredGrantedWeapons } from './conjuredWeapons';
import { dropExpiredGrantedMutations } from './corruption';
import { recomputeLoadout } from './items';
import { refreshWounds } from './characteristics';
import { restoreSuppressedPsych } from './psychology';
import { hasActiveFlag } from './activeFlags';
import { applyOps } from './ops'; // cycle runtime (ops→conditions) : applyOps n'est appelé qu'au tick, jamais à l'init du module
import { aaDeathByCriticalCount } from './aaCritical'; // cycle runtime (aaCritical→combat→conditions) : appelé seulement dans inDeathCondition, jamais à l'init

/** Les 12 États CANONIQUES (LDB 16) à comportement moteur, par `id` STABLE (slug d'etats.json). Le
 *  moteur (pénalités, fin de Round, récupération) les référence via ces constantes — JAMAIS de chaîne
 *  magique. `ConditionInstance.name` reste OUVERT (string) : le Codex peut créer d'AUTRES États (posés/
 *  affichés ; leur mécanique RAW serait à câbler). Garde-fou de synchro `COND`⇄etats.json : `conditions.test`. */
export const COND = {
  assourdi: 'assourdi', aTerre: 'a-terre', aveugle: 'aveugle', brise: 'brise',
  empetre: 'empetre', empoisonne: 'empoisonne', enFlammes: 'en-flammes', extenue: 'extenue',
  hemorragique: 'hemorragique', inconscient: 'inconscient', sonne: 'sonne', surpris: 'surpris',
} as const;

/** Nombre de pions (cumul) d'un État donné. */
export const stacks = (c: Combatant, name: string) => c.conditions.find((x) => x.id === name)?.value ?? 0;

/** Marqueurs NARRATIFS hors LDB 16 (PAS des États `etats.json`, cf. `data-wellformed.test`) : Pétrifié
 *  (LDB 85), sans entrée catalogue — sévérité portée ICI, unique exception. */
const NARRATIVE_MARKER_SEVERITY: Record<string, number> = { petrifie: 95 };

/** Sévérité d'un État (`etats.json` : `severity`, sinon marqueur narratif, sinon défaut 10) — PUR, clé
 *  slugifiée (tolère un libellé : 'Pétrifié' → 'petrifie'). SOURCE UNIQUE partagée par l'icône
 *  (`gameIso/effectIcons.conditionMeta`, `important` = sévérité ≥ 50) ET l'importance d'un évènement de
 *  combat pour le bandeau/la cadence (`state/combatLog.isImportantEvent`). */
export function conditionSeverity(name: string): number {
  const id = slugId(name);
  return findConditionById(id)?.severity ?? NARRATIVE_MARKER_SEVERITY[id] ?? 10;
}

/**
 * Hook injecté (inversion de dépendance) appelé quand `c` GAGNE un État (nouveau ou empilé) — le
 * moteur reste PUR (il ne connaît ni le store, ni les triggers). Le store le remplit (module feuille)
 * pour câbler le déclencheur `onGainCondition` (Mâchoires d'acier : « chaque fois que vous gagnez un
 * État Sonné »). Absent ⇒ aucune réaction (création de perso, effets hors combat, tests purs).
 */
let onConditionGained: ((c: Combatant, name: string) => void) | undefined;
export function setConditionGainedHook(fn: ((c: Combatant, name: string) => void) | undefined): void {
  onConditionGained = fn;
}

/** Retrait d'États « 1 + DR » borné au nombre de pions présents (LDB 16 : Empêtré l.61,
 *  En flammes l.77, Empoisonné l.70, Sonné l.125, arrêt d'Hémorragie l.107). Un Test raté n'en retire aucun. */
export function recoveredStacks(dr: number, stacks: number, success: boolean): number {
  if (!success || stacks <= 0) return 0;
  return Math.min(stacks, 1 + Math.max(0, dr));
}

export function addCondition(c: Combatant, name: string, value = 1, escapeStrength?: number, lockedUntil?: import('./flowCore').Condition, unlockBy?: import('./types').ConditionUnlock, escapeThreshold?: number, entangleOnFail?: boolean, struggleDamage?: number): void {
  if (!groupAdvantage()) c.advantage = 0; // « Si vous subissez un État quel qu'il soit, vous perdez tout Avantage » (LDB 16 l.15) — pas de perte per-combattant en mode « Avantage de groupe » (la réserve du camp ne change pas)
  const existing = c.conditions.find((x) => x.id === name);
  if (existing) {
    existing.value += value;
    // Force d'évasion (Empêtré « se libérer » — LDB 16 l.61) : sur ré-application, on garde la PLUS
    // CONTRAIGNANTE (max), pour qu'un Enchevêtrement ne soit pas affaibli par un État Empêtré « banal »
    // qui s'empile par-dessus (et inversement, un sort plus fort durcit l'évasion).
    if (escapeStrength != null) existing.escapeStrength = Math.max(existing.escapeStrength ?? 0, escapeStrength);
    if (escapeThreshold != null) existing.escapeThreshold = Math.max(existing.escapeThreshold ?? 0, escapeThreshold);
    if (entangleOnFail) existing.entangleOnFail = true;
    if (struggleDamage != null) existing.struggleDamage = Math.max(existing.struggleDamage ?? 0, struggleDamage);
    if (lockedUntil != null) existing.lockedUntil = lockedUntil; // un Critique re-verrouille l'État déjà porté
    if (unlockBy != null) existing.unlockBy = unlockBy; // un Critique re-verrouille l'État déjà porté (acte de soin, LDB 18)
    // Un ajout NON temporisé sur un État à durée : la durée saute (l'État redevient régi
    // par ses règles normales — on n'écourte jamais un État au prétexte qu'un sort expirait).
    delete existing.roundsLeft;
  } else {
    c.conditions.push({ id: name, value, ...(escapeStrength != null ? { escapeStrength } : {}), ...(escapeThreshold != null ? { escapeThreshold } : {}), ...(entangleOnFail ? { entangleOnFail } : {}), ...(struggleDamage != null ? { struggleDamage } : {}), ...(lockedUntil != null ? { lockedUntil } : {}), ...(unlockBy != null ? { unlockBy } : {}) });
  }
  // L'État vient d'être GAGNÉ (nouveau ou empilé) → déclenche `onGainCondition` (Mâchoires d'acier).
  onConditionGained?.(c, name);
}

/** Ajout d'un État À DURÉE (posé par un sort : « 1 État Sonné qui dure N Rounds », LDB).
 *  Sur un État déjà porté : temporisé → durée max conservée ; NON temporisé → inchangé
 *  (la durée du sort ne raccourcit pas un État permanent). */
export function addTimedCondition(c: Combatant, name: string, value: number, rounds: number, escapeStrength?: number, escapeThreshold?: number, entangleOnFail?: boolean, struggleDamage?: number): void {
  const existing = c.conditions.find((x) => x.id === name);
  if (existing) {
    if (!groupAdvantage()) c.advantage = 0;
    existing.value += value;
    if (escapeStrength != null) existing.escapeStrength = Math.max(existing.escapeStrength ?? 0, escapeStrength);
    if (escapeThreshold != null) existing.escapeThreshold = Math.max(existing.escapeThreshold ?? 0, escapeThreshold);
    if (entangleOnFail) existing.entangleOnFail = true;
    if (struggleDamage != null) existing.struggleDamage = Math.max(existing.struggleDamage ?? 0, struggleDamage);
    if (existing.roundsLeft != null) existing.roundsLeft = Math.max(existing.roundsLeft, rounds);
    // sinon : instance non temporisée — elle le reste.
    onConditionGained?.(c, name); // État empilé (gagné) → déclenche `onGainCondition`
  } else {
    addCondition(c, name, value, escapeStrength, undefined, undefined, escapeThreshold, entangleOnFail, struggleDamage); // (déclenche déjà `onGainCondition`)
    c.conditions.find((x) => x.id === name)!.roundsLeft = rounds;
  }
}

/** Ajout d'un État à durée d'HORLOGE (`until` = minute `gameTime` d'échéance) — Belladone : « Un sommeil
 *  induit par la belladone dure 1d10 + 4 heures » (LDB 72 l.18), Fleur de lune (LDB 71 l.29). Purgé par
 *  `purgeClockEffects` (upkeep), même patron que `castPenalties.untilTime`. Sur un État déjà porté :
 *  temporisé-horloge → échéance MAX conservée ; NON temporisé → inchangé (on n'écourte jamais un État
 *  permanent au prétexte qu'une drogue expirait). */
export function addClockCondition(c: Combatant, name: string, value: number, until: number, escapeStrength?: number, escapeThreshold?: number, entangleOnFail?: boolean, struggleDamage?: number): void {
  const existing = c.conditions.find((x) => x.id === name);
  if (existing) {
    if (!groupAdvantage()) c.advantage = 0; // « Si vous subissez un État, vous perdez tout Avantage » (LDB 16 l.15) — inerte en mode « Avantage de groupe »
    existing.value += value;
    if (escapeStrength != null) existing.escapeStrength = Math.max(existing.escapeStrength ?? 0, escapeStrength);
    if (escapeThreshold != null) existing.escapeThreshold = Math.max(existing.escapeThreshold ?? 0, escapeThreshold);
    if (entangleOnFail) existing.entangleOnFail = true;
    if (struggleDamage != null) existing.struggleDamage = Math.max(existing.struggleDamage ?? 0, struggleDamage);
    if (existing.untilTime != null) existing.untilTime = Math.max(existing.untilTime, until);
    // sinon : instance non temporisée — elle le reste.
    onConditionGained?.(c, name); // État empilé (gagné) → déclenche `onGainCondition`
  } else {
    addCondition(c, name, value, escapeStrength, undefined, undefined, escapeThreshold, entangleOnFail, struggleDamage); // (déclenche déjà `onGainCondition`)
    c.conditions.find((x) => x.id === name)!.untilTime = until;
  }
}

/** Un État posé par un Critique est-il VERROUILLÉ (LDB 18) ? Deux formes, INDÉPENDANTES d'un trauma porteur :
 *  - `unlockBy` (acte de soin) : verrouillé tant que l'acte NOMMÉ (Aide Médicale / Chirurgie / magie) n'a pas
 *    été reçu — l'acte le lève via `releaseConditionLocks` (Aveuglé/Sonné/Inconscient « par Aide Médicale »,
 *    Hémorragique « par Chirurgie ») ;
 *  - `lockedUntil` (prédicat d'état, algèbre flowCore) : verrouillé tant que la Condition n'est pas VRAIE contre
 *    l'état VIVANT du porteur (Aveuglé « tant que tous les Hémorragique n'ont pas été éliminés », Tête 46-50 ⇒
 *    `compare hemorragique == 0`).
 *  Tant qu'il tient, `removeCondition` (dont l'auto-dissipation) est inerte sur cet État. */
export function isConditionLocked(inst: ConditionInstance, c: Combatant): boolean {
  if (inst.unlockBy != null) return true; // verrou d'acte de soin non encore levé (LDB 18)
  if (!inst.lockedUntil) return false;
  const ctx: ConditionCtx = {
    // Prédicat d'état du porteur : États par nom (`compare`). Aucun drapeau de trauma (le verrou d'Aide Médicale
    // est désormais porté par `unlockBy`, plus par `awaitingMedicalAid` d'une séquelle porteuse).
    flags: {},
    gameTime: 0,
    target: { conditions: Object.fromEntries((c.conditions ?? []).map((x) => [x.id, x.value])) } as unknown as ActorView,
  };
  return !evalCondition(inst.lockedUntil, ctx);
}

/** Un acte `act` LÈVE-t-il un verrou d'État `unlockBy` (LDB 18) ? Le soin magique compte AUSSI comme Aide
 *  Médicale (LDB 18 l.311) → `magic` lève `medicalAid` ET `magic` ; sinon l'acte ne lève que son homonyme
 *  (Aide Médicale ne lève pas un verrou de Chirurgie ; la Chirurgie ne lève pas un verrou magique). */
function actLifts(unlockBy: import('./types').ConditionUnlock, act: import('./types').ConditionUnlock): boolean {
  return unlockBy === act || (act === 'magic' && unlockBy === 'medicalAid');
}

/** Applique un acte de soin `act` : RETIRE tout État dont le verrou `unlockBy` est levé par cet acte (LDB 18 :
 *  « ne peut être retiré QUE par [acte] » ⇒ l'acte est ce qui le soigne). SOURCE UNIQUE appelée à chaque point
 *  de soin (`receiveMedicalAid`/soin magique → medicalAid/magic ; fin de Chirurgie → surgery). Pur ; renvoie le journal. */
export function releaseConditionLocks(c: Combatant, act: import('./types').ConditionUnlock): string[] {
  const log: string[] = [];
  for (const inst of [...c.conditions]) {
    if (inst.unlockBy == null || !actLifts(inst.unlockBy, act)) continue;
    delete inst.unlockBy; // le verrou tombe → removeCondition n'est plus inerte
    removeCondition(c, inst.id, inst.value); // l'acte SOIGNE l'État (LDB 18 : retiré par cet acte)
    log.push(t('cond.lockReleased', { name: c.label, cond: conditionLabel(inst.id) }));
  }
  return log;
}

/** Le porteur a-t-il un État dont le retrait est VERROUILLÉ par la Chirurgie (LDB 18 : Hémorragie interne) ?
 *  Rend la Chirurgie proposable/soignante à l'Infirmerie même sans Blessure Critique chirurgicale porteuse. */
export function hasSurgeryLockedCondition(c: Combatant): boolean {
  return (c.conditions ?? []).some((x) => x.unlockBy === 'surgery');
}

export function removeCondition(c: Combatant, name: string, value = 1): void {
  const existing = c.conditions.find((x) => x.id === name);
  if (!existing) return;
  if (isConditionLocked(existing, c)) return; // verrou de Critique (LDB 18) : ne part pas tant que sa Condition n'est pas remplie
  existing.value -= value;
  if (existing.value <= 0) c.conditions = c.conditions.filter((x) => x.id !== name);
  // Main ensanglantée (AA 07 l.117) : le Test de Dextérité par Action tient « tant que vous êtes sous
  // l'effet de cet État » → l'Hémorragique épuisé (instance retirée) lève TOUS les gates de main (op
  // `handGate`). LEVER machinerie UNIQUE de la durée du marqueur (l'Hémorragique ne s'empile qu'en 1 instance).
  if (name === COND.hemorragique && existing.value <= 0) delete c.handGates;
  // POINT UNIQUE de retrait d'État → une Blessure critique dont tous les États associés sont désormais tombés
  // est GUÉRIE (LDB 18 l.304) : octroie la cicatrice post-guérison (Blessure spectaculaire / Nez cassé, l.61/72).
  settleHealedCriticals(c);
}

export function hasCondition(c: Combatant, name: string): boolean {
  return c.conditions.some((x) => x.id === name);
}

/** Sommeil MAGIQUE (sort Sommeil → Inconscient À DURÉE ; Belladone/Fleur de lune → Inconscient d'horloge) :
 *  le dormeur est Inconscient MAIS a des PB (≠ un KO à 0 PB). On le distingue par la présence d'une durée
 *  d'État (`roundsLeft`/`untilTime`) sur son Inconscient ET `wounds.current > 0`. Lu par le modifier de
 *  réveil-à-l'attaque (« bruits/bousculade la réveillent », sort Sommeil) — sans MJ, le moteur applique la règle. */
export function isMagicallyAsleep(c: Combatant): boolean {
  const inc = c.conditions.find((x) => x.id === COND.inconscient);
  return !!inc && (inc.roundsLeft != null || inc.untilTime != null) && c.wounds.current > 0;
}

/** Réveille un dormeur magique : retire son Inconscient de sommeil. Le dormeur, désormais éveillé, encaisse
 *  l'attaque qui l'a réveillé (il n'a pas pu la défendre — il dormait). */
export function wakeSleeper(c: Combatant): void {
  const inc = c.conditions.find((x) => x.id === COND.inconscient);
  if (inc) removeCondition(c, COND.inconscient, inc.value);
}

/** Le `testMod` GLOBAL porté par UN effet actif — CRITÈRE UNIQUE, partagé par la somme
 *  (`effectTestMod`) et par le détail nommé (`combatTestPenaltyParts`). EXCLUT les mods
 *  char-QUALIFIÉS (`testModChar` — Mystracine ±10 par Caractéristique), lus par `testValue` pour la
 *  seule carac visée. */
function effectGlobalTestMod(e: ActiveEffect): number {
  return e.testModChar == null ? (e.testMod ?? 0) : 0;
}

/** Modificateur GLOBAL de Test porté par les effets actifs (Malédiction de malchance −10, etc.) —
 *  SOMMÉ (sources distinctes qui stackent), appliqué PAR-DESSUS la pénalité d'État (≠ État : ni
 *  non-cumul l.20, ni effacé par `ignoreStatePenalties`). */
export function effectTestMod(c: Combatant): number {
  return (c.activeEffects ?? []).reduce((s, e) => s + effectGlobalTestMod(e), 0);
}

/** Les `testMod` portés par les États du combattant (kind `etat`), déjà ×pions (perStack) par le
 *  collecteur, AVEC l'identité Codex de l'État/état psy qui les porte (`PassiveMod.src`). Lus en
 *  « PIRE seul » par combatTestPenaltyParts/testStatePenalty (non-cumul, LDB 16 l.20). */
function etatTestMods(c: Combatant): { op: Extract<GameOp, { op: 'testMod' }>; src?: CodexTarget }[] {
  const out: { op: Extract<GameOp, { op: 'testMod' }>; src?: CodexTarget }[] = [];
  for (const m of passiveMods(c)) if (m.kind === 'etat' && m.op.op === 'testMod') out.push({ op: m.op, src: m.src });
  return out;
}

/** Nombre d'États dont les pénalités de Test sont IGNORÉES (op `ignoreStatePenalties{count}` — « Les dames
 *  de L'Anguille », MDG 09 l.244 : « peut ignorer un État », UN seul au choix). Σ des effets actifs porteurs. */
function ignoredStatesCount(c: Combatant): number {
  return (c.activeEffects ?? []).reduce((s, e) => s + (e.ignoreStatesCount ?? 0), 0);
}

/** Un candidat du POOL non-cumul (LDB 16 l.20), avec l'identité de ce qui l'octroie. `nature` = la
 *  FAMILLE du candidat (État, aura de trait…), servie à l'affichage quand `src` manque : un candidat
 *  non identifié ne doit pas emprunter le nom d'une AUTRE famille (une aura n'est pas un État). */
interface PoolCandidate { amount: number; nature: string; src?: CodexTarget }

/** Retire les N PIRES candidats (les plus négatifs) du pool de pénalités d'État — « ignorer UN État » :
 *  le pool non-cumul (le pire seul s'applique, LDB 16 l.20) rend rationnel d'ignorer le pire d'abord.
 *  L'ORDRE DE COLLECTE des survivants est préservé (il départage les ex æquo, cf. `poolWinner`). */
function dropWorst(cand: PoolCandidate[], n: number): PoolCandidate[] {
  if (n <= 0) return cand;
  const dropped = new Set([...cand.keys()].sort((a, b) => cand[a].amount - cand[b].amount).slice(0, n));
  return cand.filter((_, i) => !dropped.has(i));
}

/** Le gagnant du POOL : « vous choisissez la pénalité la plus importante » (LDB 16 l.13). Le RAW ne
 *  départage PAS deux candidats de même magnitude ; arbitrage maison DÉTERMINISTE : le PREMIER dans
 *  l'ordre de collecte (États dans l'ordre de `Combatant.conditions`, puis états psychologiques,
 *  puis auras projetées) — comparaison STRICTE, un ex æquo ne détrône pas le tenant. */
function poolWinner(cand: PoolCandidate[]): PoolCandidate | undefined {
  return cand.reduce<PoolCandidate | undefined>((best, x) => (best == null || x.amount < best.amount ? x : best), undefined);
}

/** Nom d'AFFICHAGE de l'entité SOURCE d'une composante (résolveur de libellé GÉNÉRIQUE `refLabel`,
 *  data — ids en donnée, labels à l'écran). `src` absent = source non identifiée par le collecteur :
 *  reste le nom de la FAMILLE d'où sort la composante, jamais celui d'une autre. */
function srcLabel(src: CodexTarget | undefined, nature: string): string {
  return src ? refLabel(src.category, { id: src.id }) : nature;
}

/** Renvoi Codex d'un effet actif : son entité SOURCE (`EffectSource`, table TOTALE
 *  `CATEGORY_BY_SOURCE_KIND`), sinon le sort qui l'a posé. Absent = effet sans ancrage de règle. */
function effectRef(e: ActiveEffect): CodexTarget | undefined {
  if (e.source) return { category: CATEGORY_BY_SOURCE_KIND[e.source.kind], id: e.source.id };
  return e.sourceSpellId ? { category: 'spells', id: e.sourceSpellId } : undefined;
}

/** UNE composante NOMMÉE de la pénalité de Test de combat — structurellement une `ModLine`
 *  (`engine/combat`), poussée telle quelle par les trois producteurs via `conditionModLines`. */
export interface TestPenaltyPart { label: string; value: number; ref?: CodexTarget }

/**
 * Pénalité aux Tests de COMBAT (LDB 16), DÉCOMPOSÉE en lignes nommées — SOURCE UNIQUE du calcul ET
 * de son affichage. Trois familles, jamais fondues sous un même intitulé :
 *  1. le POOL non-cumul (l.20) — États, états psychologiques et auras de trait : UNE ligne, celle du
 *     gagnant, au nom de SON entité (« −30 Brisé ») avec son renvoi Codex ;
 *  2. les effets ACTIFS à `testMod` global (Malédiction de malchance) : une ligne PAR effet, à son nom ;
 *  3. les `testMod` globaux de symptôme (Crampes abdominales, MSRC 16 l.152) : une ligne PAR symptôme.
 * Les familles 2 et 3 STACKENT avec 1 (hors pool, et hors du gate `ignoreStatePenalties`).
 */
export function combatTestPenaltyParts(c: Combatant): TestPenaltyPart[] {
  let cand: PoolCandidate[] = [];
  // Endurance de l'anachorète (LDB 42) : « ne subit aucune pénalité causée par les États » —
  // n'efface QUE les pénalités d'État (l'aura Perturbante est un trait, pas un État).
  if (!hasActiveFlag(c, 'ignoreStatePenalties')) {
    for (const m of etatTestMods(c)) {
      if (m.op.movementOnly) continue; // pénalité de DÉPLACEMENT (À Terre/Empêtré) — pas un Test de combat
      if (m.op.hearingOnly) continue; // pénalité d'AUDITION (Assourdi) — pas un Test de combat (l.29)
      cand.push({ amount: m.op.amount, nature: 'État', src: m.src }); // magnitude/portée en données (etats.json) ; déjà ×pions (Exténué)
    }
    cand = dropWorst(cand, ignoredStatesCount(c)); // « peut ignorer un État » (MDG 09 l.244)
  }
  // Auras de combat (Perturbant : −20 à BE m, LDB 85 p.341) — `testMod` projetés dans `auraMods` par le hook
  // `recompute-auras`. HORS du gate `ignoreStatePenalties` : une aura est un TRAIT, pas un État (Endurance de
  // l'anachorète ne l'annule pas, LDB 42). Non-cumul = même pool (« une seule fois », LDB 85 l.208).
  for (const m of c.auraMods ?? []) if (m.op.op === 'testMod' && m.op.char == null) cand.push({ amount: m.op.amount, nature: 'Aura', src: m.src });
  const out: TestPenaltyPart[] = [];
  const best = poolWinner(cand);
  if (best?.amount) out.push({ label: srcLabel(best.src, best.nature), value: best.amount, ref: best.src });
  // Modificateur de Sort (Malédiction de malchance) + pénalité GLOBALE de maladie (Crampes abdominales −20,
  // MSRC 16 l.152) : STACKENT tous deux avec l'État (hors pool non-cumul des États, LDB 16 l.20).
  for (const e of c.activeEffects ?? []) {
    const amount = effectGlobalTestMod(e);
    if (amount) out.push({ label: e.label, value: amount, ref: effectRef(e) });
  }
  for (const m of passiveGlobalTestParts(c)) {
    const { amount } = m.op as Extract<GameOp, { op: 'testMod' }>;
    if (amount) out.push({ label: srcLabel(m.src, 'Symptôme'), value: amount, ref: m.src });
  }
  return out;
}

/** Σ de `combatTestPenaltyParts` — la VALEUR que roule le résolveur (l'affichage et le jet ne peuvent
 *  pas diverger : ils lisent les mêmes composantes). */
export function combatTestPenalty(c: Combatant): number {
  return combatTestPenaltyParts(c).reduce((s, p) => s + p.value, 0);
}

/**
 * Pénalité d'États aux Tests HORS COMBAT (LDB 16). Non-cumul (l.20 : la PIRE pénalité seule) ; le
 * modificateur de Sort (effectTestMod) s'ajoute par-dessus. Magnitudes/portées en DONNÉES (etats.json
 * passive `testMod` : `combatOnly`/`movementOnly`/`exceptSkills`), lues via passiveMods (kind `etat`).
 * Les États non classables hors combat (Aveuglé=vue, `combatOnly`) sont exclus ici.
 */
// Tests « impliquant un déplacement » (LDB 16 l.37/l.85) — classification DÉRIVÉE de la donnée
// (`SkillData.movement`, éditable au Codex), plus de liste d'ids en dur. Acrobaties (spé de
// Représentation) non classables à l'id de base → non couvertes.
const MOVEMENT_SKILL = new Set(skills.filter((s) => s.movement).map((s) => s.id));
// Tests « impliquant l'audition » (Assourdi −10, LDB 16 l.29) — même patron DONNÉE (`SkillData.hearing`).
const HEARING_SKILL = new Set(skills.filter((s) => s.hearing).map((s) => s.id));
/** Le Test `skill` est-il classé « déplacement » (`SkillData.movement`) ? Réutilisée par #193
 *  (Épaule luxée/Genou démis : `testMod.movementOnly` = MÊME catégorie que l'État À Terre/Empêtré). */
export function isMovementSkill(skill?: string): boolean {
  return MOVEMENT_SKILL.has(skill ?? '');
}

/** Σ des `testMod` char-QUALIFIÉS ACTIFS (op `testMod{char}` exécutée, #193) pour la Caractéristique
 *  `ck` — POINT UNIQUE partagé par `testValue` (Tests hors-combat), `combatValue`/`defenseValue`
 *  parade (Tests d'arme, `weaponHand` gaté) et `defenseValue` Esquive (`movement:true`). `weaponHand`/
 *  `movement` : contexte du Test COURANT, opposé aux gates portés par l'effet (`testModHand`/
 *  `testModMovementOnly`) — absents des DEUX côtés = mod global (comportement historique). */
export function activeCharTestMod(c: Combatant, ck: import('./types').CharKey, ctx: { weaponHand?: 'main' | 'off'; movement?: boolean } = {}): number {
  return (c.activeEffects ?? []).reduce((s, e) => {
    if (e.testModChar !== ck) return s;
    if (e.testModHand != null && e.testModHand !== ctx.weaponHand) return s;
    if (e.testModMovementOnly && !ctx.movement) return s;
    return s + (e.testMod ?? 0);
  }, 0);
}
export function testStatePenalty(c: Combatant, skill?: string): number {
  // Modificateur de Sort + pénalité GLOBALE de maladie (Crampes abdominales −20, MSRC 16 l.152) : STACKENT,
  // hors du non-cumul des États — présents même sans État et malgré Endurance de l'anachorète (LDB 42).
  const effMod = effectTestMod(c) + passiveGlobalTestMod(c);
  if (!c.conditions?.length) return effMod;
  // Endurance de l'anachorète (LDB 42) : aucune pénalité d'État pour la durée (le modificateur de Sort reste).
  if (hasActiveFlag(c, 'ignoreStatePenalties')) return effMod;
  let cand: PoolCandidate[] = [];
  for (const m of etatTestMods(c)) {
    if (m.op.combatOnly) continue; // Aveuglé (vue) : non classé hors combat (faute de classification du Test)
    if (m.op.movementOnly && !MOVEMENT_SKILL.has(skill ?? '')) continue; // À Terre/Empêtré : Tests de déplacement seuls
    if (m.op.hearingOnly && !HEARING_SKILL.has(skill ?? '')) continue; // Assourdi : Tests d'audition seuls (Perception)
    if (m.op.exceptSkills?.includes(skill ?? '')) continue; // Brisé : sauf course (Athlétisme) / dissimulation (Discrétion)
    cand.push({ amount: m.op.amount, nature: 'État', src: m.src });
  }
  cand = dropWorst(cand, ignoredStatesCount(c)); // « peut ignorer un État » (MDG 09 l.244)
  return (poolWinner(cand)?.amount ?? 0) + effMod;
}

/**
 * Bonus pour TOUCHER en mêlée une cible affectée (LDB 16). Deux familles, lues en DONNÉES
 * (`incomingAttackMod` des `passive` d'État, kind `etat`) :
 *  - INCONDITIONNELS (À Terre/Surpris +20, Aveuglé +10) : non-cumul, le MEILLEUR seul (LDB 16 l.13) ;
 *  - flanc/derrière (Assourdi +10, `flankRear:true`) : bonus SUPPLÉMENTAIRE (LDB 16 l.29) ADDITIF, appliqué
 *    SEULEMENT si `opts.flankRear` (l'appelant a établi l'angle via le facing) ; plusieurs Assourdi ne
 *    l'augmentent pas → max entre entrées flankRear (« ce bonus n'est pas augmenté avec de multiples Assourdi »).
 */
export function meleeAttackerBonus(target: Combatant, opts?: { flankRear?: boolean }): number {
  let best = 0;  // pool non-cumul des bonus inconditionnels
  let flank = 0; // bonus flanc/dos ADDITIF (« supplémentaire »)
  for (const m of passiveMods(target)) {
    if (m.kind === 'etat' && m.op.op === 'incomingAttackMod' && (m.op.mode === 'melee' || m.op.mode === 'all')) {
      if (m.op.flankRear) { if (opts?.flankRear) flank = Math.max(flank, m.op.amount); }
      else best = Math.max(best, m.op.amount);
    }
  }
  return best + flank;
}

/**
 * Avantage(s) GAGNÉ(s) par l'assaillant qui frappe `target` en mêlée — lu en DONNÉES (`passive`
 * `incomingAdvantage` melee/all, kind `etat`). Sonné : « +1 Avantage avant l'attaque » (LDB 16 l.123).
 * Non-cumul : le MEILLEUR seul (comme `meleeAttackerBonus`). ≠ bonus de TOUCHE (`meleeAttackerBonus`).
 */
export function incomingMeleeAdvantage(target: Combatant): number {
  let best = 0;
  for (const m of passiveMods(target)) {
    if (m.kind === 'etat' && m.op.op === 'incomingAdvantage' && (m.op.mode === 'melee' || m.op.mode === 'all')) {
      best = Math.max(best, m.op.amount);
    }
  }
  return best;
}

/** Restrictions d'Action/Mouvement/défense imposées par les STATUTS portés (États ET Psychologie) —
 *  lues en DONNÉES (`StatusData.gating`, etats.json/psychology.json), JAMAIS par-nom : un nouvel État/
 *  trait psy déclare son blocage dans le JSON et le moteur l'applique. Agrégation : `action:'none'` et
 *  `cannotDefend` sont des OU (un seul statut bloquant suffit) ; le Mouvement prend le PIRE
 *  (`none` > `half`/`crawl` > normal). « Etat comme Psy » : `PsychologyData extends StatusData`. */
export function conditionGating(c: Combatant): { noAction: boolean; cannotDefend: boolean; movement: 'normal' | 'half' | 'none' } {
  let noAction = false; let cannotDefend = false; let movement: 'normal' | 'half' | 'none' = 'normal';
  const apply = (g?: { action?: 'none'; movement?: 'none' | 'half' | 'crawl'; cannotDefend?: true }): void => {
    if (!g) return;
    if (g.action === 'none') noAction = true;
    if (g.cannotDefend) cannotDefend = true;
    if (g.movement === 'none') movement = 'none';
    else if ((g.movement === 'half' || g.movement === 'crawl') && movement !== 'none') movement = 'half';
  };
  for (const cond of c.conditions ?? []) apply(findConditionById(cond.id)?.gating);
  for (const p of c.psychState ?? []) apply(findPsychologyById(p.type)?.gating);
  return { noAction, cannotDefend, movement };
}

/** Ne peut pas se défendre lors d'un Test opposé (Surpris LDB 16 l.132 / Inconscient l.112 « rien faire
 *  de votre tour ») — lu du `gating.cannotDefend` des statuts portés (données, plus de liste par-nom). */
export function cannotDefend(c: Combatant): boolean {
  return conditionGating(c).cannotDefend;
}

/** Le combattant peut-il effectuer son Action ce tour ? Faux si un statut porté déclare `gating.action:
 *  'none'` (Sonné « incapable d'effectuer votre Action », LDB 16 l.123 ; Surpris/Inconscient). Données. */
export function canTakeAction(c: Combatant): boolean {
  return !conditionGating(c).noAction;
}

/** États portés par `c` dont la DONNÉE déclare `restrictsAction` (Brisé : Mouvement + Action verrouillés
 *  pour fuir/se cacher, LDB 16 l.55) — lus en DONNÉES (etats.json), JAMAIS par-nom. `stacks` = pions portés. */
export function restrictingConditions(c: Combatant): { id: string; stacks: number }[] {
  const out: { id: string; stacks: number }[] = [];
  for (const cond of c.conditions ?? []) {
    if (findConditionById(cond.id)?.restrictsAction) out.push({ id: cond.id, stacks: cond.value });
  }
  return out;
}

/** Le combattant porte-t-il un État qui VERROUILLE son Action (`restrictsAction`) ? Une seule vérité de
 *  données partagée par le gate de hotbar (`battleSelectAction`) ET l'IA (`planProactiveSpend`). */
export function isActionLocked(c: Combatant): boolean {
  return restrictingConditions(c).length > 0;
}

/**
 * (Résistance à l'Empoisonné — LDB 16 l.70-72 — n'est PLUS du code moteur : c'est un `effects: onRoundEnd`
 *  à nœud `test` dans `etats.json` (retire 1+DR via `removeCondition`, puis Exténué si vidé via `if`/
 *  `condition`), résolu par le DISPATCHER UNIQUE — cadence-aware en combat, inline hors-combat. Plus de
 *  `poisonResistValue`/`poisonResistApply` par-nom ici.)
 */

/**
 * Fin de Round : dégâts périodiques (Hémorragique/Empoisonné/En flammes) et
 * dissipation des États temporaires (LDB 16). Retourne un journal.
 *
 * `opts.skipPoisonResist` : NE roule PAS le Test de Résistance d'Empoisonné (les DÉGÂTS sont
 * appliqués quand même). Posé par le hook `end-of-round` pour un HÉROS → le Test devient une étape
 * de cascade influençable (cf. `collectHeroRoundEndUpkeep`). Les DÉGÂTS restent ici pour tous ; seul
 * le Test est différé. ENNEMIS : `opts` absent → comportement (et ORDRE RNG) inchangé.
 */
export function endOfRound(c: Combatant, rng: RNG = defaultRNG): string[] {
  const log: string[] = [];
  // Hémorragique : dégâts par-round (« 1 Blessure par pion, en ignorant les modificateurs », l.104) MIGRÉS
  // en données — etats.json hemorragique `effects: onRoundEnd → wounds {stacks:'self'}` (défaut : ignore
  // BE+PA), avec `stacksReducedBy:'bleedIgnore'` pour l'Endurci (LDB 10), joué par fireConditionEffects.
  // Le jet de MORT par hémorragie (d100 ≤ 10×pions, coagulation) reste `bleedDeathRoll` (règle de mort).
  // Empoisonné : dégâts par-round (« 1 PB/pion, en ignorant les modificateurs ») MIGRÉS en DONNÉES —
  // `etats.json` empoisonne `effects: onRoundEnd → wounds {stacks:'self'}` (le défaut de `wounds` ignore
  // BE+PA), joués par `fireConditionEffects` au hook order-10. Le Test de Résistance qui élimine l'État
  // reste le hook `poison-resist` (cadence-aware).
  // En Flammes : dégâts par-round MIGRÉS en données (etats.json `effects: onRoundEnd → wounds`,
  // amount {sum:[1d10, pions, −1]} − BE − PA de la Localisation la moins protégée, min 1 ; LDB 16 l.77),
  // joués par fireConditionEffects.
  // Sonné : Test de Résistance Intermédiaire (+0) en fin de Round (retire 1+DR ; vidé → 1 Exténué « si pas
  // déjà », LDB 16 l.123-127) MIGRÉ en DONNÉES — `etats.json` sonne `effects: onRoundEnd → {test → removeCondition
  // 1+DR, `if` sonne∧extenue vidés → condition extenue}`, résolu par le DISPATCHER UNIQUE (cadence-aware en
  // combat, inline hors-combat). Le −10 du Sonné s'applique au jet via `combatTestPenalty` (rawCombatTestBase).
  // Auto-dissipation en fin de Round (Aveuglé l.48 / Assourdi l.32 / Surpris l.136) MIGRÉE en données :
  // `effects: [{trigger:'onRoundEnd', flow:…removeCondition}]` dans etats.json, jouée par fireConditionEffects.
  // Effets RÉCURRENTS portés par un effet actif de sort (op `perRound`) — re-joués tant que l'effet
  // dure (AVANT le décrément : il agit aussi son dernier Round). 1 État X/Round, 1 Ration de
  // « Récolte de Rhya »/Round… Le nombre de répétitions suit roundsLeft (Surincantation de Durée
  // comprise). Snapshot de la liste : les ops récurrentes n'ajoutent pas d'effet actif (cas littéraux).
  for (const e of [...(c.activeEffects ?? [])]) {
    if (!e.opsPerRound || (e.duration.scale === 'rounds' && e.duration.left <= 0)) continue;
    // L'ancrage du re-jeu est celui MEMORISE sur l'effet a sa pose (`applyOps` l'y stampe) : il se relaie,
    // il ne se reconstruit pas.
    applyOps(c, e.opsPerRound, {
      label: e.label, rng, source: e.source, sourceSpellId: e.sourceSpellId, effectId: e.effectId,
    }).forEach((l) => log.push(l));
  }
  // Décrément des durées (effets/États de sort/contrecoups) — SOURCE UNIQUE extraite, même emplacement
  // qu'avant (fin d'`endOfRound`, après les ops récurrentes). RNG-free.
  tickDurations(c).forEach((l) => log.push(l));
  return log;
}

/**
 * Décrément des DURÉES à la frontière de Round — SOURCE UNIQUE (effets magiques temporisés, États de
 * sort, contrecoups d'incantation en Rounds). Extrait d'`endOfRound` : un seul point décrémente les
 * `roundsLeft`, branché par le hook `tick-durations` (order 15.5, après les dégâts périodiques, avant
 * `refresh-wounds`). RNG-FREE (décrément + filtre + retraits) → n'altère pas le flux déterministe.
 * Rejoué hors combat par `outOfCombatUpkeep` (les durées en Rounds tickent aussi à l'horloge).
 */
/** Retire d'un combattant les ActiveEffect satisfaisant `pred`, en RÉVERSANT proprement leurs octrois
 *  (traits/ressources/armes accordés, Traits psy suspendus) — EXACTEMENT comme l'expiration naturelle.
 *  SOURCE UNIQUE du retrait d'effets actifs : expiration en Rounds (`tickDurations`), horloge, et
 *  DISSIPATION (LDB 46 l.158-162, `engine/dispel`). Renvoie les effets retirés (pour le journal). */
export function removeActiveEffects(c: Combatant, pred: (e: ActiveEffect) => boolean): ActiveEffect[] {
  if (!c.activeEffects?.length) return [];
  const removed = c.activeEffects.filter(pred);
  if (!removed.length) return [];
  c.activeEffects = c.activeEffects.filter((e) => !pred(e));
  dropExpiredGrantedTraits(c, removed); // traits accordés (op grantTrait) retirés avec leur effet
  dropExpiredGrantedResources(c, removed); // Chance/Destin accordés (gainResource) non dépensés
  dropExpiredGrantedWeapons(c, removed); // armes invoquées/naturelles accordées : loadout recomposé
  if (dropExpiredGrantedMutations(c, removed)) { recomputeLoadout(c); refreshWounds(c); } // mutation TEMPORISÉE (op rollMutation) détachée → loadout/PB dérivés recalculés
  restoreSuppressedPsych(c, removed); // Traits psy suspendus (Baume, LDB 42) restitués
  return removed;
}

/** Le SORT source d'un effet actif porte-t-il le marqueur « + » de fin de Durée (LDB 47 l.311) ? Lookup
 *  PUR par `spell.spellId`/`sourceSpellId` (posés à l'incantation, cf. `OpsCtx.sourceSpell`/`sourceSpellId`).
 *  Sans sort source (effet non-magique) ou sort introuvable/sans marqueur → false. */
export function spellDurationPlusSource(e: ActiveEffect): boolean {
  const spellId = e.spell?.spellId ?? e.sourceSpellId;
  if (!spellId) return false;
  const d = findSpellById(spellId)?.duration;
  return !!d && (d.kind === 'rounds' || d.kind === 'special') && d.plus === true;
}

/** Effets d'un combattant en attente d'une offre de prolongation (`awaitingExtension`, LDB 47 l.311) —
 *  requête PURE pour le state layer (collecte de cascade héros / résolution PNJ). */
export function pendingPlusExtensions(c: Combatant): ActiveEffect[] {
  return (c.activeEffects ?? []).filter((e) => e.awaitingExtension);
}

/** Résout l'offre de prolongation (LDB 47 l.311) d'UN effet GELÉ (`awaitingExtension`) : succès (Test de
 *  Force Mentale réussi) → +1 Round, effet dégelé ; refus/échec → expiration NORMALE (mêmes réversions
 *  que `removeActiveEffects` — traits/armes/ressources accordés repris). Fonction PARTAGÉE par la
 *  résolution PNJ (inline, hook `end-of-round`) et l'applier de cascade héros (`spellPlusTest`). */
export function resolvePlusExtension(c: Combatant, e: ActiveEffect, extended: boolean): string[] {
  if (extended) {
    e.awaitingExtension = undefined;
    e.duration = { scale: 'rounds', left: 1 };
    return [t('cond.effectExtended', { name: c.label, label: e.label })];
  }
  const removed = removeActiveEffects(c, (x) => x === e);
  return removed.map((x) => t('cond.effectExpire', { name: c.label, label: x.label }));
}

export function tickDurations(c: Combatant): string[] {
  const log: string[] = [];
  // Effets magiques temporisés (Bénédictions, Sorts de bonus) : décrément des durées en Rounds.
  // `tickRound` n'agit que sur l'échelle `rounds` ; les durées d'horloge/permanentes sont inertes ici
  // (les premières sont purgées par l'horloge `purgeClockEffects`).
  if (c.activeEffects?.length) {
    for (const e of c.activeEffects) if (!e.awaitingExtension) e.duration = tickRound(e.duration);
    // Durée « + » (LDB 47 l.311) : un effet dont le SORT source porte le marqueur est GELÉ à l'expiration
    // au lieu d'être retiré — l'offre de prolongation (Test de Force Mentale) est résolue par l'appelant
    // (hors moteur pur : cadence-aware, cf. `resolvePlusExtension`). Répétable : une prolongation réussie
    // ramène l'effet à 1 Round → la PROCHAINE expiration re-propose naturellement (aucun compteur dédié).
    for (const e of c.activeEffects) {
      if (e.duration.scale === 'rounds' && e.duration.left <= 0 && !e.awaitingExtension && spellDurationPlusSource(e)) e.awaitingExtension = true;
    }
    const expired = removeActiveEffects(c, (e) => e.duration.scale === 'rounds' && e.duration.left <= 0 && !e.awaitingExtension);
    for (const e of expired) log.push(t('cond.effectExpire', { name: c.label, label: e.label }));
  }
  // États à DURÉE posés par un sort (« qui dure N Rounds ») : décrément, dissipation à 0.
  if (c.conditions.some((x) => x.roundsLeft != null)) {
    for (const x of c.conditions) if (x.roundsLeft != null) x.roundsLeft -= 1;
    const done = c.conditions.filter((x) => x.roundsLeft != null && x.roundsLeft <= 0);
    for (const x of done) log.push(t('cond.spellCondExpire', { name: c.label, cond: conditionLabel(x.id) }));
    c.conditions = c.conditions.filter((x) => !(x.roundsLeft != null && x.roundsLeft <= 0));
  }
  // Contrecoups d'incantation à durée en Rounds (tables d'Imparfaites/Colère, LDB 46/40).
  if (c.castPenalties?.some((p) => p.roundsLeft != null)) {
    for (const p of c.castPenalties) if (p.roundsLeft != null) p.roundsLeft -= 1;
    const done = c.castPenalties.filter((p) => p.roundsLeft != null && p.roundsLeft <= 0);
    for (const p of done) log.push(t('cond.effectExpire', { name: c.label, label: p.label }));
    c.castPenalties = c.castPenalties.filter((p) => !(p.roundsLeft != null && p.roundsLeft <= 0));
  }
  return log;
}

/**
 * Cauchemars (trauma psychologique, LDB 21 l.92) : chaque nuit, un Personnage marqué effectue un
 * Test de **Calme Facile (+40)** ; sur un échec, il est en proie à de terribles cauchemars et gagne
 * un État **Exténué**. Pur ; mute `c`, renvoie le journal.
 */
export function nightmareCheck(c: Combatant, rng: RNG = defaultRNG, out?: { base: number; result: TestResult }[]): string[] {
  const calme = effectiveChar(c, 'force-mentale') + (c.skills?.find((s) => s.skillId === 'calme')?.advances ?? 0);
  const res = rollTest(calme, 'facile', rng); // Calme Facile (+40), palier canonique
  out?.push({ base: calme, result: res });
  if (res.success) return [t('cond.nightmareNone', { name: c.label })];
  addCondition(c, COND.extenue);
  return [t('cond.nightmare', { name: c.label })];
}

/**
 * Mort par Hémorragique (LDB 16 l.105) : « À la fin du Round, vous avez 10 % de chance de mourir
 * par État Hémorragique que vous possédez » (3 pions → mort sur 1-30). « Si vous faites un double sur ce
 * jet, vos blessures coagulent un peu et vous perdez 1 État Hémorragique » — le double prime (pas de mort,
 * mais coagulation). Pur ; renvoie `died` (la finalisation — sauvetage par Destin — revient à l'appelant).
 */
export function bleedDeathRoll(c: Combatant, rng: RNG = defaultRNG): { died: boolean; log: string[] } {
  const n = stacks(c, COND.hemorragique);
  if (n <= 0) return { died: false, log: [] };
  const r = d100(rng);
  if (isDoubleRoll(r)) {
    removeCondition(c, COND.hemorragique, 1); // coagulation (le double prime sur la mort)
    const log = [t('cond.coagulate', { name: c.label, roll: r === 100 ? '00' : r })];
    if (!hasCondition(c, COND.hemorragique)) { addCondition(c, COND.extenue); log.push(t('cond.lastWoundExhausted', { name: c.label })); } // tous retirés → 1 Exténué
    return { died: false, log };
  }
  if (r <= 10 * n) return { died: true, log: [t('cond.bleedDeath', { name: c.label, roll: r, threshold: 10 * n })] };
  return { died: false, log: [] };
}

/** Mort Subite (LDB 18 l.51-54) : sortie directe à 0 PB, sans passer par les Blessures critiques.
 *  Portée réglable (`combat-sudden-death`) — JAMAIS les PJ : 'figurants' (défaut) = figurants seuls ;
 *  'tous' = aussi les PNJ importants ; 'off' = personne (tout passe par les critiques). SOURCE UNIQUE
 *  (consommée par `isOutOfAction` et la résolution de Blessure critique). */
export function usesSuddenDeath(c: Combatant): boolean {
  if (c.kind === 'hero') return false; // jamais pour les PJ (LDB 18 l.54)
  if (c.bodyShape === 'vehicule') return false; // une COQUE n'est pas un figurant : sa destruction passe par ses Blessures (Naufrage) et les Critiques NAVALS — pas de « Mort Subite » de mook (MDG 13)
  const mode = rule('combat-sudden-death');
  if (mode === 'off') return false;
  if (mode === 'tous') return true;
  return !c.important; // 'figurants' : figurants seulement
}

/** Hors de combat : mort, ou Inconscient, ou figurant tombé à 0 PB (Mort Subite), ou COQUE à 0 PB
 *  (détruite / coulée). Un héros à 0 PB reste actif (À Terre) — pas hors de combat (LDB 18 l.15). */
export function isOutOfAction(c: Combatant): boolean {
  // Un OBJET INERTE servi (affût d'artillerie) n'est jamais une PERTE par Blessures (il en a 0, immune) :
  // « hors de combat » seulement s'il est explicitement retiré (détruit hors-combat / éjecté de la rencontre).
  if (c.inert) return c.dead === true || c.outOfRencontre === true;
  // Coque : détruite à 0 PB (MDG 13 l.656), OU coulée par la Voie d'eau — Inondation ≥ Endurance pose
  // l'État `naufrage` (MDG 13 l.674 : « il coule »), l'autre voie de coulée que les Blessures à 0.
  if (c.bodyShape === 'vehicule') return c.dead === true || c.outOfRencontre === true || c.wounds.current <= 0 || hasCondition(c, 'naufrage');
  return c.dead === true || c.outOfRencontre === true || hasCondition(c, COND.inconscient) || (usesSuddenDeath(c) && c.wounds.current <= 0);
}

/** Catégorie d'état de FIN d'un combattant, pour l'AFFICHAGE (#237). */
export type EndState = 'mort' | 'inconscient' | 'rendu' | 'hors-combat';

/** État de FIN d'un combattant pour le RENDU (#237) — SOURCE UNIQUE consommée par les trois surfaces
 *  (token iso, portrait, frise d'initiative) ; distinct de `isOutOfAction` (booléen de règle), il
 *  renvoie la CATÉGORIE lisible. `mort` (définitif) → `rendu` (reddition #215 / coque amenée, pavillon
 *  baissé) → `hors-combat` (éjecté vivant : Destin, naufrage, Mort Subite d'un figurant, coque coulée)
 *  → `inconscient` (KO conscient perdu). `rendu` vs `hors-combat` repose sur `exitReason` (seul champ
 *  qui les distingue). `null` = en état de se battre (un héros à 0 PB reste À Terre, PAS un état de fin).
 *  Un OBJET INERTE (affût servi, 0 PB permanent immune) n'a jamais d'état de fin. */
export function endState(c: Combatant): EndState | null {
  if (c.inert) return null;
  if (c.dead) return 'mort';
  if (c.outOfRencontre) return c.exitReason === 'reddition' || c.exitReason === 'prise' ? 'rendu' : 'hors-combat';
  if (c.bodyShape === 'vehicule') return c.wounds && c.wounds.current <= 0 ? 'hors-combat' : null; // coque coulée (MDG 13)
  if (usesSuddenDeath(c) && c.wounds && c.wounds.current <= 0) return 'hors-combat'; // figurant tombé à 0 PB
  if (!c.dead && hasCondition(c, COND.inconscient)) return 'inconscient'; // vivant mais KO (même gate de cycle de vie qu'isOutOfAction)
  return null;
}

/** Condition de mort lente (LDB 18 l.34) : Inconscient + 0 PB + (Blessures
 *  critiques > Bonus d'Endurance), et pas déjà mort/éjecté. Suffocation (LDB 18 l.346) :
 *  « au bout d'un nombre de Rounds égal à votre BE, vous mourez » — compteur à 0 = mort
 *  (même canal → un héros à Destin est suspendu, pendingFateSave). */
export function inDeathCondition(c: Combatant): boolean {
  if (c.dead || c.outOfRencontre) return false;
  if (c.suffocationCountdown != null && c.suffocationCountdown <= 0) return true;
  const be = bonus(effectiveChar(c, 'endurance'));
  // Variante Aux Armes (l.2517) : mort par accumulation de Blessures Critiques. Même formule et même clause
  // « sauf s'il est soigné d'une Blessure Critique » que le LDB 18 l.34 (les Critiques « T » n'ont pas
  // incrémenté le compteur, cf. applyCriticalToTarget) → on route la clause de compte par la primitive AA dédiée.
  if (rule('combat-aa-blessures') === 'aa')
    return aaDeathByCriticalCount(hasCondition(c, COND.inconscient), c.wounds.current, c.criticalWounds ?? 0, be);
  return hasCondition(c, COND.inconscient) && c.wounds.current <= 0 && (c.criticalWounds ?? 0) > be;
}

/** À 0 PB : gagne l'État À Terre (LDB 18 l.15). À appeler quand un coup non-critique amène à 0.
 *  (Une COQUE ne tombe pas « À Terre » : sa mise hors-jeu à 0 PB est gérée par `isOutOfAction`.) */
export function applyZeroWounds(c: Combatant): void {
  if (c.inert) return; // OBJET INERTE (affût d'artillerie) : en permanence à 0 PB, immune aux Blessures → jamais À Terre (cf. isOutOfAction)
  if (c.bodyShape === 'vehicule') return;
  if (c.wounds.current <= 0 && !hasCondition(c, COND.aTerre)) addCondition(c, COND.aTerre);
}

/**
 * Perte de Blessures CENTRALISÉE avec ses conséquences RAW — à utiliser partout où l'on retire des PB
 * (hors flux d'attaque principal, qui gère déjà l'Avantage et la nuance Critique pour l'À Terre) :
 *  - perdre ≥1 PB → on perd TOUT l'Avantage (LDB 14 l.219) ;
 *  - tomber à 0 PB → État À Terre (LDB 18 l.15), sauf déjà Inconscient/mort.
 * Retourne le nombre de PB réellement perdus.
 */
export function loseWounds(c: Combatant, amount: number): number {
  if (amount <= 0 || c.wounds.current <= 0) return 0;
  const lost = Math.min(amount, c.wounds.current);
  c.wounds.current -= lost;
  if (!groupAdvantage()) c.advantage = 0; // perdre une Blessure → perdre tout l'Avantage (LDB 14 l.219) — inerte en mode « Avantage de groupe »
  if (c.wounds.current <= 0 && !c.dead && !hasCondition(c, COND.inconscient)) applyZeroWounds(c);
  return lost;
}

/**
 * Upkeep de mort en fin de Round (LDB 18 l.15, l.34) — héros/importants seulement :
 *  - à 0 PB non soigné : roundsAtZero++ ; après (Bonus d'Endurance) Rounds → Inconscient (LDB 18 l.15) ;
 *  - Inconscient + 0 PB + (criticalWounds > BE) → mort.
 * Variante Aux Armes (AA 07 l.5) : le système alternatif REMPLACE ce décompte déterministe → à 0 PB, on ne
 * tombe PAS automatiquement Inconscient ; la chute Inconscient passe par le Test de Résistance de l'État
 * Hémorragique (hook `aa-bleed-unconscious`). On garde le compteur `roundsAtZero` (info) mais on n'applique
 * pas l'Inconscient en mode AA. Retourne le journal.
 */
export function tickDeath(c: Combatant): string[] {
  const log: string[] = [];
  if (c.dead || c.outOfRencontre || c.inert || usesSuddenDeath(c) || c.bodyShape === 'vehicule') return log; // un OBJET INERTE (affût, 0 PB permanent) et une coque ne « meurent » pas par la cascade Inconscient→mort (cf. isOutOfAction)
  const be = bonus(effectiveChar(c, 'endurance'));
  if (c.wounds.current > 0) {
    c.roundsAtZero = 0;
    return log;
  }
  c.roundsAtZero = (c.roundsAtZero ?? 0) + 1;
  if (rule('combat-aa-blessures') !== 'aa' && c.roundsAtZero > be && !hasCondition(c, COND.inconscient)) {
    addCondition(c, COND.inconscient);
    log.push(t('cond.unconscious', { name: c.label, rounds: c.roundsAtZero }));
  }
  return log; // la mort (dead) est finalisée par le store (avec sauvetage par Destin)
}
