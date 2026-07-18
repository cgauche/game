/**
 * Helper d'AUTHORING de rencontres — PUR. Transforme une liste d'ennemis terse en la forme
 * CANONIQUE du schéma : des `SceneEntity` 'personnage' (qui portent profil/apparence/arme/
 * `combat`) + un `EncounterDef.members` qui les référence. Remplace l'ancienne migration au
 * chargement (`enemies[]` → entités cachées) : l'expansion se fait désormais à l'authoring, et
 * la VISIBILITÉ (`hidden`) est un choix explicite (défaut : visible — RAW, le groupe voit ses
 * adversaires, quitte à les manquer sur un Test de Perception opposé via `surprise`).
 *
 * Utilisé par les scènes de test (`src/scenes/**`). Le générateur de campagne (`scripts/campagne/lib.mjs`,
 * Node pur) délègue à `buildScene` (`tsx`, MÊME compilateur) — pas de mirroir JS séparé à maintenir.
 */
import type { CustomStatblock, EncounterDef, EncounterMember, SceneEntity, VictoryCondition } from './scene';
import type { EntityAppearance } from '../engine/authoringAppearance';
import type { Flow } from './flow';
import type { OptionalEntry } from '../engine/statEntry';
import type { AuthoredShipPoste, NavalTraitRef } from '../engine/types';
import type { SkillRef } from '../data';
import type { Dir8 } from './dir8';
import type { ThreatTier } from '../engine/advantagePool';

export interface AuthoredEnemy {
  ref?: string;
  statblock?: CustomStatblock;
  pos: { x: number; y: number };
  appearance?: EntityAppearance;
  weapon?: string;
  facing?: Dir8;
  label?: string;
  /** Animation d'ambiance en boucle (clé de AMBIENT_CLIPS, ex. 'feeding'/'howl') — portée par l'entité
   *  VISIBLE enrôlée (l'ennemi se repaît/hurle en exploration, puis combat aux mêmes cases). */
  anim?: string;
  /** Camp au spawn (défaut 'enemy'). */
  side?: 'enemy' | 'ally';
  /** PNJ allié piloté par l'IA (avec `side:'ally'`) : agit seul, le joueur ne le micro-gère pas. */
  ai?: boolean;
  /** Monture rideable. */
  mount?: boolean;
  /** Index (dans `enemies`) de la monture chevauchée au spawn. */
  rides?: number;
  optionals?: OptionalEntry[];
  spells?: string[];
  randomChars?: boolean;
  /** Compétences d'AUTEUR ajoutées (réfs `SkillRef`) — fusionnées au spawn (servant de pièce : Projectiles
   *  du Groupe de son engin, AA 10 p.122-124). */
  skills?: SkillRef[];
  /** Coque/navire (`ref` = id de `vehicles.json`) : `id`s d'entités d'ÉQUIPAGE exposées (MDG 14).
   *  Les ids des ennemis de la rencontre sont déterministes : `enemy-<idRencontre>-<index>`. */
  crewIds?: string[];
  /** Coque/navire : pièces d'artillerie MONTÉES (postes, MDG 12-13). Chaque poste réfère son équipage par
   *  `crewIds` (ids déterministes `enemy-<idRencontre>-<index>`) ; `applyShipPostes` sert le poste au chef. */
  postes?: AuthoredShipPoste[];
  /** Coque/navire : Améliorations d'INSTANCE (MDG 12, réfs par id ex. `{ id: 'blindage-fer' }`) — posées
   *  sur le Combattant au spawn (Blindage → PA de coque, Lissage → M…). */
  upgrades?: NavalTraitRef[];
  /** Surcharge la visibilité de la rencontre pour CET ennemi. */
  hidden?: boolean;
}

export interface AuthoredEncounter {
  id: string;
  enemies: AuthoredEnemy[];
  /** Camp pris en embuscade (Test de Surprise opposé, LDB 13). */
  surprise?: 'party' | 'enemies';
  onVictory?: Flow;
  /** Invisibles en exploration jusqu'au combat (embuscade visuelle). Défaut : false (visibles). */
  hidden?: boolean;
  /** Avantage initial — Manœuvrabilité (AA 11 l.53-65), cf. `EncounterDef.maneuverability`. */
  maneuverability?: 'party' | 'enemies';
  /** Avantage initial — Menace (AA 11 l.53-65), cf. `EncounterDef.threat`. */
  threat?: { camp: 'party' | 'enemies'; tier: ThreatTier };
  /** Avantage initial — Terrain (AA 11 l.53-65), cf. `EncounterDef.terrain`. */
  terrain?: { camp: 'party' | 'enemies'; heavy?: boolean };
  /** Objectif de victoire (#197), cf. `EncounterDef.victoryCondition`. Absent = `allEnemiesDead`. */
  victoryCondition?: VictoryCondition;
}

export interface BuiltEncounter {
  /** Entités à fusionner dans `scene.entities`. */
  entities: SceneEntity[];
  /** Rencontre à fusionner dans `scene.encounters`. */
  encounter: EncounterDef;
}

/** Expanse une rencontre terse en `{ entities, encounter(members) }`. PUR. */
export function buildEncounter(a: AuthoredEncounter): BuiltEncounter {
  const ids = a.enemies.map((_, i) => `enemy-${a.id}-${i}`);
  const entities: SceneEntity[] = a.enemies.map((e, i) => {
    const ent: SceneEntity = { id: ids[i], kind: 'personnage', pos: { ...e.pos } };
    if (e.ref) ent.ref = e.ref;
    if (e.statblock) ent.statblock = e.statblock;
    if (e.crewIds) ent.crewIds = e.crewIds;
    if (e.postes) ent.postes = e.postes;
    if (e.upgrades) ent.upgrades = e.upgrades;
    if (e.appearance) ent.appearance = e.appearance;
    if (e.weapon) ent.weapon = e.weapon;
    if (e.facing) ent.facing = e.facing;
    if (e.label) ent.label = e.label;
    if (e.anim) ent.anim = e.anim;
    const hidden = e.hidden ?? a.hidden ?? false;
    const combat: NonNullable<SceneEntity['combat']> = {};
    if (hidden) combat.hiddenUntilCombat = true;
    if (e.optionals) combat.optionals = e.optionals;
    if (e.spells) combat.spells = e.spells;
    if (e.randomChars) combat.randomChars = e.randomChars;
    if (e.skills) combat.skills = e.skills;
    if (Object.keys(combat).length) ent.combat = combat;
    return ent;
  });
  const members: EncounterMember[] = a.enemies.map((e, i) => {
    const m: EncounterMember = { entityId: ids[i] };
    if (e.side) m.side = e.side;
    if (e.ai) m.ai = e.ai;
    if (e.mount) m.mount = e.mount;
    if (e.rides != null && ids[e.rides]) m.ridesEntityId = ids[e.rides];
    return m;
  });
  const encounter: EncounterDef = { id: a.id, members };
  if (a.surprise) encounter.surprise = a.surprise;
  if (a.onVictory) encounter.onVictory = a.onVictory;
  if (a.maneuverability) encounter.maneuverability = a.maneuverability;
  if (a.threat) encounter.threat = a.threat;
  if (a.terrain) encounter.terrain = a.terrain;
  if (a.victoryCondition) encounter.victoryCondition = a.victoryCondition;
  return { entities, encounter };
}

/** Sucre : plusieurs rencontres → toutes les entités + toutes les rencontres, prêtes à étaler
 *  dans `scene({ entities: [...props, ...enc.entities], encounters: enc.encounters })`. PUR. */
export function buildEncounters(list: AuthoredEncounter[]): { entities: SceneEntity[]; encounters: EncounterDef[] } {
  const built = list.map(buildEncounter);
  return { entities: built.flatMap((b) => b.entities), encounters: built.map((b) => b.encounter) };
}
