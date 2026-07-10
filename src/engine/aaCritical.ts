/**
 * Système ALTERNATIF de Blessures Critiques d'AUX ARMES (« Une approche alternative des Blessures »,
 * l.2441-2627) — activé par la règle facultative `combat-aa-blessures = 'aa'` (défaut LDB). BIFURCATION
 * PROPRE : mêmes SORTIES que `rollCritical` (CriticalResolved), mais tables AA par Localisation
 * (`aa-criticals.json`) et règles AA :
 *  - PAS d'inversion de Localisation (le tir/coup a déjà sa Localisation, l.2476).
 *  - Décalage +10 par Blessure infligée AU-DELÀ de celles nécessaires pour tomber à 0 (l.2480) — rend le
 *    résultat PLUS sévère (l'exemple l.2498 : 8 Blessures au-delà → +80).
 *  - Colonne « Blessures » (l.2482) : Blessures supplémentaires perdues, appliquées SANS re-déclencher de
 *    Critique (`{op:'wounds'}` brut) ; « T » (triviale, l.2521) ne compte pas pour la mort ; « Mort » = létal.
 *  - Mort (l.2517) : si Inconscient ET 0 PB ET nombre de Blessures Critiques > Bonus d'Endurance → meurt
 *    en fin de Round (`aaDeathByCriticalCount`).
 * `desc` = « Effets supplémentaires » VERBATIM (règle 5) — reste l'affichage long terme. Les sous-effets
 * RÉCURRENTS/chiffrés y sont désormais AUSSI structurés en `ops` (#125) : durées « Nd10[-BE] Rounds »
 * (membre inutilisable, l.2557/2562/2588) via `maxWeaponHands.durationRounds` ; pénalités de Test à
 * durée Rounds (l.2610/2614) via `charMod.durationRounds` ; Tests conditionnels hors-Résistance
 * (l.2608/2609) via `resist.skill`. #153 poursuit : durées en JOURS (charMod/condition
 * `durationHours`, ctx.now câblé côté `state/combatFlow.ts`), Amputation DÉCLARÉE STRUCTURELLEMENT
 * (`entry.amputation`, même patron que `data/criticals.ts` LDB — Test de Résistance → séquelle
 * permanente via `permanentAmputations`), et lâcher l'objet tenu (op `disarm`, ci-dessous). #166 modélise
 * la cascade Aide Médicale + Test étendu de Guérison (bras 96-109/jambe 96-105) : `escalation.medicalAidGate`
 * pose une séquelle « membre désactivé » (`ops` passives) en attente d'Aide Médicale (`awaitingMedicalAid`),
 * dont l'usage se récupère par l'acte « Guérison » de l'Infirmerie (Test étendu DR `restoreDR`, `medicFlow`),
 * puis pénalité −10 / 1d10 jours (`recoveryPenalty`) ; le Sonné « jusqu'à Aide Médicale » via `lockedUntil`.
 * #167 modélise l'escalade « 1 doigt de plus par Round » (bras 116-120) et « perte du pied sans Chirurgie sous
 * 1d10 jours » (jambe 106-115). #165 modélise le Test de Dextérité (+20) PAR ACTION de « Main ensanglantée »
 * (bras 46-50, l.2569) par l'op `handGate` (marqueur PAR-MAIN, gate `attackHandGate` à la déclaration d'attaque,
 * Échec → op `disarm`).
 */
import aaJson from '../data/aa-criticals.json';
import { d100, d10, RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import { rollTest } from './tests';
import { bonus, effectiveChar } from './characteristics';
import { testValue } from './skills';
import { locationLabel } from './combat';
import { Combatant, HitLocation } from './types';
import { traumaById, traumaFicheById, stampCriticalEscalation, fireCritTriggers } from './trauma';
import type { GameOp } from './ops';
import type { CriticalResolved } from './critical';
import { resolveAmputation } from './critical';

interface AAEntry {
  id: string;
  min: number;
  max: number;
  name: string;
  /** Colonne « Blessures » : Blessures supplémentaires perdues (0 = trivial « T », absent = létal). */
  blessures?: number;
  /** « T » : n'est PAS comptée dans le nombre de Blessures Critiques nécessaires pour tuer (l.2521-2523). */
  trivial?: boolean;
  ops?: GameOp[];
  /** Test conditionnel de la ligne (« sous peine de… »). `skill` (optionnel, id STABLE `skills.json`) =
   *  compétence testée QUAND CE N'EST PAS de la Résistance (ex. Athlétisme, l.2609) — `testValue` gère
   *  déjà les compétences de base non entraînées. Absent (défaut historique) = Test de Résistance. */
  resist?: { difficulty: import('./types').Difficulty; onFail: GameOp[]; skill?: string };
  traumas?: string[];
  /** Amputation (AA « voir Amputation en page 180 de WFJDR ») DÉCLARÉE STRUCTURELLEMENT — même forme
   *  que `data/criticals.ts` (LDB) : `difficulty` = Test de Résistance (échec → À Terre, +Sonné si
   *  DR≤−2, +Inconscient si DR≤−4, comme LDB 18 l.328-333), `sequels` = ids de fiches de séquelle
   *  PERMANENTE (`traumas.json`), instanciées par `permanentAmputations` (SOURCE UNIQUE, réutilisée). */
  amputation?: import('../data/criticals').Amputation;
  /** Escalade GATÉE par les soins (même déclaration que `data/criticals.ts` LDB) : « Main ouverte » (l.127 :
   *  1 doigt/Round sans Aide Médicale) / « Pied écrasé » (l.180 : perte du pied si pas de Chirurgie sous 1d10
   *  jours) / « Épaule luxée » (l.125) / « Genou démis » (l.179 : membre désactivé jusqu'au Test étendu de
   *  Guérison après Aide Médicale). Instanciée par `stampCriticalEscalation`. */
  escalation?: import('../data/criticals').CritEscalation;
  lethal?: boolean;
  desc: string;
}

const T = aaJson as unknown as { tete: AAEntry[]; bras: AAEntry[]; corps: AAEntry[]; jambe: AAEntry[] };

const AA_TABLES: Record<HitLocation, AAEntry[]> = {
  tete: T.tete, brasG: T.bras, brasD: T.bras, corps: T.corps, jambeG: T.jambe, jambeD: T.jambe,
};

/** Décalage AA du jet de Critique (l.2480) : +10 par Blessure au-delà de 0. PUR. */
export function aaCriticalOffset(overkill: number): number {
  return 10 * Math.max(0, overkill);
}

/** Résout un Coup Critique AA sur `target` à `location`. `overkill` = Blessures infligées au-delà de 0
 *  (l.2480 : +10 chacune). Même SORTIE que `rollCritical` — la Localisation N'est PAS re-tirée (l.2476). */
export function resolveAACritical(
  target: Combatant,
  location: HitLocation,
  rng: RNG = defaultRNG,
  overkill = 0,
): CriticalResolved {
  const be = bonus(effectiveChar(target, 'endurance'));
  const roll = Math.max(1, d100(rng) + aaCriticalOffset(overkill));
  const entry = findTableEntry(AA_TABLES[location], roll);
  const resistVal = effectiveChar(target, 'endurance') + (target.skills.find((s) => s.skillId === 'resistance')?.advances ?? 0);
  const ops: GameOp[] = [];
  // Blessures supplémentaires (colonne Blessures, l.2482) : PB perdus, sans re-déclencher de Critique.
  if (typeof entry.blessures === 'number' && entry.blessures > 0) ops.push({ op: 'wounds', amount: entry.blessures });
  ops.push(...(entry.ops ?? []));
  if (entry.resist) {
    // `skill` (l.2609 : Test d'Athlétisme, pas de Résistance) — `testValue` couvre déjà les compétences
    // de base non entraînées (Athlétisme = « base », LDB) ; absent = Test de Résistance (comportement historique).
    const testVal = entry.resist.skill ? testValue(target, entry.resist.skill) : resistVal;
    const res = rollTest(testVal, entry.resist.difficulty, rng);
    if (!res.success) ops.push(...entry.resist.onFail);
  }
  // Occurrence-count PAR ID D'ENTRÉE (AA 07 l.96 : « Si vous subissez de nouveau ce résultat… ») : effet
  // ALTERNATIF `escalation.onRepeat` (séquelles REMPLACÉES, ops immédiates AJOUTÉES). SOURCE UNIQUE (chemin LDB).
  const repeated = (target.critEntriesSuffered ?? []).includes(entry.id);
  const repeat = repeated ? entry.escalation?.onRepeat : undefined;
  if (repeat?.ops) ops.push(...repeat.ops.map((o) => ({ ...o })));
  const traumaRefs = repeat?.traumas ?? entry.traumas ?? [];
  const traumas = traumaRefs.map((id) =>
    traumaById(id, { be, d10: traumaFicheById(id).kind === 'fracture' ? d10(rng) : undefined }, location));
  // Amputation (« voir Amputation en page 180 de WFJDR ») DÉCLARÉE STRUCTURELLEMENT — `resolveAmputation`
  // (SOURCE UNIQUE LDB/AA) : Test de Résistance indépendant du `resist` de la ligne (les deux coexistent déjà
  // côté LDB, ex. « Coup défigurant »/« Tendons coupés »). Roll placé en DERNIER (ne décale que ces critiques).
  // `timing: 'postEncounter'` (« Coupure à l'orteil » AA 07 l.171 : « Une fois la rencontre terminée… ») → aucun jet
  // ICI : marqueur `pendingAmputation` résolu au foyer de fin de combat (`resolvePostEncounterAmputations`),
  // MÊME patron que le chemin LDB (le foyer est kind-agnostique : il ne lit que le marqueur).
  if (!entry.lethal && entry.amputation) {
    if (entry.amputation.timing === 'postEncounter') {
      traumas.push({ label: entry.name, location, pendingAmputation: entry.amputation });
    } else {
      const amp = resolveAmputation(entry.amputation, location, resistVal, rng);
      ops.push(...amp.ops);
      traumas.push(...amp.traumas);
    }
  }
  // Escalade GATÉE par les soins (« Main ouverte » l.127 : doigt/Round ; « Pied écrasé » l.180 : perte du pied
  // sans Chirurgie sous 1d10 jours ; « Épaule luxée » l.125 / « Genou démis » l.179 : membre désactivé jusqu'au
  // Test étendu de Guérison) — en DERNIER (ne décale que les critiques à escalade). SOURCE UNIQUE (chemin LDB).
  stampCriticalEscalation(traumas, entry.escalation, location, rng, target.traumas ?? []);
  // Déclencheurs armés par un critique ANTÉRIEUR (« Commotion cérébrale », LDB 18 l.74) — un critique LDB peut
  // avoir armé le déclencheur, un critique AA le fait feu (l'historique est kind-agnostique). En DERNIER (RNG).
  ops.push(...fireCritTriggers(target, location, resistVal, rng));
  return {
    location,
    entryId: entry.id,
    name: entry.name,
    ops,
    lethal: !!entry.lethal,
    traumas,
    desc: entry.desc,
    roll,
    log: `Blessure critique AA (${locationLabel(location, target.bodyShape)}) — ${entry.name}${entry.lethal ? ' — MORT !' : ''}.`,
  };
}

/** Une Blessure Critique AA est-elle TRIVIALE (« T », l.2521) — non comptée pour la mort par accumulation ?
 *  Lue par la couche combat pour ne pas incrémenter `criticalWounds` sur un résultat trivial. PUR. */
export function aaCriticalIsTrivial(location: HitLocation, roll: number): boolean {
  return !!findTableEntry(AA_TABLES[location], Math.max(1, roll)).trivial;
}

/** Mort par accumulation de Blessures Critiques (l.2517) : un combattant Inconscient à 0 PB dont le nombre
 *  de Blessures Critiques dépasse son Bonus d'Endurance succombe en fin de Round. PUR. */
export function aaDeathByCriticalCount(inconscient: boolean, wounds: number, criticalWounds: number, be: number): boolean {
  return inconscient && wounds <= 0 && criticalWounds > be;
}
