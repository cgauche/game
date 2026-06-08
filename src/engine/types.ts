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

/**
 * Forme du corps d'une créature, pour la LOCALISATION d'impact (LDB « Point d'Impact des Créatures »
 * p.312). Humanoïde/quadrupède/oiseau partagent le Tableau humanoïde (p.159) — seules les ÉTIQUETTES
 * changent (quadrupède : membres antérieurs/postérieurs ; oiseau : ailes) et les Tableaux de Critiques
 * sont les mêmes. Serpent & araignée utilisent les « Localisations Alternatives » (p.312).
 */
export type BodyShape = 'humanoide' | 'quadrupede' | 'oiseau' | 'serpent' | 'araignee';

/** Étiquettes de localisation propres à une forme (surchargent HIT_LOCATION_LABELS ; LDB p.312). */
export const BODY_SHAPE_LOC_LABELS: Record<BodyShape, Partial<Record<HitLocation, string>>> = {
  humanoide: {},
  quadrupede: { brasG: 'Membre antérieur gauche', brasD: 'Membre antérieur droit', jambeG: 'Membre postérieur gauche', jambeD: 'Membre postérieur droit' },
  oiseau: { brasG: 'Aile gauche', brasD: 'Aile droite', jambeG: 'Patte gauche', jambeD: 'Patte droite' },
  serpent: {}, // n'expose que Tête / Corps
  araignee: { jambeD: 'Patte', corps: 'Abdomen' }, // n'expose que Tête / Pattes / Abdomen
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
  /** Famille d'arme (pour la compatibilité des munitions). */
  subType?: string;
  /** Rechargement : Indice DR à cumuler (Test étendu de Projectiles) ; 0 = aucun, tire chaque Round. */
  reload?: number;
  /** Dégâts subis par l'arme (LDB 62 l.178) : réduit les Dégâts de 1/point ; à +0 → improvisée. */
  damageTaken?: number;
  /** Arme détruite (Incident de Tir, LDB 14) : inutilisable. */
  destroyed?: boolean;
  /** SKIN cosmétique (objets uniques/légendaires) : override de palette token→hex appliqué au
   *  rendu de l'arme (ex. { metal:'#caa64a' } → lame dorée). Données opaques côté moteur. */
  skin?: Record<string, string>;
}

/** Points d'Armure par localisation. */
export type ArmourPoints = Record<HitLocation, number>;

export interface ConditionInstance {
  name: string;
  value: number; // certains États s'empilent (ex. Hémorragique)
  /** Source de l'État (id du Combatant) — pour le Test opposé de « se libérer » d'un Empêtré (LDB 16 l.61). */
  sourceId?: string;
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

/** Traumatisme (LDB 18-Traumatisme) — conséquence persistante d'une Blessure critique ou d'une
 *  Maladresse. Seuls les effets EN-COMBAT quantifiés sont modélisés (movementHalved, charPenalty) ;
 *  le reste (−10 Tests de Localisation, membre inutilisable, amputation, guérison) est journalisé
 *  dans `note` (→ Jalon 5). Persisté entre combats (cf. engine/persistence.ts). */
export interface Trauma {
  label: string;
  location: HitLocation;
  movementHalved?: boolean;
  charPenalty?: Partial<Record<CharKey, number>>;
  /** Pénalité (négative) aux Tests de mobilité/Esquive — trauma de jambe (LDB 18 l.298/315/369). */
  dodgePenalty?: number;
  note: string;
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
  /** Munition : famille compatible (Arc/Arbalète/Poudre noire) — correspond à `Weapon.subType`. */
  subType?: string;
  /** Quantité (paquet de munitions, ex. « (12) » → 12). */
  qty?: number;
  /** Dégâts subis par l'arme (LDB 62 l.178), persistés sur le trapping ; propagé au Weapon actif. */
  damageTaken?: number;
  /** Arme détruite (Incident de Tir) : non équipable. */
  destroyed?: boolean;
  /** SKIN cosmétique (objet unique/légendaire) : override de palette token→hex, propagé au
   *  `Weapon.skin` actif par `recomputeLoadout` → l'arme se rend recolorée. */
  skin?: Record<string, string>;
  /** Objet NON identifié (objet magique/légendaire trouvé) : ses qualités sont MASQUÉES à l'affichage
   *  (elles restent ACTIVES mécaniquement) tant qu'une Évaluation ne l'a pas révélé. Absent/true = identifié. */
  identified?: boolean;
}

export interface Combatant {
  id: string;
  name: string;
  kind: 'hero' | 'enemy' | 'npc';
  species?: string;
  career?: string;
  /** Catégorie de Taille (LDB 85). Optionnel ; défaut Moyenne au point de lecture (`effectiveSize`). */
  size?: import('./size').SizeCategory;
  /** Forme du corps (LDB p.312) : choisit le Tableau de Localisation. Défaut `humanoide` au point de lecture. */
  bodyShape?: BodyShape;
  /** Psychologie (LDB 21) : Indice de Peur/Terreur INSPIRÉ (statbloc) ; Immunité Psychologie (85 l.143-144). */
  causesPeur?: number;
  causesTerreur?: number;
  psychImmune?: boolean;
  /** Afflictions psychologiques ACTIVES en combat (Peur en cours, etc.). */
  psychState?: import('./psychology').PsychAffliction[];
  /** Frénésie active (LDB 21 l.31-36) : +1 BF, attaque obligatoire, immunité psy ; fin → Exténué. */
  frenzied?: boolean;
  /** Frénésie : l'attaque de CC GRATUITE de ce Round (l.34) a-t-elle déjà été utilisée ? (réinitialisé chaque Round.) */
  frenzyFreeUsed?: boolean;
  /** Détermination (LDB 17 l.62) : immunisé à la Psychologie « jusqu'à la fin du prochain Round ».
   *  Compteur de Rounds restants (2 à la dépense = ce Round + le prochain), décrémenté au passage de
   *  Round ; immunisé tant que > 0. Round-indépendant → consommé partout (déclencheurs ET modificateurs). */
  psychImmuneRoundsLeft?: number;
  /** Détermination (LDB 17 l.64) : ignore les modificateurs de Blessure critique (traumatismes) ; posé à la
   *  dépense, effacé au DÉBUT du prochain Round (passage de Round). */
  ignoreCritMods?: boolean;
  /** Groupes d'appartenance + traits psy possédés (matching des Cibles — utilisés en P3). */
  groups?: string[];
  psychTraits?: import('./psychology').PsychTrait[];
  /** Traits de créature (libellés canon) → attaques naturelles gratuites & règles dérivées
   *  (Morsure, Attaque caudale, Souffle… cf. engine/creatureAttacks). Conservés au spawn. */
  traits?: string[];
  /** Nuée (Trait Essaim, LDB 85 l.199-200) : ignore la Taille et la Psychologie, +40 au tir CONTRE
   *  elle, Frappe Mortelle sur toute touche, 1 PB/Round aux Engagés ; ×5 PB & +10 CC posés au spawn. */
  swarm?: boolean;
  /** Combat monté (LDB 14 l.212-225). `mountId` = la monture que CE combattant chevauche (→ il est
   *  cavalier) ; `riderId` = le cavalier porté (→ il est monture). Appairage DYNAMIQUE (Monter/Descendre).
   *  Le couple partage la position et l'empreinte de la MONTURE. */
  mountId?: string;
  riderId?: string;
  /** Ce combattant est une MONTURE rideable (peut être enfourché par un allié à pied — LDB 14). */
  mountable?: boolean;
  /** File transitoire d'attaques gratuites de créature restant à résoudre ce tour (kinds :
   *  morsure/caudale/pietinement) — pilotée par aiCreatureFreeAttacks à travers la modale de défense. */
  pendingFreeAttacks?: string[];
  /** A chargé ce tour → ouvre une Attaque gratuite de Cornes (LDB 85) si la créature a le trait. */
  chargedThisTurn?: boolean;
  characteristics: Characteristics;
  /** Points de Blessure. `base` = Blessures à vide (snapshot/surcharge au spawn) ; `max` dynamique
   *  = base + delta des buffs F/E/FM × Taille (cf. effectiveMaxWounds) ; `current` = PB restants. */
  wounds: { current: number; max: number; base?: number };
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
  /** Traumatismes subis (LDB 18) — persistants ; effets en-combat lus par effectiveChar/effectiveMovement. */
  traumas?: Trauma[];
  // Maladresse (LDB 14 — Tableau des Oups !) : effets reportés au prochain Round.
  /** Pénalité (positive) à l'Action au prochain Round (Oups! 41-60). Consommée au prochain Test d'attaque. */
  nextActionPenalty?: number;
  /** Perd sa prochaine Action (Oups! 71-80). */
  loseNextAction?: boolean;
  /** Perd son prochain Mouvement (Oups! 61-70). */
  loseNextMovement?: boolean;
  /** Agira en dernier au prochain Round (Oups! 21-40). */
  actLastNextRound?: boolean;
  /** Rounds consécutifs passés à 0 PB sans soin (→ Inconscient après BE rounds). */
  roundsAtZero?: number;
  /** A déjà bénéficié d'un soin de Blessures (Guérison) cette rencontre (LDB 09-Compétences l.233).
   *  Réinitialisé au début de chaque combat (startCombat). N'affecte PAS l'arrêt d'Hémorragie. */
  soinRencontreUtilise?: boolean;
  /** Mort (résultat létal ou mort lente). Hors de combat définitif. */
  dead?: boolean;
  /** PNJ important : utilise le système complet de critiques au lieu de la Mort Subite. */
  important?: boolean;
  /** « Meurs un autre jour » (Destin) : éjecté de la rencontre — vivant mais hors de combat. */
  outOfRencontre?: boolean;
  // NB : `ammoUid`/`loaded`/`reloadProgress` sont au niveau du combattant, pas de l'arme. Le modèle
  // suppose UNE arme à distance équipée à la fois (le tir et le rechargement ciblent la 1re `ranged`
  // via `attackWeapon`/`battleReload`). À porter sur l'arme si on autorise un jour 2 armes à distance.
  /** Munition sélectionnée pour l'arme à distance (uid d'un ItemInstance `kind 'ammo'`). */
  ammoUid?: string;
  /** Arme à distance chargée ? (Arc : toujours ; Recharge N : faux après un tir). */
  loaded?: boolean;
  /** DR cumulés du Test étendu de Projectiles vers `Weapon.reload` (Indice DR), pas un compteur d'Actions. */
  reloadProgress?: number;
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
  /** Action Viser engagée : +20 (Accessible) au PROCHAIN tir tant que la dernière action reste « viser »
   *  (LDB table des Difficultés, `14 - _GoBack.md` l.90 ; « pas de Test exigé pour viser »). */
  aiming?: boolean;
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
