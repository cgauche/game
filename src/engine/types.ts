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

/** Inverse de CHAR_LABELS : nom français complet → abréviation (pour les compétences). */
export const CHAR_BY_LABEL: Record<string, CharKey> = Object.fromEntries(
  (Object.entries(CHAR_LABELS) as [CharKey, string][]).map(([k, v]) => [v, k]),
) as Record<string, CharKey>;

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

/**
 * Effet magique actif et temporisé (Bénédiction, Sort de bonus…).
 * Les bonus ne se cumulent pas : le meilleur l'emporte par caractéristique
 * (Livre de base p.238 / p.220).
 */
export interface ActiveEffect {
  label: string;
  /** Caractéristique modifiée, le cas échéant. */
  char?: CharKey;
  /** Valeur du bonus (ex. +10). */
  bonus: number;
  /** Rounds restants avant dissipation. */
  roundsLeft: number;
}

export type ItemKind = 'melee' | 'ranged' | 'armor' | 'ammo' | 'misc';

/** Instance d'objet portée par un personnage (dérivée d'un trapping à stats). */
export interface ItemInstance {
  uid: string;
  name: string;
  kind: ItemKind;
  damage?: string; // armes
  reach?: string | null;
  range?: number | null;
  qualities: string[];
  pa?: number; // armures : Points d'Armure
  locs?: HitLocation[]; // armures : localisations couvertes
  enc: number; // encombrement
  equipped: boolean;
  desc?: string | null;
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
  /** Armes/armure ACTIVES (dérivées de l'équipement) — utilisées en combat. */
  weapons: Weapon[];
  armour: ArmourPoints;
  /** Inventaire complet à stats (porté, équipé ou non) — héros. */
  items?: ItemInstance[];
  /** Encombrement total porté (dérivé). */
  encumbrance?: number;
  skills: SkillInstance[];
  talents: TalentInstance[];
  /** Sorts/prières connus (libellés référençant src/data/spells.json). */
  spells?: string[];
  /** Effets magiques actifs et temporisés (buffs de Bénédiction/Sort). */
  activeEffects?: ActiveEffect[];
  /** Accumulateur de Focalisation : DR cumulé pour un sort d'Arcane/Domaine. */
  focus?: { spell: string; dr: number };
  /** Mouvement (cases par tour, dérivé de la table de Mouvement). */
  movement: number;
  // Destin / Résilience (héros uniquement)
  fate?: number;
  fortune?: number;
  resilience?: number;
  resolve?: number;
  motivation?: string;
  // Traumatisme (LDB 18) — modèle de mort
  /** Nombre de Blessures critiques cumulées (mort si > Bonus d'Endurance + Inconscient + 0 PB). */
  criticalWounds?: number;
  /** Rounds consécutifs passés à 0 PB sans soin (→ Inconscient après BE rounds). */
  roundsAtZero?: number;
  /** Mort (résultat létal ou mort lente). Hors de combat définitif. */
  dead?: boolean;
  /** PNJ important : utilise le système complet de critiques au lieu de la Mort Subite. */
  important?: boolean;
  /** « Meurs un autre jour » (Destin) : éjecté de la rencontre — vivant mais hors de combat. */
  outOfRencontre?: boolean;
  // Avancement par Points d'Expérience (héros uniquement, LDB Carrières)
  /** PX disponibles à dépenser. */
  xp?: number;
  /** Augmentations de Caractéristique DÉJÀ achetées par caractéristique (≠ valeur courante :
   *  sert au coût de la prochaine Augmentation, qui dépend du nombre déjà acheté, l.69). */
  charAdvances?: Partial<Record<CharKey, number>>;
  /** Niveau de Carrière courant (défaut 1) — détermine le schéma in-carrière pour le coût. */
  careerLevel?: number;
  // Combat tactique (grille)
  pos?: { x: number; y: number };
  initiative?: number;
  /** A gagné de l'Avantage durant le Round courant (upkeep de fin de Round, LDB Dépl. l.40). */
  gainedAdvThisRound?: boolean;
  /** « Sur la défensive » : +20 à tous les Tests de défense jusqu'au début du prochain tour (LDB Combat l.118). */
  defensiveStance?: boolean;
  /** Adversaires avec qui ce combattant est Engagé en mêlée (LDB 13-Combat l.174-175).
   *  Relationnel et symétrique ; purgé par paire en fin de Round si aucune attaque échangée. */
  engagedWith?: string[];
  /** IDs avec qui une attaque de mêlée a été échangée CE Round (upkeep de fin de Round,
   *  parallèle à gainedAdvThisRound) → sert à purger l'Engagement périmé (l.175). */
  meleeThisRound?: string[];
  /** Apparence visuelle (cosmétique, ignorée par le moteur ; lue par le rendu).
   *  Référence de TYPE seulement → élidée à la compilation, pas de dépendance runtime. */
  appearance?: import('../gameIso/rig/appearance').Appearance;
}

/** Niveau de difficulté d'un Test (Livre de base, Tests). */
// Tableau de Difficulté du Livre de base (12 - Tests.md), vérifié par audit de
// fidélité : « Accessible +20 », « Complexe −10 », « Difficile −20 » — pas de
// palier « Moyen » ni « Épique ».
export type Difficulty =
  | 'tresFacile' // +60
  | 'facile' // +40
  | 'accessible' // +20
  | 'intermediaire' // +0
  | 'complexe' // -10
  | 'difficile' // -20
  | 'tresDifficile'; // -30

export const DIFFICULTY_MODIFIERS: Record<Difficulty, number> = {
  tresFacile: 60,
  facile: 40,
  accessible: 20,
  intermediaire: 0,
  complexe: -10,
  difficile: -20,
  tresDifficile: -30,
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  tresFacile: 'Très facile (+60)',
  facile: 'Facile (+40)',
  accessible: 'Accessible (+20)',
  intermediaire: 'Intermédiaire (+0)',
  complexe: 'Complexe (−10)',
  difficile: 'Difficile (−20)',
  tresDifficile: 'Très difficile (−30)',
};
