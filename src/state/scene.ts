/**
 * Schéma de Scène/Niveau — contrat UNIQUE partagé par :
 *  - l'éditeur de niveau (lecture/écriture),
 *  - le runtime (exploration + combat),
 *  - le contenu de campagne (livré comme documents de scène à ce format).
 *
 * Aucune scène n'est codée « en dur » : la campagne est de la donnée.
 */
import { CharKey, Difficulty } from '../engine/types';
import { terrainWalkable } from './terrain';
import { buildingBlockedAt } from './buildings';

/** Un terrain est un id de catalogue (cf. src/state/terrain.ts). */
export type Terrain = string;

export type Facing = 'N' | 'S' | 'E' | 'O';

/**
 * Rôle d'une entité de scène. `personnage` = tout être animé (apparence libre
 * via `ref` + dialogue/quête optionnel) — fusion des anciens `pnj`/`ennemi`,
 * que le combat (encounters) et l'interaction (dialogueId) ne distinguaient pas.
 * Les valeurs `pnj`/`ennemi` restent acceptées au chargement des scènes anciennes
 * (normalisées via `normalizeEntityKind`).
 */
export type EntityKind = 'heroStart' | 'personnage' | 'objet' | 'prop';

/** Mappe les anciennes valeurs de kind (`pnj`/`ennemi`) vers `personnage`. */
export function normalizeEntityKind(k: string): EntityKind {
  if (k === 'pnj' || k === 'ennemi') return 'personnage';
  if (k === 'heroStart' || k === 'personnage' || k === 'objet' || k === 'prop') return k;
  return 'personnage';
}

export interface CustomStatblock {
  name: string;
  char: Partial<Record<CharKey | 'M' | 'B', number>>;
  weaponDamage?: string; // ex. "+BF+4"
  armour?: number; // PA uniforme sur toutes localisations
  traits?: string[];
}

/** Override d'apparence (sinon seed dérivé de l'id). pins : slot → index. */
export interface EntityAppearance {
  seed?: number;
  pins?: Record<string, number>;
}

export interface SceneEntity {
  id: string;
  kind: EntityKind;
  pos: { x: number; y: number };
  facing?: Facing;
  label?: string;
  /** Référence au bestiaire (ennemi) ou à l'équipement (objet). */
  ref?: string;
  /** Profil personnalisé (sinon on utilise `ref`). */
  statblock?: CustomStatblock;
  dialogueId?: string;
  /** Clé d'asset (token). */
  sprite?: string;
  /** Butin remis quand l'objet est ramassé. */
  loot?: string[];
  /** Apparence (calques) : override éditeur ; sinon auto-variée au seed de l'id. */
  appearance?: EntityAppearance;
}

export interface BuildingParams {
  floors?: number;
  roofMaterial?: 'tuile' | 'chaume' | 'ardoise';
  timberColor?: string;
  wallColor?: string;
}

/** Bâtiment multi-tuiles (feature posée, façon « group » NWN). */
export interface BuildingFeature {
  id: string;
  /** id de catalogue (cf. src/state/buildings.ts + src/gameIso/catalog/buildings.ts). */
  type: string;
  foot: { x: number; y: number; w: number; h: number };
  facing?: Facing;
  /** cutaway = toit qui se lève (intérieur in-scene) ; door = façade pleine + porte → transition. */
  reveal: 'cutaway' | 'door';
  door?: { x: number; y: number };
  interiorScene?: string;
  entry?: string;
  params?: BuildingParams;
  label?: string;
}

export type Effect =
  | { type: 'setFlag'; flag: string; value?: boolean }
  | { type: 'giveItem'; item: string }
  | { type: 'giveMoney'; gold?: number; silver?: number; brass?: number }
  | { type: 'startCombat'; encounter: string }
  | { type: 'transition'; scene: string; entry?: string }
  /** Retour à la scène précédente (sortie d'intérieur), à la case d'entrée. */
  | { type: 'transitionBack' }
  | { type: 'startDialogue'; dialogue: string }
  | { type: 'journal'; text: string }
  | { type: 'document'; title: string; text: string }
  /** Test de compétence interactif : branche selon réussite/échec. */
  | {
      type: 'test';
      skill?: string;
      characteristic?: CharKey;
      difficulty?: Difficulty;
      /** DR minimum requis (par défaut 0 = simple réussite). */
      requireSL?: number;
      label?: string;
      onSuccess?: Effect[];
      onFailure?: Effect[];
    }
  | { type: 'endDialogue' };

export interface DialogueChoice {
  text: string;
  /** N'afficher que si ce flag est vrai (ou faux si préfixé par « ! »). */
  condition?: string;
  effects?: Effect[];
  next?: string; // id du nœud suivant
}

export interface DialogueNode {
  id: string;
  speaker?: string;
  text: string;
  choices: DialogueChoice[];
}

export interface Dialogue {
  id: string;
  start: string;
  nodes: DialogueNode[];
}

export interface Trigger {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  once?: boolean;
  /** Ne se déclenche que si ce flag est (vrai) ou (faux si « ! »). */
  condition?: string;
  effects: Effect[];
}

export interface EncounterDef {
  id: string;
  enemies: { ref?: string; statblock?: CustomStatblock; pos: { x: number; y: number } }[];
  /** Scène/flag déclenché à la victoire. */
  onVictory?: Effect[];
}

export interface Scene {
  id: string;
  nom: string;
  description: string;
  dimensions: { w: number; h: number };
  ambiance?: 'jour' | 'nuit' | 'interieur' | 'foret';
  /** Grille aplatie de longueur w×h (ligne par ligne). */
  tiles: Terrain[];
  entities: SceneEntity[];
  /** Bâtiments multi-tuiles posés sur la grille (optionnel → [] par défaut). */
  buildings?: BuildingFeature[];
  dialogues: Dialogue[];
  triggers: Trigger[];
  encounters: EncounterDef[];
  flags: Record<string, boolean>;
  /** Points d'arrivée nommés (pour les transitions depuis une autre scène). */
  entryPoints?: Record<string, { x: number; y: number }>;
  /** Scène de départ pour la campagne enchaînée. */
  startMessage?: string;
}

export const SCHEMA_VERSION = 1;

export function tileAt(scene: Scene, x: number, y: number): Terrain {
  if (x < 0 || y < 0 || x >= scene.dimensions.w || y >= scene.dimensions.h) return 'mur';
  return scene.tiles[y * scene.dimensions.w + x] ?? 'sol';
}

export function isWalkable(scene: Scene, x: number, y: number): boolean {
  if (buildingBlockedAt(scene, x, y)) return false;
  return terrainWalkable(tileAt(scene, x, y));
}

export function emptyScene(w = 20, h = 15): Scene {
  return {
    id: `scene-${Date.now()}`,
    nom: 'Nouvelle scène',
    description: '',
    dimensions: { w, h },
    ambiance: 'jour',
    tiles: new Array(w * h).fill('herbe'),
    entities: [],
    buildings: [],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}
