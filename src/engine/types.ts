/** Types partagés du moteur de règles WFRP v4. */

/** Les 10 Caractéristiques (abréviations du Livre de base). */
export type CharKey =
  | 'CC' // Capacité de Combat
  | 'CT' // Capacité de Tir
  | 'F' // Force
  | 'E' // Endurance
  | 'I' // Initiative
  | 'Ag' // Agilité
  | 'Dex' // Dextérité
  | 'Int' // Intelligence
  | 'FM' // Force Mentale
  | 'Soc'; // Sociabilité

export const CHAR_KEYS: CharKey[] = ['CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc'];

export const CHAR_LABELS: Record<CharKey, string> = {
  CC: 'Capacité de Combat',
  CT: 'Capacité de Tir',
  F: 'Force',
  E: 'Endurance',
  I: 'Initiative',
  Ag: 'Agilité',
  Dex: 'Dextérité',
  Int: 'Intelligence',
  FM: 'Force Mentale',
  Soc: 'Sociabilité',
};

export type Characteristics = Record<CharKey, number>;

/** Localisations d'impact (Tableau de Localisation, Livre de base p. 159). */
export type HitLocation = 'tete' | 'brasG' | 'brasD' | 'corps' | 'jambeG' | 'jambeD';

export const HIT_LOCATION_LABELS: Record<HitLocation, string> = {
  tete: 'Tête',
  brasG: 'Bras gauche',
  brasD: 'Bras droit',
  corps: 'Corps',
  jambeG: 'Jambe gauche',
  jambeD: 'Jambe droite',
};

export interface SkillInstance {
  name: string;
  spec?: string;
  characteristic: CharKey;
  advances: number;
}

export interface TalentInstance {
  name: string;
  times: number;
}

export interface Weapon {
  name: string;
  type: 'melee' | 'ranged';
  /** Chaîne de dégâts d'arme, ex. "+BF+4" (mêlée) ou "+9" (distance). */
  damage: string;
  reach?: string | null;
  /** Portée en mètres (distance uniquement). */
  range?: number | null;
  qualities: string[];
}

/** Points d'Armure par localisation. */
export type ArmourPoints = Record<HitLocation, number>;

export interface ConditionInstance {
  name: string;
  value: number; // certains États s'empilent (ex. Hémorragique)
}

export interface Combatant {
  id: string;
  name: string;
  kind: 'hero' | 'enemy' | 'npc';
  species?: string;
  career?: string;
  characteristics: Characteristics;
  wounds: { current: number; max: number };
  advantage: number;
  conditions: ConditionInstance[];
  weapons: Weapon[];
  armour: ArmourPoints;
  skills: SkillInstance[];
  talents: TalentInstance[];
  /** Mouvement (cases par tour, dérivé de la table de Mouvement). */
  movement: number;
  // Destin / Résilience (héros uniquement)
  fate?: number;
  fortune?: number;
  resilience?: number;
  resolve?: number;
  motivation?: string;
  // Combat tactique (grille)
  pos?: { x: number; y: number };
  initiative?: number;
}

/** Niveau de difficulté d'un Test (Livre de base, Tests). */
export type Difficulty =
  | 'tresFacile' // +60
  | 'facile' // +40
  | 'moyen' // +20
  | 'accessible' // +20 (alias usage courant)
  | 'intermediaire' // +0
  | 'difficile' // -10
  | 'epique' // -20
  | 'tresDifficile'; // -30

export const DIFFICULTY_MODIFIERS: Record<Difficulty, number> = {
  tresFacile: 60,
  facile: 40,
  moyen: 20,
  accessible: 20,
  intermediaire: 0,
  difficile: -10,
  epique: -20,
  tresDifficile: -30,
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  tresFacile: 'Très facile (+60)',
  facile: 'Facile (+40)',
  moyen: 'Moyen (+20)',
  accessible: 'Accessible (+20)',
  intermediaire: 'Intermédiaire (+0)',
  difficile: 'Difficile (−10)',
  epique: 'Épique (−20)',
  tresDifficile: 'Très difficile (−30)',
};
