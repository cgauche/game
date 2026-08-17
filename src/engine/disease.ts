/**
 * Maladies et infections — Livre de base, « Maladies et infections » (20-Maladies et infections.md).
 * Moteur PUR : on NE modélise QUE ce que la source quantifie. Reste sans cycle d'import (les valeurs —
 * Résistance — sont passées par l'appelant ; `trauma.ts` lit `diseasePassiveOps` d'ici). N'importe `ops`
 * qu'en TYPE (`GameOp`), jamais `applyOps` — les conséquences `onFail` sont appliquées CÔTÉ STATE
 * (`restFlow`, via `applyOps`) → pas de cycle ops↔disease.
 *
 * Cycle de vie (l.10-24) : Contraction (Test raté) → Incubation → symptômes ACTIFS → Durée → résolution
 * (capacité `endTest` : Test de fin, sinon guérison naturelle). Incubation/durée RAW en jours, heures OU
 * minutes (`DiseaseTime`), décomptées en MINUTES écoulées (`tickDisease`) ; les Tests de cycle RAW
 * « par jour » (symptômes/gangrène) restent cadencés à la JOURNÉE pleine.
 *
 * SYMPTÔMES = DONNÉE (`symptoms.json`, éditable au Codex), pas un enum. La mécanique vit sur le symptôme
 * en 3 canaux (comme un trait/qualité) — ce module ne fait que les LIRE :
 *  - `passive`/`severePassive` (GameOp `charMod`) : pénalités continues (fièvre −10, convulsions −10/−20…)
 *    → collectées par `diseasePassiveOps` → `passiveMods` (kind 'maladie', annulable par Détermination).
 *  - `onTick { difficulty, onFail: GameOp[] }` : Test de cycle quotidien (Blessé → contractDisease
 *    'blessure-purulente' ; Toxine → test journalisé) — DIFFÉRÉ en cascade influençable (`diseaseTick`).
 *  - `capabilities` (drapeaux irréductibles lus par la machinerie de CYCLE ci-dessous) : `blocksHealing`
 *    (Blessé/Gangrène), `amputation` (Gangrène), `stickyExtenue` (Malaise), `contagious` (Toux),
 *    `nausea` (combat), `endTest` (Persistant).
 */
import { Combatant, Difficulty, UpkeepDeferTest, HitLocation, type ConditionEmit } from './types';
import { RNG, defaultRNG, roll, type DiceSpec, rollDice, formatDice } from './dice';
import { MINUTES_PER_DAY } from './clock';
import { findTableEntry } from './tables';
import locJson from '../data/localisation.json';
// Table de Localisation CANONIQUE (`src/data/localisation.json`, humanoïde) via la primitive `findTableEntry`
// — MÊME source/lookup que `engine/combat.hitLocation`, réutilisée ici sans cycle (json + tables = feuilles).
const HUMANOID_LOC = (locJson as { personnage: { shapes: Record<string, { min: number; max: number; loc: HitLocation }[]> } }).personnage.shapes.humanoide;
const rollBlisterLocation = (rng: RNG): HitLocation => findTableEntry(HUMANOID_LOC, roll(1, 100, rng)).loc;
import { rollTest } from './tests';
import { maladies, diseaseLabel, findSymptomById, symptomLabel, conditionLabel, type SymptomCapabilities } from '../data';
import type { GameOp, PassiveMod } from './ops';
import type { PsychTrait, PsychType } from './psychology';
import { t } from '../i18n';
import { fateSaveOrDie } from './fortune';

/** Unité d'un temps de maladie (incubation/durée). La base de calcul/stockage reste la MINUTE (`clock.ts`). */
export type TimeUnit = 'days' | 'hours' | 'minutes';
const UNIT_MINUTES: Record<TimeUnit, number> = { days: MINUTES_PER_DAY, hours: 60, minutes: 1 };

/** Incubation/durée d'une maladie : un jet de dés (`dice`) + son `unit`. Source UNIQUE (RAW « Incubation »/
 *  « Durée »), convertie en MINUTES par `rollDiseaseTime` → plus de perte « sous-journalier ≈ 0 jour ».
 *  Une valeur FIXE (Colique « 2 heures ») = `{ dice:{n:0,sides:0,plus:2}, unit:'hours' }` ; « instantanée »
 *  = `{ dice:{n:0,sides:0}, unit:'hours' }` (= 0). */
export interface DiseaseTime {
  dice: DiceSpec;
  unit: TimeUnit;
}
/** Tire un `DiseaseTime` → MINUTES (jet × facteur d'unité). PUR (RNG injecté). */
export const rollDiseaseTime = (t: DiseaseTime, rng: RNG = defaultRNG): number => rollDice(t.dice, rng) * UNIT_MINUTES[t.unit];
/** Écriture d'affichage : « 1d10 heures », « 3d10+10 jours », « 2 heures » (valeur fixe). */
export function formatDiseaseTime(time: DiseaseTime): string {
  const label = t(time.unit === 'days' ? 'dz.unitDays' : time.unit === 'hours' ? 'dz.unitHours' : 'dz.unitMinutes');
  const fixed = time.dice.n === 0 || time.dice.sides === 0; // pas de dé → valeur fixe (le seul `plus`)
  return `${fixed ? String(time.dice.plus ?? 0) : formatDice(time.dice)} ${label}`;
}

/** Restant d'une instance (base MINUTES) → libellé humain à l'échelle la plus parlante (j / h / min). */
export function formatRemaining(minutes: number): string {
  const m = Math.max(0, minutes);
  if (m >= MINUTES_PER_DAY) return t('dz.remainDays', { n: Math.round(m / MINUTES_PER_DAY) });
  if (m >= 60) return t('dz.remainHours', { n: Math.round(m / 60) });
  return t('dz.remainMinutes', { n: Math.round(m) });
}

/** Instance de symptôme sur une maladie : RÉFÉRENCE un symptôme de `symptoms.json` par `symptomId`,
 *  + `severity`/`difficulty` PAR-INSTANCE (Convulsions Modérée → `severePassive` ; Persistant
 *  (Accessible) → difficulté du Test de fin). La mécanique (passive/onTick/capabilities) vit sur la
 *  DONNÉE du symptôme, lue par les helpers ci-dessous — plus d'enum de kinds en dur. */
export interface DiseaseSymptom {
  symptomId: string;
  severity?: 'moderee' | 'grave';
  difficulty?: Difficulty;
  /** LOCALISATION/précision imprimée de l'instance (« Gonflement (Visage et tête) », Fièvre Cérébrale
   *  Pourpre — EDO 11 p.145) : affichage seul (convention `spec` des compétences/talents) — la mécanique
   *  par-localisation du symptôme vit dans sa `desc`. */
  spec?: string;
}

export interface DiseaseDef {
  /** id STABLE (slug du nom) — clé de `maladies.json`, cible de `Disease.name` et des refs. */
  id: string;
  /** Libellé d'affichage (français) — résolu via `diseaseLabel` ; ≠ id. Convention `label` des catalogues. */
  label: string;
  /** Description VERBATIM (LDB 20) — affichage seul (jamais lue par le moteur), comme toute entité. */
  desc: string;
  /** Difficulté du Test de Contraction (pour mémoire/journal — la contraction est déclenchée par l'appelant). */
  contractDifficulty: Difficulty;
  /** Incubation RAW (jours/heures/minutes) — tirée en minutes à la contraction. */
  incubation: DiseaseTime;
  /** Durée active RAW (jours/heures/minutes) — tirée en minutes à la contraction. */
  duration: DiseaseTime;
  symptoms: DiseaseSymptom[];
  /** Vérole Urticante (l.97) : « vous ne pouvez pas l'attraper une seconde fois » — immunité après guérison. */
  immuneAfterCure?: boolean;
  /** Passifs actifs pendant toute l'INFECTION (incubation ET phase active — Vers du Reik : « −5 à tous les
   *  Tests de Résistance permettant de résister aux maladies » pour chaque période complète de 30 jours
   *  d'infection, MSRC 16 l.138). Un op `diseaseTestMod` y est RAMPÉ par tranche de 30 jours écoulés depuis
   *  la contraction (`activeDiseaseTestMod`), puis DÉCROÎT de 1/jour après la fin (résidu). Éditable au Codex. */
  infectionPassive?: GameOp[];
  /** Un porteur ACTIF qui boit à un tonneau d'eau risque de le rendre contagieux pour quiconque y boit
   *  ensuite (MDG 14 l.209). Drapeau DÉCLARATIF lu par `buildBarrelSteps` (`state/seaVoyageFlow`). */
  contaminatesWaterBarrel?: boolean;
}

/** Instance de maladie portée par un personnage. */
export interface Disease {
  /** id de la maladie (`maladies.json`) — ≠ libellé (résolu à l'affichage via `diseaseLabel`). #598 */
  id: string;
  symptoms: DiseaseSymptom[];
  phase: 'incubation' | 'active';
  /** MINUTES restantes dans la phase courante (incubation, puis durée active). Base = la minute
   *  (`clock.ts`) → une incubation/durée sous-journalière (heures/minutes) est décomptée fidèlement. */
  minutesLeft: number;
  /** Durée active EN MINUTES (mémorisée pendant l'incubation pour la basculer une fois l'incubation finie). */
  durationMinutes: number;
  /** Difficulté du Test « persistant » de fin de durée (dérivée des symptômes). */
  persistDifficulty?: Difficulty;
  /** Gangrène (l.135+) : échecs cumulés du Test journalier — au-delà du BE, la Localisation est perdue. */
  gangreneFails?: number;
  /** Gangrène : la Localisation est devenue inutilisable (Amputation requise — journalisé). */
  gangreneLost?: boolean;
  /** Bénédiction de Convalescence reçue (LDB 41 : « une fois par maladie et par personne » — le champ
   *  vit sur l'instance de Disease, qui appartient à un seul Combatant). */
  convalescenceBlessed?: boolean;
  /** Cascade de nuit : le Test « persistant » de fin de durée est DIFFÉRÉ (étape influençable) ; la
   *  maladie reste en attente de résolution jusqu'à la validation de l'étape (`applyDiseasePersist`). */
  endTestPending?: boolean;
  /** Jours pleins écoulés en PHASE ACTIVE — cadence les cycles `onTick.afterDays`/`once` (Vers de carie
   *  J+7, Vers du Reik éclatement au 7ᵉ jour, MSRC 16). Incrémenté à chaque journée pleine active. */
  activeDaysElapsed?: number;
  /** MINUTES totales écoulées depuis la CONTRACTION (toutes phases) — base de la rampe « −5 par période
   *  complète de 30 jours d'infection » des passifs d'infection (Vers du Reik, MSRC 16 l.138). */
  infectedMinutes?: number;
  /** Localisation de la lésion (cloque du Vers du Reik) TIRÉE à l'entrée en phase active (jet de
   *  Localisation canonique) — gate les `visiblePassive` d'un symptôme (−10 Soc si visible, MSRC 16 l.140). */
  blisterLocation?: import('./types').HitLocation;
}


// Registre des maladies CÂBLÉES — DÉRIVÉ de `maladies.json` (data app-owned, éditable au Codex), keyé
// par `id`. Les valeurs verbatim (LDB 20) vivent dans la donnée ; le COMPORTEMENT (cycle,
// symptômes) reste ici. Ajouter une maladie = une entrée dans `maladies.json`.
export const DISEASE_DEFS: Record<string, DiseaseDef> = Object.fromEntries(
  (maladies as DiseaseDef[]).map((m) => [m.id, m]),
);
/** ids des maladies CANONIQUES (LDB 20) référencées par le moteur (cascade persistant, contagions). Pas de
 *  chaîne magique. Garde-fou de synchro `DISEASES`⇄`maladies.json` : `refs-migrated.test`. */
export const DISEASES = {
  infectionMineure: 'infection-mineure', blessurePurulente: 'blessure-purulente', infectionDuSang: 'infection-du-sang',
  couranteGalopante: 'courante-galopante', fievreDuRongeur: 'fievre-du-rongeur', fluxSanglant: 'flux-sanglant',
  pesteNoire: 'peste-noire', veroleDuTanneur: 'verole-du-tanneur', veroleUrticante: 'verole-urticante',
} as const;

/** Construit une instance de maladie (tire incubation/durée → MINUTES). `opts.incubation`/`opts.duration`
 *  figent les jets EN JOURS (tests, ou contraction « instantanée » depuis un autre symptôme — l.32 :
 *  `{ incubation: 0 }`). Renvoie `null` si inconnue. */
export function contractDisease(
  id: string,
  rng: RNG = defaultRNG,
  opts?: { incubation?: number; duration?: number },
): Disease | null {
  const def = DISEASE_DEFS[id];
  if (!def) return null;
  const incub = Math.max(0, opts?.incubation != null ? opts.incubation * MINUTES_PER_DAY : rollDiseaseTime(def.incubation, rng));
  const dur = Math.max(1, opts?.duration != null ? opts.duration * MINUTES_PER_DAY : rollDiseaseTime(def.duration, rng));
  const persist = def.symptoms.find((s) => symptomHasCapability(s.symptomId, 'endTest'))?.difficulty;
  return {
    id,
    symptoms: def.symptoms,
    phase: incub > 0 ? 'incubation' : 'active',
    minutesLeft: incub > 0 ? incub : dur,
    durationMinutes: dur,
    persistDifficulty: persist,
  };
}

/** GameOp PASSIFS d'une instance de symptôme (sa pénalité continue), scalés par `severity`
 *  (Convulsions Modérée/Grave → `severePassive` −20 au lieu de `passive` −10). Lus par `passiveMods`. */
export function symptomPassive(inst: DiseaseSymptom): GameOp[] {
  const s = findSymptomById(inst.symptomId);
  if (!s) return [];
  return inst.severity && s.severePassive ? s.severePassive : (s.passive ?? []);
}
/** Le symptôme `symptomId` est-il SUSPENDU chez `c` par un effet actif (op `suppressSymptom` —
 *  Racine de terre « annule les effets de bubons », LDB 72 l.28) ? Ses canaux `passive`/`onTick` sont
 *  alors ignorés tant que l'effet dure ; restitués d'office à l'expiration (l'effet quitte la liste). */
export function symptomSuppressed(c: Combatant, symptomId: string): boolean {
  return (c.activeEffects ?? []).some((e) => e.suppressedSymptom === symptomId);
}
/** Σ des bonus/malus d'effets ACTIFS aux Tests liés à la maladie `diseaseName` (op `diseaseTestMod` —
 *  Fleur de lune +30 vs Peste noire, Racine de terre +10, Tonique digestif +20) : appliqué aux Tests
 *  de CONTRACTION (`rollContraction`) et de CYCLE/FIN (`tickDisease` — inline ET bases différées). */
export function activeDiseaseTestMod(c: Combatant, diseaseName: string): number {
  let n = (c.activeEffects ?? []).reduce((s, e) => {
    const m = e.diseaseTestMod;
    return s + (m && (!m.diseases || m.diseases.includes(diseaseName)) ? m.amount : 0);
  }, 0);
  // Passifs d'INFECTION (Vers du Reik « −5 aux Tests de Résistance par période complète de 30 jours
  // d'infection », MSRC 16 l.138) : rampés par le nombre de tranches de 30 jours écoulées depuis la
  // contraction — sur TOUTE l'infection (incubation ET phase active, l.138 « d'infection »).
  const PERIOD = 30 * MINUTES_PER_DAY; // MSRC 16 l.138 (« période complète de 30 jours »)
  for (const dz of c.diseases ?? []) {
    const periods = Math.floor((dz.infectedMinutes ?? 0) / PERIOD);
    if (periods <= 0) continue;
    for (const op of DISEASE_DEFS[dz.id]?.infectionPassive ?? []) {
      if (op.op === 'diseaseTestMod' && (!op.diseases || op.diseases.includes(diseaseName))) n += op.amount * periods;
    }
  }
  // Résidu POST-fin qui décroît de 1/jour (Vers du Reik « réduite de 1 point par jour après la mort du
  // ver », MSRC 16 l.138) : magnitude ≥ 0 stockée sur le porteur, retranchée aux Tests (pénalité négative).
  if (c.residualDiseaseTestMod) n -= c.residualDiseaseTestMod;
  return n;
}
/** Fige le RÉSIDU post-fin d'une maladie à `infectionPassive` (Vers du Reik) : la pénalité accumulée
 *  (magnitude × tranches de 30 jours) reste sur le porteur et décroît de 1/jour (MSRC 16 l.138). */
function snapshotInfectionResidual(c: Combatant, dz: Disease): void {
  const periods = Math.floor((dz.infectedMinutes ?? 0) / (30 * MINUTES_PER_DAY));
  if (periods <= 0) return;
  let mag = 0;
  for (const op of DISEASE_DEFS[dz.id]?.infectionPassive ?? []) if (op.op === 'diseaseTestMod') mag += Math.abs(op.amount) * periods;
  if (mag > 0) c.residualDiseaseTestMod = (c.residualDiseaseTestMod ?? 0) + mag;
}
/** Instances de symptôme ACTIVES et NON suspendues du porteur (maladies en phase `active`, hors
 *  `suppressSymptom`) — ACCESSEUR CANONIQUE unique. Base commune de `diseasePassiveOps` (canal passif)
 *  et des `effects` DÉCLENCHÉS des symptômes (source du dispatcher, `state/triggeredEffects`). */
export function activeSymptoms(c: Combatant): DiseaseSymptom[] {
  return (c.diseases ?? [])
    .filter((d) => d.phase === 'active')
    .flatMap((d) => d.symptoms.filter((s) => !symptomSuppressed(c, s.symptomId)));
}
/** Passifs de TOUTES les maladies ACTIVES (collecte unifiée, reprise telle quelle par `passiveMods`).
 *  Un symptôme SUSPENDU (`suppressSymptom`) n'émet rien. Les `visiblePassive` (Vers du Reik −10 Soc) ne
 *  s'émettent que si la lésion tirée (`blisterLocation`) est dans les `visibleLocations` `maison` du symptôme.
 *  Chaque op sort emballée en `PassiveMod` kind `maladie`, `src` = le SYMPTÔME émetteur : c'est lui qui
 *  nomme la pénalité à l'écran (« −20 Crampes abdominales »), jamais un « Maladie » générique. */
export function diseasePassiveOps(c: Combatant): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const dz of (c.diseases ?? []).filter((d) => d.phase === 'active')) {
    for (const inst of dz.symptoms) {
      if (symptomSuppressed(c, inst.symptomId)) continue;
      const src = { category: 'symptoms', id: inst.symptomId };
      for (const op of symptomPassive(inst)) out.push({ op, kind: 'maladie', src });
      const sd = findSymptomById(inst.symptomId);
      if (sd?.visiblePassive?.length && dz.blisterLocation && (sd.visibleLocations ?? []).includes(dz.blisterLocation)) {
        for (const op of sd.visiblePassive) out.push({ op, kind: 'maladie', src });
      }
    }
  }
  return out;
}
/** Traits PSYCHOLOGIQUES conférés par les symptômes ACTIFS — op `grantPsychTrait` du MÊME canal `passive`
 *  que les pénalités continues (Rage meurtrière → Haine (toutes les choses vivantes) + Frénésie,
 *  Middenheim p.131). DÉRIVÉS, pas attachés : présents tant que la maladie est active (filtre de
 *  `diseasePassiveOps`), retirés d'office à la guérison — comme tout passif, ce module ne fait que LIRE le
 *  symptôme (jamais de mutation de `c.psychTraits` ni d'`applyOps`, donc aucun bookkeeping attache/détache).
 *  Fusionnés aux Traits STOCKÉS par `effectivePsychTraits` (psychology), seul POINT DE LECTURE. */
export function diseasePsychTraits(c: Combatant): PsychTrait[] {
  const out: PsychTrait[] = [];
  for (const { op } of diseasePassiveOps(c)) {
    if (op.op === 'grantPsychTrait') out.push({ type: op.psychType as PsychType, ...(op.cible ? { cible: op.cible } : {}) });
  }
  return out;
}
/** Test/conséquence de cycle quotidien d'une instance de symptôme (Blessé/Toxine/Vers) — donnée. La
 *  difficulté est INDEXÉE sur la sévérité PORTÉE PAR L'INSTANCE quand le symptôme le prévoit
 *  (`difficultyBySeverity` — Toxine, LDB 20 l.215 : Modéré→Facile, Grave→Accessible). `difficulty`
 *  ABSENTE = conséquence INCONDITIONNELLE (pas de jet). `afterDays`/`once` cadencent le cycle sur la
 *  phase active (Vers de carie / Vers du Reik, MSRC 16). */
export function symptomOnTick(inst: DiseaseSymptom): { difficulty?: Difficulty; onFail: GameOp[]; afterDays?: number; once?: boolean } | undefined {
  const tick = findSymptomById(inst.symptomId)?.onTick;
  if (!tick) return undefined;
  const bySeverity = inst.severity && tick.difficultyBySeverity?.[inst.severity];
  return bySeverity ? { ...tick, difficulty: bySeverity } : tick;
}
/** Interprète INLINE le sous-ensemble d'ops `onFail`/inconditionnelles que le cycle de maladie peut
 *  appliquer SANS `applyOps` (contrainte sans-cycle ops↔disease de l'en-tête) : contraction, mort (Destin,
 *  MSRC 16 l.101), Blessure directe + État (éclatement du Vers du Reik, l.142). Les ops RICHES à dés/table
 *  (`rollTable`/`charDamage` — table du Vers de carie, l.90) passent par la voie DIFFÉRÉE (`diseaseTick`
 *  → `applyOps` côté state, vocabulaire complet) ; elles sont IGNORÉES ici (jamais roulées à l'aveugle). */
function applyOnFailInline(c: Combatant, onFail: GameOp[], contractOnce: (name: string) => boolean, log: string[], emit?: ConditionEmit): void {
  for (const op of onFail) {
    if (op.op === 'contractDisease') contractOnce(op.disease);
    else if (op.op === 'kill') log.push(fateSaveOrDie(c) ? t('op.kill.fateSaved', { name: c.label }) : t('op.kill', { name: c.label }));
    else if (op.op === 'wounds') {
      const n = typeof op.amount === 'number' ? op.amount : 0; // burst = 1 Blessure directe (littéral) ; formules → voie différée
      if (n > 0) { c.wounds.current = Math.max(0, c.wounds.current - n); log.push(t('op.wounds', { name: c.label, n, mitig: '' })); }
    } else if (op.op === 'condition') {
      const ex = c.conditions.find((x) => x.id === op.id);
      if (ex) ex.value = (ex.value ?? 1) + 1;
      else c.conditions.push({ id: op.id, value: typeof op.value === 'number' ? op.value : 1 });
      log.push(t('op.cond', { name: c.label, v: ex ? (ex.value ?? 1) : 1, cond: conditionLabel(op.id) }));
      emit?.({ stateId: op.id, change: 'gain', targetId: c.id });
    }
  }
}

/** Un symptôme (par id) porte-t-il la capacité `cap` (lue sur sa donnée) ? */
function symptomHasCapability(symptomId: string, cap: keyof SymptomCapabilities): boolean {
  return !!findSymptomById(symptomId)?.capabilities?.[cap];
}
/** Une maladie porte-t-elle un symptôme à la capacité `cap` ? */
export function diseaseHasCapability(dz: Disease, cap: keyof SymptomCapabilities): boolean {
  return dz.symptoms.some((s) => symptomHasCapability(s.symptomId, cap));
}
/** Le combattant a-t-il une maladie ACTIVE portant la capacité `cap` ? (Nausée, Contagion…) */
export function hasActiveCapability(c: Combatant, cap: keyof SymptomCapabilities): boolean {
  return (c.diseases ?? []).some((d) => d.phase === 'active' && diseaseHasCapability(d, cap));
}

/**
 * Test de CONTRACTION d'une maladie (LDB 20) : un Test de Résistance `difficulty` raté la fait contracter
 * (dédoublonnée par nom). `resistVal` = Résistance effective, passée par l'appelant (cycle évité). Mute
 * `c.diseases`, renvoie le journal. Sert au post-critique (Très Facile +60, l.72) ET à la Chirurgie
 * (Accessible +20, talent Chirurgie / l.365). Réussite ou maladie déjà présente → rien.
 */
/** Un Test de Contraction de `diseaseName` tomberait-il pour `c` ? (Non si déjà porteur ou immunisé.)
 *  Sépare la DÉCISION du jet (pour différer en cascade) de sa résolution. */
export function contractionDue(c: Combatant, diseaseName: string): boolean {
  if ((c.diseases ?? []).some((d) => d.id === diseaseName)) return false;
  return !(c.diseaseImmunities ?? []).includes(diseaseName); // Vérole Urticante (l.97) : pas deux fois
}

/** Applique le RÉSULTAT d'un Test de Contraction DIFFÉRÉ : échec → contracte la maladie. Mute `c.diseases`.
 *  `opts.instant` (Contagieux (Type), EDO App.2 l.230 : « son incubation est changée en “Instantanée” ») :
 *  la maladie contractée démarre ACTIVE (incubation 0). */
export function applyContraction(c: Combatant, diseaseName: string, success: boolean, rng: RNG = defaultRNG, opts?: { instant?: boolean }): string[] {
  if (success || !contractionDue(c, diseaseName)) return [];
  const dz = contractDisease(diseaseName, rng, opts?.instant ? { incubation: 0 } : undefined);
  if (!dz) return [];
  c.diseases = [...(c.diseases ?? []), dz];
  return [t('dz.contract', { name: c.label, disease: diseaseLabel(diseaseName) })];
}

/**
 * Test de CONTRACTION d'une maladie (LDB 20) : un Test de Résistance `difficulty` raté la fait contracter
 * (dédoublonnée par nom). `resistVal` = Résistance effective, passée par l'appelant (cycle évité). Mute
 * `c.diseases`, renvoie le journal. Sert au post-critique (Très Facile +60, l.72) ET à la Chirurgie
 * (Accessible +20, talent Chirurgie / l.365). Réussite ou maladie déjà présente → rien.
 */
export function rollContraction(
  c: Combatant,
  diseaseName: string,
  resistVal: number,
  difficulty: Difficulty,
  rng: RNG = defaultRNG,
): string[] {
  if (!contractionDue(c, diseaseName)) return [];
  // Bonus d'effets actifs aux Tests liés à CETTE maladie (Fleur de lune +30 vs Peste noire…).
  return applyContraction(c, diseaseName, rollTest(resistVal + activeDiseaseTestMod(c, diseaseName), difficulty, rng).success, rng);
}

/** Maladies ACTIVES dont un symptôme a la capacité `stickyExtenue` (Malaise, l.188) — chacune impose un
 *  Exténué « collant » (non dissipé par le repos tant que la maladie dure). Lu par `rest.ts`. */
export function activeMalaiseCount(c: Combatant): number {
  return (c.diseases ?? []).filter((d) => d.phase === 'active' && diseaseHasCapability(d, 'stickyExtenue')).length;
}

/** Nombre de maladies actives bloquant la guérison d'1 PB (capacité `blocksHealing` — Blessé + Gangrène). */
export function diseaseBlesseCount(c: Combatant): number {
  return (c.diseases ?? []).filter((d) => d.phase === 'active' && diseaseHasCapability(d, 'blocksHealing')).length;
}

/** Maladies ACTIVES contagieuses (capacité `contagious` — Toux & éternuements, l.206) — contagion au repos. */
export function contagiousDiseases(c: Combatant): Disease[] {
  return (c.diseases ?? []).filter((d) => d.phase === 'active' && diseaseHasCapability(d, 'contagious'));
}

/** Contracte une maladie « instantanée » (depuis un autre symptôme, l.32) si pas déjà présente.
 *  Mute `c.diseases` directement (appelé HORS itération — par les applicateurs de cascade). */
export function contractDiseaseOnce(c: Combatant, name: string, rng: RNG = defaultRNG): string[] {
  if ((c.diseases ?? []).some((d) => d.id === name)) return [];
  const dz = contractDisease(name, rng, { incubation: 0 });
  if (!dz) return [];
  c.diseases = [...(c.diseases ?? []), dz];
  return [t('dz.develop', { name: c.label, disease: diseaseLabel(name) })];
}

/** Conséquence d'un Test de Gangrène DIFFÉRÉ (l.135+) : échec → +1 échec ; au-delà du BE → Localisation perdue. */
export function applyDiseaseGangrene(c: Combatant, diseaseName: string, success: boolean, be: number): string[] {
  if (success) return [];
  const dz = (c.diseases ?? []).find((d) => d.id === diseaseName && d.phase === 'active');
  if (!dz) return [];
  dz.gangreneFails = (dz.gangreneFails ?? 0) + 1;
  if (dz.gangreneFails > be) {
    dz.gangreneLost = true;
    return [t('dz.gangreneLost', { name: c.label })];
  }
  return [t('dz.gangreneProgress', { name: c.label, fails: dz.gangreneFails })];
}

/** Conséquence du Test « persistant » de fin de durée DIFFÉRÉ (l.162) : réussite → guérison ;
 *  DR ≤ −6 → Infection du Sang ; ≤ −2 → Blessure Purulente ; sinon → +1d10 jours. La maladie en
 *  attente (`endTestPending`) est retirée (ou prolongée). Mute `c.diseases`. */
export function applyDiseasePersist(c: Combatant, diseaseName: string, success: boolean, sl: number, rng: RNG = defaultRNG): string[] {
  const dz = (c.diseases ?? []).find((d) => d.id === diseaseName && d.endTestPending);
  if (!dz) return [];
  dz.endTestPending = undefined;
  const log: string[] = [];
  const remove = () => { c.diseases = (c.diseases ?? []).filter((d) => d !== dz); };
  const cure = () => { remove(); log.push(t('dz.cured', { name: c.label, disease: diseaseLabel(dz.id) })); if (DISEASE_DEFS[dz.id]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.id]; };
  if (success) cure();
  else if (sl <= -6) { remove(); log.push(t('dz.degenerate', { name: c.label, disease: diseaseLabel(dz.id) })); log.push(...contractDiseaseOnce(c, 'infection-du-sang', rng)); }
  else if (sl <= -2) { remove(); log.push(t('dz.infects', { name: c.label, disease: diseaseLabel(dz.id) })); log.push(...contractDiseaseOnce(c, 'blessure-purulente', rng)); }
  else { const extra = roll(1, 10, rng); dz.minutesLeft = extra * MINUTES_PER_DAY; log.push(t('dz.persists', { name: c.label, disease: diseaseLabel(dz.id), days: extra })); }
  return log;
}

/**
 * Décompte de `minutes` de maladie écoulées pour `c` (l'entretien quotidien feed `MINUTES_PER_DAY` par
 * journée calendaire ; les tests peuvent passer un délai sous-journalier). Mute `c.diseases`, renvoie le
 * journal. `resistVal` = Résistance effective (E + augmentations) ; `beForGangrene` = Bonus d'Endurance
 * SEUL (seuil de Gangrène, ≠ resistVal). Tous deux passés par l'appelant (cycle évité).
 *
 * Le délai est découpé en PAS : autant de JOURNÉES PLEINES (`MINUTES_PER_DAY`) que possible, puis un
 * reliquat sous-journalier. Par pas :
 *  - incubation : −`pas` minutes ; à ≤0 → symptômes ACTIFS (durée mémorisée → `durationMinutes`) ;
 *  - active : sur une JOURNÉE PLEINE seulement (Tests RAW « par jour »), symptômes à `onTick` (Blessé,
 *             Toxine) → Test de cycle quotidien, et capacité `amputation` (Gangrène) → Test journalier ;
 *             puis −`pas` minutes ; à ≤0 → résolution (capacité `endTest`/`persistDifficulty`, l.162),
 *             sinon guérison. Une durée sous-journalière (heures/minutes) s'épuise donc DANS la journée,
 *             sans déclencher de Test « quotidien ».
 *
 * `defer` (CASCADE de nuit, journée unique) : les Tests de Résistance (cycle `onTick`/gangrène/persistant)
 * sont COLLECTÉS en étapes influençables au lieu d'être roulés ici ; l'état avance (incubation/durée),
 * la maladie en fin de durée reste `endTestPending` jusqu'à la validation de son étape. La conséquence
 * d'un `onTick` (GameOp `onFail`) est appliquée par l'applier `diseaseTick` côté state (restFlow) ;
 * gangrène/persistant par `applyDiseaseGangrene/Persist`.
 */
export function tickDisease(c: Combatant, minutes: number, rng: RNG = defaultRNG, resistVal = 0, defer?: UpkeepDeferTest, beForGangrene = Math.floor(resistVal / 10), emit?: ConditionEmit): string[] {
  if (minutes <= 0) return [];
  // Décroissance du RÉSIDU post-infection : −1 par jour plein (Vers du Reik « réduite de 1 point par jour
  // après la mort du ver », MSRC 16 l.138) — indépendante de toute maladie en cours.
  const fullDaysAll = Math.floor(minutes / MINUTES_PER_DAY);
  if (c.residualDiseaseTestMod && fullDaysAll > 0) c.residualDiseaseTestMod = Math.max(0, c.residualDiseaseTestMod - fullDaysAll) || undefined;
  if (!c.diseases?.length) return [];
  const log: string[] = [];
  // On boucle par PAS (journées pleines + reliquat) ; les nouvelles maladies (Blessure Purulente /
  // Infection du Sang) sont accumulées puis ajoutées en fin de tick (elles n'évoluent qu'aux pas suivants).
  const contracted: Disease[] = [];
  const contractOnce = (name: string) => {
    if (c.diseases!.some((d) => d.id === name) || contracted.some((d) => d.id === name)) return false;
    const dz = contractDisease(name, rng, { incubation: 0 }); // « instantanée » depuis un autre symptôme (l.32)
    if (dz) {
      contracted.push(dz);
      log.push(t('dz.develop', { name: c.label, disease: diseaseLabel(name) }));
    }
    return true;
  };

  // Pas d'avancement : N journées pleines (cycle de Tests RAW « par jour ») + reliquat sous-journalier.
  const fullDays = Math.floor(minutes / MINUTES_PER_DAY);
  const remainder = minutes - fullDays * MINUTES_PER_DAY;
  const steps: number[] = [];
  for (let i = 0; i < fullDays; i++) steps.push(MINUTES_PER_DAY);
  if (remainder > 0) steps.push(remainder);

  for (const stepMin of steps) {
    const isFullDay = stepMin === MINUTES_PER_DAY; // Tests de cycle RAW « par jour » : journée pleine uniquement
    const survivors: Disease[] = [];
    for (const dz of c.diseases) {
      dz.infectedMinutes = (dz.infectedMinutes ?? 0) + stepMin; // temps depuis la contraction (rampe d'incubation, l.138)
      // Résistance EFFECTIVE de CETTE maladie : base + bonus d'effets actifs scopés (op `diseaseTestMod`
      // — Fleur de lune +30 vs Peste noire, Tonique digestif +20). Injectée inline ET dans les bases différées.
      const rv = resistVal + activeDiseaseTestMod(c, dz.id);
      if (dz.phase === 'incubation') {
        dz.minutesLeft -= stepMin;
        if (dz.minutesLeft <= 0) {
          dz.phase = 'active';
          dz.minutesLeft = dz.durationMinutes;
          // Localisation de la lésion (cloque du Vers du Reik) tirée à l'entrée en phase active si un
          // symptôme la gate (`visiblePassive`) — jet de Localisation canonique, MSRC 16 l.140.
          if (dz.symptoms.some((s) => findSymptomById(s.symptomId)?.visiblePassive?.length)) dz.blisterLocation = rollBlisterLocation(rng);
          log.push(t('dz.symptomsOnset', { name: c.label, disease: diseaseLabel(dz.id) }));
        }
        survivors.push(dz);
        continue;
      }
      // active — symptômes à Test de cycle quotidien (`onTick` : Blessé, Toxine). DONNÉE-DRIVEN : on lit
      // l'onTick du symptôme (difficulté + conséquence GameOp `onFail`). DIFFÉRÉ en cascade influençable
      // (l'`onFail` est appliqué par l'applier d'étape côté state via applyOps) ; sinon roulé ici (chemin
      // non-différé — `runDailyUpkeep` sans cascade de nuit + tests unitaires) : on interprète la
      // conséquence inline (`contractDisease` → contraction directe ; `kill` → `fateSaveOrDie` mutualisé,
      // seule l'interprétation des ops reste locale — pas d'import d'`applyOps`, contrainte sans-cycle
      // de l'en-tête du fichier). Cadence RAW « par jour » → uniquement sur une JOURNÉE PLEINE (une
      // durée sous-journalière s'épuise sans Test « quotidien »).
      if (isFullDay) {
        dz.activeDaysElapsed = (dz.activeDaysElapsed ?? 0) + 1; // Jᵉ jour de phase active (MSRC 16 : cadence des Vers)
        const activeDay = dz.activeDaysElapsed;
        for (const inst of dz.symptoms) {
          if (symptomSuppressed(c, inst.symptomId)) continue; // symptôme suspendu (Racine de terre) : pas de Test de cycle
          const tick = symptomOnTick(inst);
          if (!tick) continue;
          // Cadence de phase active : `afterDays` = ne démarre qu'au Jᵉ jour ; `once` = uniquement CE jour-là
          // (Vers du Reik éclate au 7ᵉ ; Vers de carie teste chaque jour ≥ J+7 — MSRC 16 l.90/142).
          if (tick.afterDays != null && activeDay < tick.afterDays) continue;
          if (tick.once && activeDay !== tick.afterDays) continue;
          if (tick.difficulty == null) {
            // Conséquence INCONDITIONNELLE (pas de jet — éclatement du Vers du Reik, issue invariante,
            // MSRC 16 l.142) : appliquée DIRECTEMENT ici (defer ou non), via l'interprète inline restreint.
            applyOnFailInline(c, tick.onFail, contractOnce, log, emit);
          } else if (defer) defer({ kind: 'diseaseTick', label: t('step.sujetPrecision', { sujet: symptomLabel(inst.symptomId), precision: diseaseLabel(dz.id) }), base: rv, difficulty: tick.difficulty, meta: { diseaseName: dz.id, symptomId: inst.symptomId, onFail: tick.onFail } });
          else if (!rollTest(rv, tick.difficulty, rng).success) applyOnFailInline(c, tick.onFail, contractOnce, log, emit);
        }
        // Gangrène (l.176) : capacité `amputation` — Test de Résistance Accessible (+20) journalier ; plus
        // d'échecs que le Bonus d'Endurance → la Localisation est PERDUE (Amputation). Machinerie stateful.
        if (diseaseHasCapability(dz, 'amputation') && !dz.gangreneLost) {
          if (defer) defer({ kind: 'diseaseGangrene', label: symptomLabel('gangrene'), base: rv, difficulty: 'accessible', meta: { diseaseName: dz.id, symptomId: 'gangrene', be: beForGangrene } });
          else if (!rollTest(rv, 'accessible', rng).success) {
            dz.gangreneFails = (dz.gangreneFails ?? 0) + 1;
            if (dz.gangreneFails > beForGangrene) {
              dz.gangreneLost = true;
              log.push(t('dz.gangreneLost', { name: c.label }));
            } else log.push(t('dz.gangreneProgress', { name: c.label, fails: dz.gangreneFails }));
          }
        }
      }
      dz.minutesLeft -= stepMin;
      if (dz.minutesLeft > 0) {
        survivors.push(dz);
        continue;
      }
      // Phase active PERSISTANTE (Vers de carie, MSRC 16 l.90-101) : la dégénérescence quotidienne ne cesse
      // JAMAIS de mort naturelle — la maladie ne guérit pas à l'épuisement de la « Durée » (installation),
      // elle reste active (seule la Mort de la table, ou un retrait joueur, la termine).
      if (diseaseHasCapability(dz, 'persistentActive')) {
        dz.minutesLeft = dz.durationMinutes;
        survivors.push(dz);
        continue;
      }
      // Fin de Durée — résolution (DIFFÉRÉE en cascade : la maladie reste en attente).
      if (dz.persistDifficulty) {
        if (defer) {
          dz.endTestPending = true;
          defer({ kind: 'diseasePersist', label: t('dz.endStep', { disease: diseaseLabel(dz.id) }), base: rv, difficulty: dz.persistDifficulty, meta: { diseaseName: dz.id, symptomId: 'persistant' } });
          survivors.push(dz);
        } else {
          const res = rollTest(rv, dz.persistDifficulty, rng); // l.162
          if (res.success) {
            log.push(t('dz.cured', { name: c.label, disease: diseaseLabel(dz.id) }));
            if (DISEASE_DEFS[dz.id]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.id]; // Vérole Urticante (l.97)
          } else if (res.sl <= -6) {
            log.push(t('dz.degenerate', { name: c.label, disease: diseaseLabel(dz.id) }));
            contractOnce('infection-du-sang');
          } else if (res.sl <= -2) {
            log.push(t('dz.infects', { name: c.label, disease: diseaseLabel(dz.id) }));
            contractOnce('blessure-purulente');
          } else {
            const extra = roll(1, 10, rng); // échec minime → +1d10 jours (l.163)
            dz.minutesLeft = extra * MINUTES_PER_DAY;
            log.push(t('dz.persists', { name: c.label, disease: diseaseLabel(dz.id), days: extra }));
            survivors.push(dz);
          }
        }
      } else {
        log.push(t('dz.cured', { name: c.label, disease: diseaseLabel(dz.id) }));
        snapshotInfectionResidual(c, dz); // Vers du Reik : la pénalité de Résistance survit et décroît −1/jour (l.138)
        if (DISEASE_DEFS[dz.id]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.id]; // Vérole Urticante (l.97)
      }
    }
    c.diseases = survivors;
  }
  c.diseases = [...c.diseases, ...contracted];
  return log;
}
