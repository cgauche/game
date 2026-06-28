import { Combatant } from '../../engine/types';
import { Scene, Terrain } from '../../state/scene';
import type { WorldMap } from '../../state/worldMap';
import { buildEncounters, type AuthoredEncounter } from '../../state/encounterAuthoring';

/** Attache des rencontres authored (terse) à une scène : expanse chaque liste d'ennemis en
 *  entités 'personnage' + `members` canoniques, pousse les entités dans la scène et pose les
 *  rencontres. Mutation EN PLACE (les scénarios construisent leur scène impérativement). */
export function setEncounters(scene: Scene, list: AuthoredEncounter[]): void {
  const built = buildEncounters(list);
  scene.entities.push(...built.entities);
  scene.encounters = built.encounters;
}

/** Sections du menu des scénarios de test (l'emoji fait partie du libellé affiché). */
export type ScenarioCategory =
  | '⚔️ Combat'
  | '✨ Magie'
  | '🐲 Créatures'
  | '🧭 Survie'
  | '🛒 Marché'
  | '🗺️ Scénarios complets'
  | '⛵ Naval'
  | '🖼️ Rendu';

/** Un scénario de test = un groupe fixé + une scène adaptée (+ combat direct optionnel). */
export interface TestScenario {
  id: string;
  order: number; // tri d'affichage dans la section
  category: ScenarioCategory; // section du menu
  icon: string; // emoji de carte
  title: string;
  tests: string; // une ligne : « ce que ça vérifie »
  partyNote: string; // ex. « Arbalétrier solo »
  makeParty: () => Combatant[];
  scene: Scene;
  autoCombat?: string; // id d'encounter → démarre le combat directement
  /** Scènes supplémentaires du scénario (destinations de voyage, intérieurs…) — chargées en projet. */
  extraScenes?: Scene[];
  /** Carte du monde du scénario (#T2 Voyage). */
  worldMap?: WorldMap;
  /** Bourse de départ (le lancement écrase la richesse par défaut) — ex. payer la diligence. */
  money?: { gold: number; silver: number; brass: number };
  /** Règles optionnelles pré-activées au lancement (mêmes ids que le panneau Règles maison, donc
   *  modifiables en jeu) — ex. `{ 'travel-etapes': true }` pour le Voyage par Étapes EDOC. */
  rules?: Record<string, import('../../engine/policy').RuleValue>;
}

/** Arène dégagée + point de départ des héros (base des scénarios de combat direct). */
export function arena(opts: {
  id: string;
  nom: string;
  w?: number;
  h?: number;
  terrain?: Terrain;
  heroStart?: { x: number; y: number };
}): Scene {
  const w = opts.w ?? 16;
  const h = opts.h ?? 10;
  return {
    id: opts.id,
    nom: opts.nom,
    description: 'Arène de test.',
    dimensions: { w, h },
    ambiance: 'exterieur',
    levels: [{ z: 0, tiles: new Array(w * h).fill(opts.terrain ?? 'herbe') as Terrain[] }],
    entities: [{ id: 'start', kind: 'heroStart', pos: opts.heroStart ?? { x: 2, y: Math.floor(h / 2) } }],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}
