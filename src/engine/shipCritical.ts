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
import { applyOps, type GameOp } from './ops';
import { shipHitLocation, hitLocation, type ShipRig, type ShipLocation } from './combat';
import { rollCritical, type CriticalResolved } from './critical';
import { rollTest } from './tests';
import { testValue } from './skills';
import type { Combatant } from './types';
import { SHIP_CRITICAL_TABLES, type ShipCritKey, type ShipCrewTest } from '../data/shipCriticals';

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
  /** « Canon détaché » : Test encouru par l'équipage du poste (DATA — compétence/difficulté/`onFail`). */
  crewTest?: ShipCrewTest;
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
    crewTest: entry.crewTest,
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

/** Membres d'équipage EXPOSÉS (vivants, conscients) pouvant encaisser une touche (Équipage / Éclats). PUR. */
export function exposedCrew(crew: Combatant[]): Combatant[] {
  return crew.filter((c) => !c.dead && (c.wounds?.current ?? 0) > 0);
}

const SHRAPNEL_DAMAGE = 9; // MDG ch.13 : « ces membres d'équipage subissent 9 Dégâts ».

/** Issue d'un Critique encaissé par une COQUE et RÉPERCUTÉ sur son équipage (MDG ch.13-14). */
export interface HullCriticalOutcome {
  location: ShipLocation;
  /** États NAVALS posés sur la coque (Voie d'eau / En flammes) — déjà appliqués. */
  hullOps: GameOp[];
  /** Localisation « Équipage » : un marin exposé encaisse un Critique de PERSONNAGE (déjà appliqué). */
  crewCrit?: { crewId: string; crit: CriticalResolved };
  /** Éclats : marins touchés (9 Dégâts chacun, déjà appliqués). */
  shrapnel: { crewId: string; damage: number }[];
  /** Critiques de Coque SUPPLÉMENTAIRES résolus (1d10…) — ops déjà appliqués à la coque. */
  extraHullCrits: ShipCriticalResolved[];
  /** « Canon détaché » : servants du poste qui ratent le Test (`crewTest.onFail` déjà appliqué à chacun). */
  detachedPoste?: { hits: { crewId: string }[] };
  lines: string[];
}

/**
 * « Canon détaché » (MDG ch.13 l.763-764) : « Les cordages fixant l'un des canons se rompent… L'équipage du
 * canon doit réussir un Test d'Athlétisme Intermédiaire (+0) sous peine de subir un coup infligeant 12 Dégâts. »
 * Chaque servant EXPOSÉ du poste tiré au sort encourt `crewTest` (compétence + difficulté en DONNÉE) ; un échec
 * applique `crewTest.onFail` (GameOp — ex. 12 Dégâts). PUR (mute les marins touchés, RNG injecté). `[]` si la
 * coque n'a aucun poste. Le canon RESTE à bord (≠ « Canon perdu », qui passe par l'op `removeShipPoste`).
 */
export function detachPosteCrewHit(hull: Combatant, crew: Combatant[], crewTest: ShipCrewTest, rng: RNG = defaultRNG): { crewId: string }[] {
  const postes = hull.postes;
  if (!postes?.length) return [];
  const poste = postes[rng.int(0, postes.length - 1)];
  const hits: { crewId: string }[] = [];
  for (const id of poste.crewIds ?? []) {
    const sailor = crew.find((c) => c.id === id);
    if (!sailor || sailor.dead || (sailor.wounds?.current ?? 0) <= 0) continue;
    if (!rollTest(testValue(sailor, crewTest.skillId), crewTest.difficulty, rng).success) {
      applyOps(sailor, crewTest.onFail, { rng });
      hits.push({ crewId: id });
    }
  }
  return hits;
}

/**
 * APPLIQUE un coup critique encaissé par une COQUE à elle-même ET à son ÉQUIPAGE (MDG ch.13-14) — la
 * brique qui fait que `crewIds` touche de VRAIS marins. PUR (mute la coque + les marins via `applyOps` /
 * `rollCritical`, RNG injecté) :
 *  - Localisation « Équipage » → un marin EXPOSÉ encaisse un Critique de PERSONNAGE (table LDB/AA via
 *    `rollCritical`, aucune table dupliquée) ;
 *  - sinon → les États navals de la table sont posés sur la coque ; les Éclats infligent 9 Dégâts à
 *    autant de marins exposés ; les Critiques de Coque supplémentaires (1d10…) sont résolus sur la coque.
 */
export function applyHullCritical(
  hull: Combatant, crew: Combatant[], rig: ShipRig, rng: RNG = defaultRNG, forcedLocRoll?: number, forcedCritRoll?: number,
): HullCriticalOutcome {
  const hit = resolveShipCriticalHit(rig, rng, forcedLocRoll, forcedCritRoll);
  const lines: string[] = [];
  const exposed = exposedCrew(crew);

  if (hit.crewHit) {
    const sailor = exposed[0];
    if (!sailor) {
      lines.push("Coup à l'Équipage, mais aucun marin exposé pour l'encaisser.");
      return { location: 'equipage', hullOps: [], shrapnel: [], extraHullCrits: [], lines };
    }
    const crit = rollCritical(sailor, hitLocation(d100(rng)), rng);
    applyOps(sailor, crit.ops, { rng });
    if (crit.traumas.length) sailor.traumas = [...(sailor.traumas ?? []), ...crit.traumas];
    if (crit.lethal) { sailor.wounds.current = 0; sailor.dead = true; }
    lines.push(`Équipage touché : ${sailor.name} encaisse un Critique — ${crit.name}.`);
    return { location: 'equipage', hullOps: [], shrapnel: [], extraHullCrits: [], crewCrit: { crewId: sailor.id, crit }, lines };
  }

  const crit = hit.crit!;
  lines.push(crit.log);
  // Effets de coque en `GameOp` : États navals (Voie d'eau / En flammes) ET « Canon perdu » (op
  // `removeShipPoste`, qui démancipe le chef via `crew`). On capte leurs lignes de journal.
  lines.push(...applyOps(hull, crit.ops, { rng, crew }));

  // « Canon détaché » (MDG ch.13 l.763-764) : l'équipage du poste encourt le Test data-driven `crewTest`
  // (compétence/difficulté/`onFail` en donnée — plus aucune valeur en dur). Le canon reste à bord.
  let detachedPoste: { hits: { crewId: string }[] } | undefined;
  if (crit.crewTest) {
    const hits = detachPosteCrewHit(hull, crew, crit.crewTest, rng);
    detachedPoste = { hits };
    if (hits.length) lines.push(`Canon détaché : ${hits.length} servant(s) ratent le Test et encaissent le coup.`);
  }

  // Éclats → 9 Dégâts à autant de marins exposés que l'Indice (plafonné au nombre de marins).
  const shrapnel: { crewId: string; damage: number }[] = [];
  for (let i = 0; i < crit.shrapnel && i < exposed.length; i++) {
    const sailor = exposed[i];
    applyOps(sailor, [{ op: 'wounds', amount: SHRAPNEL_DAMAGE, ignoreTB: false, ignoreAP: false }], { rng });
    shrapnel.push({ crewId: sailor.id, damage: SHRAPNEL_DAMAGE });
  }
  if (shrapnel.length) lines.push(`Éclats ${crit.shrapnel} : ${shrapnel.length} marin(s) subissent ${SHRAPNEL_DAMAGE} Dégâts.`);

  // Critiques de Coque supplémentaires (1d10…) — résolus sur la Coque (ops seulement, pas de récursion d'Éclats).
  const extraHullCrits: ShipCriticalResolved[] = [];
  for (let i = 0; i < crit.extraHullCrits; i++) {
    const extra = rollShipCritical('coque', rng);
    applyOps(hull, extra.ops, { rng });
    extraHullCrits.push(extra);
  }
  if (extraHullCrits.length) lines.push(`${extraHullCrits.length} Critique(s) de Coque supplémentaire(s).`);

  return { location: crit.location, hullOps: crit.ops, shrapnel, extraHullCrits, detachedPoste, lines };
}
