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
import { Combatant, Difficulty, UpkeepDeferTest } from './types';
import { RNG, defaultRNG, roll, type DiceSpec, rollDice, formatDice } from './dice';
import { MINUTES_PER_DAY } from './clock';
import { rollTest } from './tests';
import { maladies, diseaseLabel, findSymptomById, symptomLabel, type SymptomCapabilities } from '../data';
import type { GameOp } from './ops';
import type { PsychTrait, PsychType } from './psychology';

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
export function formatDiseaseTime(t: DiseaseTime): string {
  const label = t.unit === 'days' ? 'jours' : t.unit === 'hours' ? 'heures' : 'minutes';
  const fixed = t.dice.n === 0 || t.dice.sides === 0; // pas de dé → valeur fixe (le seul `plus`)
  return `${fixed ? String(t.dice.plus ?? 0) : formatDice(t.dice)} ${label}`;
}

/** Restant d'une instance (base MINUTES) → libellé humain à l'échelle la plus parlante (j / h / min). */
export function formatRemaining(minutes: number): string {
  const m = Math.max(0, minutes);
  if (m >= MINUTES_PER_DAY) return `${Math.round(m / MINUTES_PER_DAY)} j`;
  if (m >= 60) return `${Math.round(m / 60)} h`;
  return `${Math.round(m)} min`;
}

/** Instance de symptôme sur une maladie : RÉFÉRENCE un symptôme de `symptoms.json` par `symptomId`,
 *  + `severity`/`difficulty` PAR-INSTANCE (Convulsions Modérée → `severePassive` ; Persistant
 *  (Accessible) → difficulté du Test de fin). La mécanique (passive/onTick/capabilities) vit sur la
 *  DONNÉE du symptôme, lue par les helpers ci-dessous — plus d'enum de kinds en dur. */
export interface DiseaseSymptom {
  symptomId: string;
  severity?: 'moderee' | 'grave';
  difficulty?: Difficulty;
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
}

/** Instance de maladie portée par un personnage. */
export interface Disease {
  name: string;
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
  /** Bénédiction de Convalescence reçue (LDB 41 : « une fois par maladie et par personne ») —
   *  approximation : une fois par maladie. */
  convalescenceBlessed?: boolean;
  /** Cascade de nuit : le Test « persistant » de fin de durée est DIFFÉRÉ (étape influençable) ; la
   *  maladie reste en attente de résolution jusqu'à la validation de l'étape (`applyDiseasePersist`). */
  endTestPending?: boolean;
}


// Registre des maladies CÂBLÉES — DÉRIVÉ de `maladies.json` (data app-owned, éditable au Codex), keyé
// par `id`. Les valeurs verbatim (LDB 20) vivent désormais dans la donnée ; le COMPORTEMENT (cycle,
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
  name: string,
  rng: RNG = defaultRNG,
  opts?: { incubation?: number; duration?: number },
): Disease | null {
  const def = DISEASE_DEFS[name];
  if (!def) return null;
  const incub = Math.max(0, opts?.incubation != null ? opts.incubation * MINUTES_PER_DAY : rollDiseaseTime(def.incubation, rng));
  const dur = Math.max(1, opts?.duration != null ? opts.duration * MINUTES_PER_DAY : rollDiseaseTime(def.duration, rng));
  const persist = def.symptoms.find((s) => symptomHasCapability(s.symptomId, 'endTest'))?.difficulty;
  return {
    name,
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
/** GameOp passifs de TOUTES les maladies ACTIVES (collecte unifiée, lue par `passiveMods` kind 'maladie'). */
export function diseasePassiveOps(c: Combatant): GameOp[] {
  return (c.diseases ?? []).filter((d) => d.phase === 'active').flatMap((d) => d.symptoms.flatMap(symptomPassive));
}
/** Traits PSYCHOLOGIQUES conférés par les symptômes ACTIFS — op `grantPsychTrait` du MÊME canal `passive`
 *  que les pénalités continues (Rage meurtrière → Haine (toutes les choses vivantes) + Frénésie,
 *  Middenheim p.131). DÉRIVÉS, pas attachés : présents tant que la maladie est active (filtre de
 *  `diseasePassiveOps`), retirés d'office à la guérison — comme tout passif, ce module ne fait que LIRE le
 *  symptôme (jamais de mutation de `c.psychTraits` ni d'`applyOps`, donc aucun bookkeeping attache/détache).
 *  Fusionnés aux Traits STOCKÉS par `effectivePsychTraits` (psychology), seul POINT DE LECTURE. */
export function diseasePsychTraits(c: Combatant): PsychTrait[] {
  const out: PsychTrait[] = [];
  for (const op of diseasePassiveOps(c)) {
    if (op.op === 'grantPsychTrait') out.push({ type: op.psychType as PsychType, ...(op.cible ? { cible: op.cible } : {}) });
  }
  return out;
}
/** Test/conséquence de cycle quotidien d'une instance de symptôme (Blessé/Toxine) — donnée. */
export function symptomOnTick(inst: DiseaseSymptom): { difficulty: Difficulty; onFail: GameOp[] } | undefined {
  return findSymptomById(inst.symptomId)?.onTick;
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
  if ((c.diseases ?? []).some((d) => d.name === diseaseName)) return false;
  return !(c.diseaseImmunities ?? []).includes(diseaseName); // Vérole Urticante (l.97) : pas deux fois
}

/** Applique le RÉSULTAT d'un Test de Contraction DIFFÉRÉ : échec → contracte la maladie. Mute `c.diseases`. */
export function applyContraction(c: Combatant, diseaseName: string, success: boolean, rng: RNG = defaultRNG): string[] {
  if (success || !contractionDue(c, diseaseName)) return [];
  const dz = contractDisease(diseaseName, rng);
  if (!dz) return [];
  c.diseases = [...(c.diseases ?? []), dz];
  return [`${c.name} contracte : ${diseaseLabel(diseaseName)}.`];
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
  return applyContraction(c, diseaseName, rollTest(resistVal, difficulty, rng).success, rng);
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
  if ((c.diseases ?? []).some((d) => d.name === name)) return [];
  const dz = contractDisease(name, rng, { incubation: 0 });
  if (!dz) return [];
  c.diseases = [...(c.diseases ?? []), dz];
  return [`${c.name} développe : ${diseaseLabel(name)}.`];
}

/** Conséquence d'un Test de Gangrène DIFFÉRÉ (l.135+) : échec → +1 échec ; au-delà du BE → Localisation perdue. */
export function applyDiseaseGangrene(c: Combatant, diseaseName: string, success: boolean, be: number): string[] {
  if (success) return [];
  const dz = (c.diseases ?? []).find((d) => d.name === diseaseName && d.phase === 'active');
  if (!dz) return [];
  dz.gangreneFails = (dz.gangreneFails ?? 0) + 1;
  if (dz.gangreneFails > be) {
    dz.gangreneLost = true;
    return [`${c.name} : la Gangrène a gagné — la Localisation atteinte est inutilisable (Amputation requise).`];
  }
  return [`${c.name} : la Gangrène progresse (${dz.gangreneFails} échec(s)).`];
}

/** Conséquence du Test « persistant » de fin de durée DIFFÉRÉ (l.162) : réussite → guérison ;
 *  DR ≤ −6 → Infection du Sang ; ≤ −2 → Blessure Purulente ; sinon → +1d10 jours. La maladie en
 *  attente (`endTestPending`) est retirée (ou prolongée). Mute `c.diseases`. */
export function applyDiseasePersist(c: Combatant, diseaseName: string, success: boolean, sl: number, rng: RNG = defaultRNG): string[] {
  const dz = (c.diseases ?? []).find((d) => d.name === diseaseName && d.endTestPending);
  if (!dz) return [];
  dz.endTestPending = undefined;
  const log: string[] = [];
  const remove = () => { c.diseases = (c.diseases ?? []).filter((d) => d !== dz); };
  const cure = () => { remove(); log.push(`${c.name} guérit de : ${diseaseLabel(dz.name)}.`); if (DISEASE_DEFS[dz.name]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.name]; };
  if (success) cure();
  else if (sl <= -6) { remove(); log.push(`${c.name} : ${diseaseLabel(dz.name)} dégénère (échec stupéfiant).`); log.push(...contractDiseaseOnce(c, 'infection-du-sang', rng)); }
  else if (sl <= -2) { remove(); log.push(`${c.name} : ${diseaseLabel(dz.name)} s'infecte (échec).`); log.push(...contractDiseaseOnce(c, 'blessure-purulente', rng)); }
  else { const extra = roll(1, 10, rng); dz.minutesLeft = extra * MINUTES_PER_DAY; log.push(`${c.name} : ${diseaseLabel(dz.name)} persiste (+${extra} jours).`); }
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
export function tickDisease(c: Combatant, minutes: number, rng: RNG = defaultRNG, resistVal = 0, defer?: UpkeepDeferTest, beForGangrene = Math.floor(resistVal / 10)): string[] {
  if (!c.diseases?.length || minutes <= 0) return [];
  const log: string[] = [];
  // On boucle par PAS (journées pleines + reliquat) ; les nouvelles maladies (Blessure Purulente /
  // Infection du Sang) sont accumulées puis ajoutées en fin de tick (elles n'évoluent qu'aux pas suivants).
  const contracted: Disease[] = [];
  const contractOnce = (name: string) => {
    if (c.diseases!.some((d) => d.name === name) || contracted.some((d) => d.name === name)) return false;
    const dz = contractDisease(name, rng, { incubation: 0 }); // « instantanée » depuis un autre symptôme (l.32)
    if (dz) {
      contracted.push(dz);
      log.push(`${c.name} développe : ${diseaseLabel(name)}.`);
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
      if (dz.phase === 'incubation') {
        dz.minutesLeft -= stepMin;
        if (dz.minutesLeft <= 0) {
          dz.phase = 'active';
          dz.minutesLeft = dz.durationMinutes;
          log.push(`${c.name} : les symptômes de « ${diseaseLabel(dz.name)} » se déclarent.`);
        }
        survivors.push(dz);
        continue;
      }
      // active — symptômes à Test de cycle quotidien (`onTick` : Blessé, Toxine). DONNÉE-DRIVEN : on lit
      // l'onTick du symptôme (difficulté + conséquence GameOp `onFail`). DIFFÉRÉ en cascade influençable
      // (l'`onFail` est appliqué par l'applier d'étape côté state via applyOps) ; sinon roulé ici (chemin
      // non-différé/tests : on interprète la conséquence `contractDisease`). Cadence RAW « par jour » →
      // uniquement sur une JOURNÉE PLEINE (une durée sous-journalière s'épuise sans Test « quotidien »).
      if (isFullDay) {
        for (const inst of dz.symptoms) {
          const tick = symptomOnTick(inst);
          if (!tick) continue;
          if (defer) defer({ kind: 'diseaseTick', label: `${symptomLabel(inst.symptomId)} (${diseaseLabel(dz.name)})`, base: resistVal, difficulty: tick.difficulty, meta: { diseaseName: dz.name, onFail: tick.onFail } });
          else if (!rollTest(resistVal, tick.difficulty, rng).success) for (const op of tick.onFail) if (op.op === 'contractDisease') contractOnce(op.disease);
        }
        // Gangrène (l.176) : capacité `amputation` — Test de Résistance Accessible (+20) journalier ; plus
        // d'échecs que le Bonus d'Endurance → la Localisation est PERDUE (Amputation). Machinerie stateful.
        if (diseaseHasCapability(dz, 'amputation') && !dz.gangreneLost) {
          if (defer) defer({ kind: 'diseaseGangrene', label: 'Gangrène', base: resistVal, difficulty: 'accessible', meta: { diseaseName: dz.name, be: beForGangrene } });
          else if (!rollTest(resistVal, 'accessible', rng).success) {
            dz.gangreneFails = (dz.gangreneFails ?? 0) + 1;
            if (dz.gangreneFails > beForGangrene) {
              dz.gangreneLost = true;
              log.push(`${c.name} : la Gangrène a gagné — la Localisation atteinte est inutilisable (Amputation requise).`);
            } else log.push(`${c.name} : la Gangrène progresse (${dz.gangreneFails} échec(s)).`);
          }
        }
      }
      dz.minutesLeft -= stepMin;
      if (dz.minutesLeft > 0) {
        survivors.push(dz);
        continue;
      }
      // Fin de Durée — résolution (DIFFÉRÉE en cascade : la maladie reste en attente).
      if (dz.persistDifficulty) {
        if (defer) {
          dz.endTestPending = true;
          defer({ kind: 'diseasePersist', label: `Fin de « ${diseaseLabel(dz.name)} »`, base: resistVal, difficulty: dz.persistDifficulty, meta: { diseaseName: dz.name } });
          survivors.push(dz);
        } else {
          const res = rollTest(resistVal, dz.persistDifficulty, rng); // l.162
          if (res.success) {
            log.push(`${c.name} guérit de : ${diseaseLabel(dz.name)}.`);
            if (DISEASE_DEFS[dz.name]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.name]; // Vérole Urticante (l.97)
          } else if (res.sl <= -6) {
            log.push(`${c.name} : ${diseaseLabel(dz.name)} dégénère (échec stupéfiant).`);
            contractOnce('infection-du-sang');
          } else if (res.sl <= -2) {
            log.push(`${c.name} : ${diseaseLabel(dz.name)} s'infecte (échec).`);
            contractOnce('blessure-purulente');
          } else {
            const extra = roll(1, 10, rng); // échec minime → +1d10 jours (l.163)
            dz.minutesLeft = extra * MINUTES_PER_DAY;
            log.push(`${c.name} : ${diseaseLabel(dz.name)} persiste (+${extra} jours).`);
            survivors.push(dz);
          }
        }
      } else {
        log.push(`${c.name} guérit de : ${diseaseLabel(dz.name)}.`);
        if (DISEASE_DEFS[dz.name]?.immuneAfterCure) c.diseaseImmunities = [...(c.diseaseImmunities ?? []), dz.name]; // Vérole Urticante (l.97)
      }
    }
    c.diseases = survivors;
  }
  c.diseases = [...c.diseases, ...contracted];
  return log;
}
