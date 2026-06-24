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
import type { Combatant, ShipPoste } from './types';
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
  /** « Canon perdu » (MDG ch.13 l.765) : un poste passe par-dessus bord (retrait via `loseRandomPoste`). */
  losePoste: boolean;
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
    losePoste: entry.losePoste ?? false,
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
  /** « Canon perdu » : un poste d'artillerie retiré de la coque (passé par-dessus bord). */
  lostPoste?: { weaponName: string };
  lines: string[];
}

/**
 * « Canon perdu » (MDG ch.13 l.765) : un poste d'artillerie de la coque passe par-dessus bord — RETIRÉ de
 * `hull.postes`, et son chef de pièce (`crewIds[0]`) perd son `mannedPoste` + l'arme dérivée (il ne sert plus
 * rien). PUR (mute la coque + le chef). Renvoie le poste perdu, ou `null` si la coque n'a aucun poste.
 */
export function loseRandomPoste(hull: Combatant, crew: Combatant[], rng: RNG = defaultRNG): ShipPoste | null {
  const postes = hull.postes;
  if (!postes?.length) return null;
  const [lost] = postes.splice(rng.int(0, postes.length - 1), 1);
  const chef = lost.crewIds?.[0] ? crew.find((c) => c.id === lost.crewIds![0]) : undefined;
  if (chef?.mannedPoste === lost) {
    chef.mannedPoste = undefined;
    chef.weapons = (chef.weapons ?? []).filter((w) => w.uid !== lost.item.uid);
  }
  return lost;
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
  applyOps(hull, crit.ops, { rng });

  // « Canon perdu » (MDG ch.13 l.765) : une pièce d'artillerie passe par-dessus bord — retirée de la coque.
  let lostPoste: { weaponName: string } | undefined;
  if (crit.losePoste) {
    const lost = loseRandomPoste(hull, crew, rng);
    if (lost) { lostPoste = { weaponName: lost.item.name }; lines.push(`${lost.item.name} passe par-dessus bord — perdu.`); }
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

  return { location: crit.location, hullOps: crit.ops, shrapnel, extraHullCrits, lostPoste, lines };
}
