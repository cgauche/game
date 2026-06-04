/**
 * Schéma de Scène/Niveau — contrat UNIQUE partagé par :
 *  - l'éditeur de niveau (lecture/écriture),
 *  - le runtime (exploration + combat),
 *  - le contenu de campagne (livré comme documents de scène à ce format).
 *
 * Aucune scène n'est codée « en dur » : la campagne est de la donnée.
 */
import { CharKey } from '../engine/types';

export type Terrain = 'sol' | 'herbe' | 'route' | 'bois' | 'eau' | 'mur' | 'porte' | 'plancher';

/** Terrains franchissables (pour le déplacement sur la grille). */
export const WALKABLE: Record<Terrain, boolean> = {
  sol: true,
  herbe: true,
  route: true,
  bois: false,
  eau: false,
  mur: false,
  porte: true,
  plancher: true,
};

export type Facing = 'N' | 'S' | 'E' | 'O';

export type EntityKind = 'heroStart' | 'pnj' | 'ennemi' | 'objet' | 'prop';

export interface CustomStatblock {
  name: string;
  char: Partial<Record<CharKey | 'M' | 'B', number>>;
  weaponDamage?: string; // ex. "+BF+4"
  armour?: number; // PA uniforme sur toutes localisations
  traits?: string[];
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
}

export type Effect =
  | { type: 'setFlag'; flag: string; value?: boolean }
  | { type: 'giveItem'; item: string }
  | { type: 'startCombat'; encounter: string }
  | { type: 'transition'; scene: string }
  | { type: 'startDialogue'; dialogue: string }
  | { type: 'journal'; text: string }
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
  dialogues: Dialogue[];
  triggers: Trigger[];
  encounters: EncounterDef[];
  flags: Record<string, boolean>;
  /** Scène de départ pour la campagne enchaînée. */
  startMessage?: string;
}

export const SCHEMA_VERSION = 1;

export function tileAt(scene: Scene, x: number, y: number): Terrain {
  if (x < 0 || y < 0 || x >= scene.dimensions.w || y >= scene.dimensions.h) return 'mur';
  return scene.tiles[y * scene.dimensions.w + x] ?? 'sol';
}

export function isWalkable(scene: Scene, x: number, y: number): boolean {
  return WALKABLE[tileAt(scene, x, y)] ?? false;
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
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}
