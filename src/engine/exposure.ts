/**
 * Exposition (LDB 18-Traumatisme l.408-415) — dormir DEHORS dans un environnement difficile.
 * « Après 4 heures passées dans un environnement difficile – comme lorsque les températures sont
 * négatives, dans un désert brûlant ou une tempête, vous devez effectuer un Test de Résistance.
 * Lorsque vous vous retrouvez dans un environnement aux conditions extrêmes, ce Test doit être
 * effectué toutes les deux heures. »
 * FROID (l.415) : 1ᵉʳ échec → −10 CT/Agilité/Dextérité ; 2ᵉ → −10 toutes les autres ; 3ᵉ+ →
 * 1d10 Dégâts ignorant les PA (min 1) ; à 0 PB → Inconscient. « Certaines Possessions accordent
 * des bonus et des pénalités pour ces Tests » : sans bon Manteau, pénalité au Test de Froid
 * (ch.66 l.46 — non chiffrée dans le canon : application déclarée −10).
 *
 * Applications déclarées (le canon ne chiffre pas le sommeil dehors) :
 *  - une NUIT (~8 h) en environnement difficile = 2 Tests (1/4 h) ; extrême = 4 Tests (1/2 h) ;
 *  - un ABRI (Tente, ch.74 — ou abri construit, Survie en extérieur ch.09 l.559) ANNULE
 *    l'Exposition d'une nuit difficile, et ramène une nuit extrême au rythme difficile (2 Tests) ;
 *  - les pénalités d'Exposition se dissipent après 24 h (purge d'horloge #T3) ;
 *  - la météo de scène donne la sévérité : pluie/neige = difficile, tempête = extrême (froid).
 * Pur : mute `c`, renvoie jets + journal.
 */
import type { Combatant, CharKey } from './types';
import type { RNG } from './dice';
import { rollTest } from './tests';
import { COMBAT_PERSIST } from './ops';
import { addCondition, hasCondition, loseWounds } from './conditions';

export type ExposureSeverity = 'clement' | 'difficile' | 'extreme';

/** Sévérité d'Exposition dérivée de la météo de scène (donnée d'auteur — pas de simulation). */
export function weatherExposure(weather?: string): ExposureSeverity {
  if (weather === 'tempete') return 'extreme';
  if (weather === 'pluie' || weather === 'neige') return 'difficile';
  return 'clement';
}

/** Le personnage porte-t-il une protection contre les intempéries (Manteau/Cape, ch.66 l.46) ? Détecté
 *  par le marqueur STABLE `weatherProtection` du trapping (≠ nom — multilangue-safe). */
export function hasCoat(c: Combatant): boolean {
  return (c.items ?? []).some((it) => it.weatherProtection);
}

/** Un abri (Tente) dans le paquetage du groupe ? (campement — application déclarée). Détecté par le
 *  marqueur STABLE `isShelter` du trapping (≠ nom — multilangue-safe). */
export function partyHasTent(party: Combatant[]): boolean {
  return party.some((h) => (h.items ?? []).some((it) => it.isShelter));
}

export interface ExposureRoll {
  base: number;
  target: number;
  roll: number;
  sl: number;
  success: boolean;
}

const FIRST_FAIL: CharKey[] = ['CT', 'Ag', 'Dex'];
const SECOND_FAIL: CharKey[] = ['CC', 'F', 'E', 'I', 'Int', 'FM', 'Soc'];

/** Nombre de Tests d'une nuit dehors selon sévérité et abri. */
export function exposureTestCount(severity: ExposureSeverity, sheltered: boolean): number {
  if (severity === 'clement') return 0;
  if (severity === 'extreme') return sheltered ? 2 : 4;
  return sheltered ? 0 : 2;
}

/** Protection magique contre les intempéries (op `weatherWard`) : aucun Test de froid tant qu'elle dure. */
export function isWeatherWarded(c: Combatant): boolean {
  return (c.activeEffects ?? []).some((e) => e.weatherImmune);
}

/** Cible (et base) d'UN Test d'Exposition au froid : Résistance +0, −10 sans manteau ni cape (ch.66 l.46). */
export function exposureTarget(c: Combatant, resVal: number): number {
  return Math.max(0, resVal + (hasCoat(c) ? 0 : -10));
}

/**
 * Applique la `failures`-ième défaillance d'Exposition au froid (RAW l.415, escalade CUMULATIVE —
 * c'est cette dépendance qui rend la séquence SÉQUENTIELLE) : 1 → −10 CT/Ag/Dex ; 2 → −10 le reste ;
 * 3+ → 1d10 Blessures (ignore les PA), Inconscient à 0 PB. Mute `c` ; renvoie le journal + les
 * Blessures infligées. Partagé par `exposureNight` (eager) et l'applicateur de cascade « exposure ».
 */
export function applyExposureFailure(c: Combatant, failures: number, rng: RNG): { log: string[]; wounds: number } {
  const log: string[] = [];
  if (failures === 1) {
    for (const k of FIRST_FAIL) c.activeEffects = [...(c.activeEffects ?? []), { label: 'Exposition (froid)', effectId: 'exposition-froid', char: k, bonus: -10, roundsLeft: COMBAT_PERSIST }];
    log.push(`${c.name} grelotte — −10 CT/Agilité/Dextérité (Exposition au froid).`);
    return { log, wounds: 0 };
  }
  if (failures === 2) {
    for (const k of SECOND_FAIL) c.activeEffects = [...(c.activeEffects ?? []), { label: 'Exposition (froid)', effectId: 'exposition-froid', char: k, bonus: -10, roundsLeft: COMBAT_PERSIST }];
    log.push(`${c.name} est transi — −10 à toutes les autres Caractéristiques.`);
    return { log, wounds: 0 };
  }
  const dmg = Math.max(1, rng.int(1, 10));
  loseWounds(c, dmg);
  log.push(`${c.name} souffre du froid : ${dmg} Blessure(s) (ignore les PA).`);
  if (c.wounds.current <= 0 && !hasCondition(c, 'inconscient')) {
    addCondition(c, 'inconscient');
    log.push(`${c.name} sombre, gelé — Inconscient.`);
  }
  return { log, wounds: dmg };
}

/**
 * Une NUIT d'Exposition au froid pour `c` : `count` Tests de Résistance (+0) — sans manteau, −10.
 * Applique les échecs en cascade (RAW l.415, via `applyExposureFailure`). Renvoie les jets et le journal.
 */
export function exposureNight(c: Combatant, count: number, resVal: number, rng: RNG): { rolls: ExposureRoll[]; log: string[]; failures: number; wounds: number } {
  if (isWeatherWarded(c)) {
    return { rolls: [], log: [`${c.name} ignore le froid et les intempéries (protection magique).`], failures: 0, wounds: 0 };
  }
  const rolls: ExposureRoll[] = [];
  const log: string[] = [];
  let failures = 0;
  let wounds = 0;
  const target = exposureTarget(c, resVal);
  for (let i = 0; i < count; i++) {
    const res = rollTest(target, 'intermediaire', rng);
    rolls.push({ base: target, target: res.target, roll: res.roll, sl: res.sl, success: res.success });
    if (res.success) continue;
    failures++;
    const f = applyExposureFailure(c, failures, rng);
    log.push(...f.log);
    wounds += f.wounds;
  }
  if (!hasCoat(c) && count > 0) log.push(`${c.name} n'a ni manteau ni cape — le froid mord (−10 aux Tests d'Exposition).`);
  return { rolls, log, failures, wounds };
}

/** Pose une échéance d'horloge sur les pénalités d'Exposition (dissipation après 24 h au chaud). */
export function expireExposureEffects(c: Combatant, untilTime: number): void {
  for (const e of c.activeEffects ?? []) {
    if (e.effectId === 'exposition-froid' && e.untilTime == null) e.untilTime = untilTime;
  }
}
