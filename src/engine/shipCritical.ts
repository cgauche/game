/**
 * Résolveur de Blessures critiques sur un NAVIRE (MDG 13) — CODE GÉNÉRIQUE lisant la DONNÉE verbatim
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
import { SHIP_CRIT_SET, shipCritSet, type ShipCritSet, type ShipCritKey, type ShipCrewTest } from '../data/shipCriticals';

/** Réfs de tables data-driven d'une coque (MDG naval par défaut / MSRC fluvial) — `hull.locationTable` (colonne
 *  de Localisation) + `hull.criticalTable` (jeu de Critiques). Absentes → jeu naval MDG (comportement historique). */
export interface HullCritOpts { locationTable?: string | null; criticalTable?: string | null }

export interface ShipCriticalResolved {
  location: ShipCritKey;
  /** id STABLE du Critique (slug) — pour toute logique/réf ; `name` reste l'affichage. */
  id: string;
  name: string;
  /** Jet d10 effectif. */
  roll: number;
  /** Effets « État » à appliquer AU NAVIRE (En flammes / Voie d'eau) — langue unique `GameOp`. */
  ops: GameOp[];
  /** Éclats (Indice) : `shrapnel` membres d'équipage subissent l'effet Éclats du jeu (`set.shrapnelHit` — 9
   *  Dégâts en mer MDG, +5 en fleuve MSRC) — appliqué par la boucle de combat. Seul l'Indice est per-entry. */
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
export function rollShipCritical(location: ShipCritKey, rng: RNG = defaultRNG, forcedRoll?: number, set: ShipCritSet = SHIP_CRIT_SET): ShipCriticalResolved {
  const roll = forcedRoll ?? d10(rng);
  const table = set.tables[location];
  if (!table) {
    // La table de Localisation appariée à ce jeu ne produit jamais une Localisation absente du jeu ; garde-fou.
    return { location, id: 'aucun', name: '—', roll, ops: [], shrapnel: 0, extraHullCrits: 0, note: '', log: `Aucune table de Critique pour la Localisation « ${location} ».` };
  }
  const entry = findTableEntry(table, roll);
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
  /** Coup sur l'Équipage (MDG 13) : la touche revient à un membre d'équipage exposé. */
  crewHit: boolean;
  /** Critique de coque (Localisation ≠ Équipage). */
  crit?: ShipCriticalResolved;
}

/**
 * BRAIN du combat naval (MDG 13) — un coup CRITIQUE sur un navire : on détermine d'abord la
 * Localisation selon le gréement (`shipHitLocation`), puis on résout la table de cette Localisation.
 * Un coup à l'Équipage revient à un marin (Critique de personnage, géré par l'appelant qui connaît
 * l'équipage exposé). PUR — `forcedLocRoll`/`forcedCritRoll` figent les d100/d10 pour les tests.
 */
export function resolveShipCriticalHit(
  rig: ShipRig, rng: RNG = defaultRNG, forcedLocRoll?: number, forcedCritRoll?: number, opts?: HullCritOpts,
): ShipCriticalHit {
  const set = shipCritSet(opts?.criticalTable);
  const location = shipHitLocation(rig, forcedLocRoll ?? d100(rng), opts?.locationTable ?? 'navire');
  if (location === 'equipage') return { location, crewHit: true };
  return { location, crewHit: false, crit: rollShipCritical(location, rng, forcedCritRoll, set) };
}

/** Membres d'équipage EXPOSÉS (vivants, conscients) pouvant encaisser une touche (Équipage / Éclats). PUR. */
export function exposedCrew(crew: Combatant[]): Combatant[] {
  return crew.filter((c) => !c.dead && (c.wounds?.current ?? 0) > 0);
}

/** Issue d'un Critique encaissé par une COQUE et RÉPERCUTÉ sur son équipage (MDG 13-14). */
export interface HullCriticalOutcome {
  location: ShipLocation;
  /** États NAVALS posés sur la coque (Voie d'eau / En flammes) — déjà appliqués. */
  hullOps: GameOp[];
  /** Localisation « Équipage » : un marin exposé encaisse un Critique de PERSONNAGE (déjà appliqué). */
  crewCrit?: { crewId: string; crit: CriticalResolved };
  /** Éclats : marins touchés (effet data `SHRAPNEL_HIT` déjà appliqué — le Dégât réel, mitigé BE/PA, est
   *  journalisé par l'op `wounds` dans `lines`, pas réintrospecté ici). */
  shrapnel: { crewId: string }[];
  /** Critiques de Coque SUPPLÉMENTAIRES résolus (1d10…) — ops déjà appliqués à la coque. */
  extraHullCrits: ShipCriticalResolved[];
  /** « Canon détaché » : servants du poste qui ratent le Test (`crewTest.onFail` déjà appliqué à chacun). */
  detachedPoste?: { hits: { crewId: string }[] };
  lines: string[];
}

/** Équipage EXPOSÉ d'un poste tiré au sort (MDG « Canon détaché »). PUR. `[]` si la coque n'a aucun poste. */
function posteCrew(hull: Combatant, crew: Combatant[], rng: RNG): Combatant[] {
  const postes = hull.postes;
  if (!postes?.length) return [];
  const poste = postes[rng.int(0, postes.length - 1)];
  return (poste.crewIds ?? [])
    .map((id) => crew.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c && !c.dead && (c.wounds?.current ?? 0) > 0);
}

/**
 * Coup à l'ÉQUIPAGE consécutif à un Critique de coque, data-driven (`ShipCrewTest`) :
 *  - `crewTarget` : `poste` (équipage d'un poste tiré au sort — MDG « Canon détaché » ch.13 l.763-764, défaut)
 *    ou `deck` (toute personne EXPOSÉE sur le pont — MSRC gréement/superstructure « Toute personne présente sur
 *    le pont doit faire un Test… ») ;
 *  - `skillId`/`difficulty` PRÉSENTS → chaque cible encourt le Test ; un échec applique `crewTest.onFail` (GameOp) ;
 *  - `skillId`/`difficulty` ABSENTS → `onFail` s'applique AUTOMATIQUEMENT (MSRC « les échardes infligent +5 Dégâts
 *    aux rameurs », sans Test).
 * PUR (mute les marins touchés via `applyOps`, RNG injecté).
 */
export function applyCrewHit(hull: Combatant, crew: Combatant[], crewTest: ShipCrewTest, rng: RNG = defaultRNG): { crewId: string }[] {
  const victims = crewTest.crewTarget === 'deck' ? exposedCrew(crew) : posteCrew(hull, crew, rng);
  const hits: { crewId: string }[] = [];
  for (const sailor of victims) {
    const fails = crewTest.skillId && crewTest.difficulty
      ? !rollTest(testValue(sailor, crewTest.skillId), crewTest.difficulty, rng).success
      : true; // pas de Test → dégâts automatiques (MSRC rames)
    if (fails) {
      applyOps(sailor, crewTest.onFail, { rng });
      hits.push({ crewId: sailor.id });
    }
  }
  return hits;
}

/**
 * APPLIQUE un coup critique encaissé par une COQUE à elle-même ET à son ÉQUIPAGE (MDG 13-14) — la
 * brique qui fait que `crewIds` touche de VRAIS marins. PUR (mute la coque + les marins via `applyOps` /
 * `rollCritical`, RNG injecté) :
 *  - Localisation « Équipage » → un marin EXPOSÉ encaisse un Critique de PERSONNAGE (table LDB/AA via
 *    `rollCritical`, aucune table dupliquée) ;
 *  - sinon → les États navals de la table sont posés sur la coque ; les Éclats infligent 9 Dégâts à
 *    autant de marins exposés ; les Critiques de Coque supplémentaires (1d10…) sont résolus sur la coque.
 */
export function applyHullCritical(
  hull: Combatant, crew: Combatant[], rig: ShipRig, rng: RNG = defaultRNG, forcedLocRoll?: number, forcedCritRoll?: number, opts?: HullCritOpts,
): HullCriticalOutcome {
  const set = shipCritSet(opts?.criticalTable);
  const hit = resolveShipCriticalHit(rig, rng, forcedLocRoll, forcedCritRoll, opts);
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

  // Coup à l'équipage consécutif au Critique (`crewTest` data-driven) : poste tiré au sort (MDG « Canon
  // détaché », Test) ou toute personne EXPOSÉE sur le pont (MSRC gréement/superstructure, Test — ou rames,
  // automatique). Le canon reste à bord (≠ « Canon perdu », op `removeShipPoste`).
  let detachedPoste: { hits: { crewId: string }[] } | undefined;
  if (crit.crewTest) {
    const hits = applyCrewHit(hull, crew, crit.crewTest, rng);
    detachedPoste = { hits };
    if (hits.length) lines.push(`${hits.length} membre(s) d'équipage encaisse(nt) le Critique (${crit.name}).`);
  }

  // Éclats → effet data `set.shrapnelHit` (op `wounds` : 9 Dégâts en mer MDG / +5 en fleuve MSRC) à autant de
  // marins exposés que l'Indice (plafonné au nombre de marins). L'op JOURNALISE elle-même le Dégât réel
  // (mitigé BE/PA) → on capte ses lignes (comme les ops de coque ci-dessus), aucun littéral ni réintrospection.
  const shrapnel: { crewId: string }[] = [];
  const shrapnelLines: string[] = [];
  for (let i = 0; i < crit.shrapnel && i < exposed.length; i++) {
    const sailor = exposed[i];
    shrapnelLines.push(...applyOps(sailor, set.shrapnelHit, { rng }));
    shrapnel.push({ crewId: sailor.id });
  }
  if (shrapnel.length) {
    lines.push(`Éclats ${crit.shrapnel} : ${shrapnel.length} marin(s) touché(s).`);
    lines.push(...shrapnelLines);
  }

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
