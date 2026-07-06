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
 * (l.2608/2609) via `resist.skill`. Ce qui reste TEXTE (blocage/gap distinct, non ré-arbitré ici) :
 * durées en JOURS (l.2545/2587 — ctx sans horloge au site de résolution, `state/combatFlow.ts`),
 * amputations PERMANENTES en desc non converties en séquelles structurelles, et l'action de lâcher
 * l'objet tenu (spatial/inventaire, hors du moteur pur).
 */
import aaJson from '../data/aa-criticals.json';
import { d100, d10, RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import { rollTest } from './tests';
import { bonus, effectiveChar } from './characteristics';
import { testValue } from './skills';
import { locationLabel } from './combat';
import { Combatant, HitLocation } from './types';
import { traumaById, traumaFicheById } from './trauma';
import type { GameOp } from './ops';
import type { CriticalResolved } from './critical';

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
  const be = bonus(effectiveChar(target, 'E'));
  const roll = Math.max(1, d100(rng) + aaCriticalOffset(overkill));
  const entry = findTableEntry(AA_TABLES[location], roll);
  const resistVal = effectiveChar(target, 'E') + (target.skills.find((s) => s.skillId === 'resistance')?.advances ?? 0);
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
  const traumas = (entry.traumas ?? []).map((id) =>
    traumaById(id, { be, d10: traumaFicheById(id).kind === 'fracture' ? d10(rng) : undefined }, location));
  return {
    location,
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
