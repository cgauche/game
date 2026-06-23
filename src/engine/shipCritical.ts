/**
 * Résolveur de Blessures critiques sur un NAVIRE (MDG ch.13) — CODE GÉNÉRIQUE lisant la DONNÉE verbatim
 * (`ship-criticals.json` via `data/shipCriticals`). Module FRÈRE de `critical.ts` : il tire le d10 sur la
 * table de la Localisation et rend une issue STRUCTURÉE et PURE (ne mute rien — l'appelant applique).
 *
 * Réutilisation stricte (pas de mécanique parallèle) :
 *  - les effets « État » (`fire`→En flammes, `leak`→Voie d'eau) sont rendus en **`GameOp`** (`condition`),
 *    appliqués par `applyOps` → posent les États NAVALS data-driven d'`etats.json` (mêmes briques que
 *    `critical.ts` qui pose Sonné/Inconscient) ;
 *  - `findTableEntry` pour le lookup d10 ;
 *  - l'Équipage touché suit les Critiques de PERSONNAGE (`critical.ts`) — aucune table dupliquée.
 * Les Éclats (Indice → équipage) et les Critiques de Coque supplémentaires sont RENDUS (l'équipage et la
 * récursion de Coque relèvent de la boucle de combat naval, qui connaît l'équipage du navire).
 */
import { d10, d100, rollDice, parseDice, type RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import type { GameOp } from './ops';
import { shipHitLocation, type ShipRig, type ShipLocation } from './combat';
import { SHIP_CRITICAL_TABLES, type ShipCritKey } from '../data/shipCriticals';

export interface ShipCriticalResolved {
  location: ShipCritKey;
  /** id STABLE du Critique (slug) — pour toute logique/réf ; `name` reste l'affichage. */
  id: string;
  name: string;
  /** Jet d10 effectif. */
  roll: number;
  /** Effets « État » à appliquer AU NAVIRE (En flammes / Voie d'eau) — langue unique `GameOp`. */
  ops: GameOp[];
  /** Éclats (Indice) : `shrapnel` membres d'équipage subissent 9 Dégâts (appliqué par la boucle de combat). */
  shrapnel: number;
  /** Critiques de Coque SUPPLÉMENTAIRES (déjà tirés depuis `hullCrits`, ex. « 1d10 » → un nombre). */
  extraHullCrits: number;
  /** Effets LONG TERME / narratifs verbatim (réductions de Man/Mouvement, réparations, chutes du gréement). */
  note: string;
  log: string;
}

/** Résout un Critique de navire sur la `location` touchée (Localisation déterminée en amont via
 *  `shipHitLocation` ; l'Équipage, lui, passe par `rollCritical`). `forcedRoll` = d10 imposé (tests). PUR. */
export function rollShipCritical(location: ShipCritKey, rng: RNG = defaultRNG, forcedRoll?: number): ShipCriticalResolved {
  const roll = forcedRoll ?? d10(rng);
  const entry = findTableEntry(SHIP_CRITICAL_TABLES[location], roll);
  // Effets « État » : AUTHORÉS en donnée (`entry.ops`, GameOp) — le résolveur n'a plus aucun couplage nom-d'État.
  const ops: GameOp[] = entry.ops ?? [];
  const extraHullCrits = entry.hullCrits ? rollDice(parseDice(entry.hullCrits)!, rng) : 0;
  return {
    location,
    id: entry.id,
    name: entry.name,
    roll,
    ops,
    shrapnel: entry.shrapnel ?? 0,
    extraHullCrits,
    note: entry.note,
    log: `Critique navire (${location}) : ${entry.name}${entry.shrapnel ? ` — Éclats ${entry.shrapnel}` : ''}${extraHullCrits ? ` — ${extraHullCrits} Critique(s) de Coque` : ''}.`,
  };
}

/** Résultat d'un Critique encaissé par un NAVIRE : la Localisation touchée, et soit un coup à l'ÉQUIPAGE
 *  (résolu par l'appelant en Critique de PERSONNAGE — `rollCritical` — sur un marin exposé), soit un
 *  Critique de Coque (`crit`). */
export interface ShipCriticalHit {
  location: ShipLocation;
  /** Coup sur l'Équipage (MDG ch.13) : la touche revient à un membre d'équipage exposé. */
  crewHit: boolean;
  /** Critique de coque (Localisation ≠ Équipage). */
  crit?: ShipCriticalResolved;
}

/**
 * BRAIN du combat naval (MDG ch.13) — un coup CRITIQUE sur un navire : on détermine d'abord la
 * Localisation selon le gréement (`shipHitLocation`), puis on résout la table de cette Localisation.
 * Un coup à l'Équipage revient à un marin (Critique de personnage, géré par l'appelant qui connaît
 * l'équipage exposé). PUR — `forcedLocRoll`/`forcedCritRoll` figent les d100/d10 pour les tests.
 */
export function resolveShipCriticalHit(
  rig: ShipRig, rng: RNG = defaultRNG, forcedLocRoll?: number, forcedCritRoll?: number,
): ShipCriticalHit {
  const location = shipHitLocation(rig, forcedLocRoll ?? d100(rng));
  if (location === 'equipage') return { location, crewHit: true };
  return { location, crewHit: false, crit: rollShipCritical(location, rng, forcedCritRoll) };
}
