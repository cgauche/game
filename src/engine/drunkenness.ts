/**
 * Ivresse — Résistance à l'alcool (Livre de base, Compétences, LDB 09 l.471-487). Rien d'inventé :
 *
 *  - « Après chaque boisson alcoolisée, faites un Test de Résistance à l'alcool, modifié par la
 *    puissance de la boisson. Pour chaque Test auquel vous échouez, vous subissez une pénalité de −10
 *    à vos CC, CT, Ag, Dex et Int, jusqu'à un maximum de −30 par Caractéristique. » → `drunkCharPenalties`
 *    (−10 × min(3, échecs), pool non-cumul, kind `ivresse`).
 *  - « Si vous échouez à un nombre de Tests égal à votre Bonus d'Endurance, vous êtes Ivre. » → seuil
 *    `alcoholFailures(c) >= BE` ⇒ 1d10 sur le Tableau d'Ivresse (`drunkenness.json`).
 *  - « Après une heure passée sans boire, effectuez un Test de Résistance à l'alcool Intermédiaire (+0).
 *    Les effets de l'ivresse se dissiperont après 10 − DR heures … Une fois tous les effets dissipés,
 *    effectuez un nouveau Test … Vous avez à présent la gueule de bois, qui correspond à l'État Exténué
 *    et ne peut pas être retiré pendant 5 − DR heures. » → `soberUp` (dissipation) + gueule de bois =
 *    Exténué à durée d'horloge (`addClockCondition`, purgée par l'entretien).
 *  - « Vous pouvez dépenser 1 Point de Détermination pour ignorer les modificateurs négatifs de
 *    l'ivresse jusqu'à la fin du prochain Round. » → flag `drunkIgnore` (ActiveEffect 1 Round) lu par
 *    le collecteur `passiveMods` (kind `ivresse` non émis tant qu'il dure).
 *
 * L'Ivresse n'est pas un système optionnel (elle ne vit pas au registre `OPTIONAL_RULES`) : elle
 * n'a d'effet que si un personnage BOIT de l'alcool (consommable Flow d'une boisson alcoolisée →
 * op `intoxicate` sur un Test raté). PUR : mute
 * `c`, renvoie journaux ; le RNG est injecté ; la valeur du Test de Résistance à l'alcool et le Bonus
 * d'Endurance sont passés par l'appelant (comme `provisions.ts`, pour éviter le cycle d'import).
 */
import type { Combatant, CharKey } from './types';
import { RNG, defaultRNG, d10 } from './dice';
import { findTableEntry } from './tables';
import type { GameOp } from './ops';
import drunkennessJson from '../data/drunkenness.json';

// Cycle d'import évité comme `provisions.ts` : ce module n'importe PAS `conditions`/`ops` (import
// de VALEUR — `ops.ts` importe CE module par valeur, l'inverse boucherait). La MÉCANIQUE d'un résultat
// d'Ivresse (Bravoure/meilleur ami/belligérant) est donc RENDUE en `GameOp[]` (`DrunkEntry.ops`, données
// de `drunkenness.json`) et appliquée par l'APPELANT (`case 'intoxicate'` d'`applyOps`, le seul, cf. son
// en-tête) — même patron que `soberUp`/`hangover` ci-dessous (« la source rend, l'appelant applique »).

/** Caractéristiques pénalisées par l'Ivresse (LDB 09 l.475). */
export const DRUNK_CARACS: CharKey[] = ['capacite-de-combat', 'capacite-de-tir', 'agilite', 'dexterite', 'intelligence'];

/** État d'ivresse d'un personnage (absent = sobre). */
export interface DrunkState {
  /** Tests de Résistance à l'alcool ratés (−10/échec aux DRUNK_CARACS, plafond −30). */
  failedTests: number;
  /** Seuil d'Ivresse franchi (échecs ≥ BE) : un résultat du Tableau d'Ivresse a été tiré. */
  drunk?: boolean;
  /** id du résultat d'Ivresse tiré (`drunkenness.json`). */
  result?: string;
}

interface DrunkEntry { id: string; min: number; max: number; name: string; effect: string; desc: string; ops?: GameOp[] }
const DRUNK_TABLE = (drunkennessJson as { table: DrunkEntry[] }).table;

/** Nombre d'échecs de Résistance à l'alcool accumulés. */
export function alcoholFailures(c: Combatant): number {
  return c.drunk?.failedTests ?? 0;
}

/** Ivre (seuil BE d'échecs franchi) ? */
export function isDrunk(c: Combatant): boolean {
  return c.drunk?.drunk === true;
}

/** Pénalité d'Ivresse aux DRUNK_CARACS : −10 par échec, plafond −30 (LDB 09 l.475). 0 sinon. */
export function drunkPenalty(c: Combatant): number {
  const f = alcoholFailures(c);
  return f > 0 ? -10 * Math.min(3, f) : 0;
}

/** Pénalités de Caractéristique dues à l'Ivresse (injectées dans le pool non-cumul via `passiveMods`).
 *  Seules CC/CT/Ag/Dex/Int sont touchées (l.475). Retourne [] pour les autres. */
export function drunkCharPenalties(c: Combatant, key: CharKey): number[] {
  const p = drunkPenalty(c);
  return p < 0 && DRUNK_CARACS.includes(key) ? [p] : [];
}

/**
 * Applique le résultat d'UN Test de Résistance à l'alcool consécutif à une boisson (l.475). Sur un
 * échec : +1 échec (donc −10 supplémentaire aux DRUNK_CARACS, plafond géré par `drunkPenalty`). Si le
 * nombre d'échecs atteint le Bonus d'Endurance `be` et que le personnage n'était pas déjà Ivre : il
 * devient Ivre → tirage 1d10 sur le Tableau d'Ivresse (effet appliqué par `applyDrunkResult`). Mute `c`.
 */
export function applyAlcoholTest(c: Combatant, success: boolean, be: number, rng: RNG = defaultRNG): { log: string[]; becameDrunk?: DrunkEntry; drunkOps?: GameOp[] } {
  const s: DrunkState = c.drunk ?? { failedTests: 0 };
  const log: string[] = [];
  if (success) { c.drunk = s; return { log }; }
  s.failedTests += 1;
  c.drunk = s;
  log.push(`${c.name} tient mal l'alcool (échec ${s.failedTests}) : −10 aux CC/CT/Ag/Dex/Int${s.failedTests >= 3 ? ' (plafond −30)' : ''}.`);
  if (!s.drunk && s.failedTests >= Math.max(1, be)) {
    const entry = applyDrunkResult(c, rng);
    log.push(`${c.name} est IVRE ! ${entry.desc}`);
    return { log, becameDrunk: entry, drunkOps: entry.ops };
  }
  return { log };
}

/** Passe le personnage Ivre : tire 1d10 sur le Tableau d'Ivresse et enregistre le résultat (`c.drunk`).
 *  La MÉCANIQUE (Bravoure → +20 Calme ; « meilleur ami » → ignore Préjugés/Animosités ; « tous » →
 *  Animosité (Tout le monde)) est `entry.ops` (`GameOp[]` de `drunkenness.json`) — RENDUE, pas exécutée
 *  ici (cf. en-tête) ; c'est `applyAlcoholTest`/l'appelant qui la joue via `applyOps`. La gueule de bois
 *  et le risque d'Empoisonné du résultat « blackout » restent résolus au dessoûlage (`soberUp`). Mute `c`. */
export function applyDrunkResult(c: Combatant, rng: RNG = defaultRNG): DrunkEntry {
  const roll = d10(rng);
  const entry = findTableEntry(DRUNK_TABLE, roll);
  const s = c.drunk ?? { failedTests: 0 };
  s.drunk = true;
  s.result = entry.id;
  c.drunk = s;
  // 'staggering' (Mvt OU Action) : lu par le tour de combat via `drunkStaggers` ; 'blackout' résolu au dessoûlage.
  return entry;
}

/** Résultat d'Ivresse « la pièce tourne » (l.481) : le tour n'autorise QUE Mouvement OU Action, pas les
 *  deux. Prédicat lu par la couche de tour de combat. */
export function drunkStaggers(c: Combatant): boolean {
  return c.drunk?.result === 'piece-tourne';
}

/**
 * Dessoûlage (l.485) : après une heure sans boire, un Test de Résistance à l'alcool Intermédiaire dont
 * le DR fixe la dissipation (10 − DR heures) ; un second fixe la gueule de bois (Exténué non retirable
 * pendant 5 − DR heures). Ici : les pénalités d'Ivresse sont levées (état sobre, ActiveEffect d'ivresse
 * retirés) et le SPEC de gueule de bois est RENVOYÉ (`hangover`) pour que l'appelant pose l'État Exténué à
 * durée d'horloge (`addClockCondition`, cf. en-tête — évite le cycle d'import). `now` = minute `gameTime`.
 * `drDissipation`/`drHangover` = DR des deux Tests (roulés/différés par l'appelant). Mute `c`.
 */
export function soberUp(c: Combatant, now: number, drDissipation: number, drHangover: number): { log: string[]; hangover?: { name: string; value: number; until: number } } {
  if (!c.drunk) return { log: [] };
  const log: string[] = [];
  // Les effets de l'Ivresse (pénalités + Bravoure/ami) se dissipent après 10 − DR heures — modélisé au
  // dessoûlage : on lève l'état et on retire les ActiveEffect d'ivresse (marqués `effectId:'ivresse'`
  // à l'application des `drunkOps`, cf. `case 'intoxicate'` d'`applyOps` — identité, jamais le libellé).
  const dissipH = Math.max(0, 10 - drDissipation);
  c.activeEffects = (c.activeEffects ?? []).filter((e) => e.effectId !== 'ivresse');
  c.drunk = undefined;
  log.push(`${c.name} dessoûle (effets dissipés après ${dissipH} h).`);
  // Gueule de bois = État Exténué non retirable pendant 5 − DR heures (durée d'horloge, purgée à l'entretien).
  const hangoverH = Math.max(1, 5 - drHangover);
  log.push(`${c.name} a la gueule de bois : 1 Exténué pendant ${hangoverH} h.`);
  return { log, hangover: { name: 'extenue', value: 1, until: now + hangoverH * 60 } };
}
