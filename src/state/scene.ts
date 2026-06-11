/**
 * Schéma de Scène/Niveau — contrat UNIQUE partagé par :
 *  - l'éditeur de niveau (lecture/écriture),
 *  - le runtime (exploration + combat),
 *  - le contenu de campagne (livré comme documents de scène à ce format).
 *
 * Aucune scène n'est codée « en dur » : la campagne est de la donnée.
 */
import { CharKey, Difficulty } from '../engine/types';
import type { DayPhaseKey } from '../engine/clock';
import type { Dir8 } from './dir8';
import { terrainWalkable } from './terrain';
import { buildingBlockedAt } from './buildings';
import { entityBlockedAt } from './sceneRules';
import { migrateEntityKind } from './sceneMigrate';

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
export type EntityKind = 'heroStart' | 'personnage' | 'prop';

/** Mappe les anciennes valeurs de kind (`pnj`/`ennemi` → `personnage`, `objet` → `prop`).
 *  Délègue à `migrateEntityKind` — source unique de la normalisation des kinds. */
export function normalizeEntityKind(k: string): EntityKind {
  return migrateEntityKind(k);
}

export interface CustomStatblock {
  name: string;
  char: Partial<Record<CharKey | 'M' | 'B', number>>;
  weaponDamage?: string; // ex. "+BF+4"
  armour?: number; // PA uniforme sur toutes localisations
  traits?: string[];
  /** Catégorie de Taille (LDB 85) — sinon dérivée du trait « Taille (X) », défaut Moyenne. */
  size?: import('../engine/size').SizeCategory;
  /** Groupes d'appartenance manuels supplémentaires (Sigmarite, Cultiste…) pour les Traits psy ciblés (LDB 21). */
  groups?: string[];
  /** Sorts connus (libellés de spells.json) — choix d'AUTEUR ; l'IA incante les Projectiles magiques. */
  spells?: string[];
  /** Compétences au FORMAT LIVRE (« Langue (Magick) 63 ») : valeur de Test FINALE → avances dérivées
   *  au spawn (valeur − Caractéristique, inverse de LDB 09). */
  skills?: string[];
  /** Talents (libellés concrets : « Magie des Arcanes (Ghur) », « Menaçant »). */
  talents?: string[];
  /** Caractéristiques aléatoires au spawn (LDB 78 : « soustrayez -10 et ajoutez 2d10 »). */
  randomChars?: boolean;
}

/** Parts monstrueuses par slot (mutant modulaire : tête/bras choisis comme un PJ).
 *  Type structurel (pas d'import rendu) ; les valeurs valides sont offertes par l'éditeur. */
export interface MonsterPartsSel {
  tete?: string;       // 'chien' | 'lezard' | 'ogive' | 'minuscule' | …
  brasG?: string;      // 'tentacule' | 'griffe' | …
  brasD?: string;
  jambes?: string;     // 'chevre' | …
  cornes?: boolean;
  queue?: boolean;
}

/** Personnalisation couleur (emplacements sémantiques ; résolus par le rig). */
export interface ColorsSel {
  peau?: string;
  cheveux?: string;
  yeux?: string; // iris
  vet1?: string; // vêtement principal
  vet2?: string; // vêtement secondaire
  cuir?: string;
  metal?: string;
  corps?: string; // pelage/robe des créatures (gabarits non-humains)
  accent?: string; // détail vif (crête, marque)
}

/** Override d'apparence (sinon seed dérivé de l'id). */
export interface EntityAppearance {
  seed?: number;
  /** Mutant modulaire : parts monstrueuses (rendu via le rig). */
  monster?: MonsterPartsSel;
  /** Personnalisation couleur (peau/cheveux/vêtements). */
  colors?: ColorsSel;
  /** Coiffure / visage épinglés (rig) : slot → index. */
  parts?: { cheveux?: number; visage?: number };
  /** Surcharges cosmétiques (sinon dérivées du seed). */
  sex?: 'M' | 'F';
  build?: number;
  /** Tenue (carrière) CHOISIE — découple l'habit du nom : un PNJ peut porter n'importe
   *  quelle tenue (Mendiant, Soldat, Skaven, Nu…). Vide = dérivée du nom/espèce. */
  career?: string;
}

export interface SceneEntity {
  id: string;
  kind: EntityKind;
  pos: { x: number; y: number };
  /** Orientation MONDE (8 directions) — éditable, projetée au rendu (project + camRot). */
  facing?: Dir8;
  label?: string;
  /** Référence au bestiaire (personnage) ou au catalogue de décor (prop, cf. PROPS). */
  ref?: string;
  /** Profil personnalisé (sinon on utilise `ref`). */
  statblock?: CustomStatblock;
  dialogueId?: string;
  /** Clé d'asset (token). */
  sprite?: string;
  /** Décor INTERACTIF (fouille/ramassage). Absent = décor pur. `effects` appliqués une fois ;
   *  `consume:true` → le décor disparaît quand pris, sinon il reste (marqué `__fouille_<id>`). */
  interact?: { effects: Effect[]; consume?: boolean };
  /** Apparence (calques) : override éditeur ; sinon auto-variée au seed de l'id. */
  appearance?: EntityAppearance;
  /** Animation d'ambiance en boucle (clé de AMBIENT_CLIPS) — rend l'entité via le rig. */
  anim?: string;
  /** Arme ÉQUIPÉE (libellé) — affichée par le rig (tenue prête si à distance). Ex. 'Arbalète'. */
  weapon?: string;
  /** Empreinte multi-cases (décor statique : charrette 2×1, épave 2×2…). Défaut 1×1.
   *  Bloque la walkability (entityBlockedAt) et porte le Couvert sur toutes ses cases. */
  foot?: { w: number; h: number };
  /** Marchand (#2) : ce PNJ ouvre un panneau d'achat/vente (référence un archétype de `state/merchants`).
   *  `settlement`/`resaleRate`/`buyMarkup` surchargent l'archétype pour cette entité (prix paramétrables :
   *  resaleRate = rachat à la vente, buyMarkup = majoration à l'achat). */
  merchant?: { archetype: string; settlement?: import('../engine/disponibilite').Settlement; resaleRate?: number; buyMarkup?: number; restockDays?: number };
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
  /** Donne un VRAI objet à stats (depuis trappings.json) à un héros (défaut : le premier).
   *  L'objet arrive NON équipé dans son inventaire — à équiper via la fiche. Champs MAGIQUES optionnels
   *  (butin/quête) : `qualities` AJOUTÉES (Atout/Défaut, ex. « De plaies atroces »), `identified:false`
   *  = qualités masquées jusqu'à Évaluation (#2), `skin` = recoloration (objet légendaire). */
  | { type: 'giveTrapping'; trapping: string; heroId?: string; qualities?: string[]; identified?: boolean; skin?: Record<string, string> }
  | { type: 'giveMoney'; gold?: number; silver?: number; brass?: number }
  /** Octroie des Points d'Expérience à TOUT le groupe (XP de session, identique pour tous). */
  | { type: 'giveXp'; amount: number }
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
      /** Nom de l'objet/outil utilisé : sa qualité d'artisanat (Pratique/Peu Fiable/Bâclé) module le Test (Phase C2a). */
      tool?: string;
      /** Groupes de l'interlocuteur (ex. « Elfe », « Mort-vivant ») : sur un Test de **Sociabilité**, un PJ
       *  qui possède Animosité/Préjugé envers ce groupe subit −20/−10 (LDB 21). Sans effet hors Sociabilité. */
      vsGroups?: string[];
      onSuccess?: Effect[];
      onFailure?: Effect[];
    }
  | { type: 'setTime'; phase: DayPhaseKey }            // « passe à l'aube/jour/…/nuit » (saut en avant, #T1c)
  | { type: 'setTime'; hour: number; minute?: number } // heure précise (saut en avant)
  /** Ouvre la boutique d'une entité marchande (par son id) — permet d'inclure le Marchand dans un
   *  dialogue (ex. choix « Montrez-moi vos marchandises »). L'entité doit porter `merchant` (#2). */
  | { type: 'openMerchant'; entityId: string }
  /** Acte de soin PAYANT d'un PNJ (médecin/guérisseur/temple — LDB 75 « Docteur en médecine », aide
   *  médicale 4-6 pistoles ; le PRIX est porté par le CHOIX de dialogue, `cost`). Le PNJ (JAMAIS dans le
   *  groupe) effectue le jet — on ouvre la MÊME modale de Guérison (le joueur voit le résultat sans
   *  pouvoir l'influencer). `act` : soin de Blessures | arrêt d'hémorragie | chirurgie (1d10+Hémorragie,
   *  LDB 10/18). `skill`/`intBonus` = compétence de Guérison du PNJ (sa fiche, éditable — rien d'inventé :
   *  le moteur applique le RAW Guérison/Chirurgie existant). `entityId` = le PNJ soigneur (son `label`
   *  donne le NOM affiché, son `id` le soigneur) → aucun nom codé en dur ; nommez-le « Frère Wilhelm »
   *  et c'est lui qui opère. Le JOUEUR choisit le héros à soigner (modale). */
  | { type: 'medicalAid'; act: 'wounds' | 'bleed' | 'surgery'; skill: number; intBonus: number; entityId?: string }
  /** Début de session (LDB 17 l.47) : chaque héros regagne tous ses Points de Chance,
   *  jusqu'à un maximum égal à son Destin actuel. Exposé dans l'éditeur (pas de hook caché). */
  | { type: 'restoreFortune' }
  /** Repos (LDB 16/18/21) : `days` journée(s) de sommeil (défaut 1, « jusqu'à l'aube ») → dissipe
   *  l'Exténué + soigne des PB (Résistance +20 → DR+BE, +BE/jour) ; avance l'horloge jusqu'à l'aube.
   *  GRATUIT en soi (on peut dormir chez soi) ; un prix éventuel (auberge) est porté par le CHOIX de
   *  dialogue (`DialogueChoice.cost`), pas par le repos. */
  | { type: 'rest'; days?: number }
  /** Repas (#T2 — auberge, hôte généreux…) : nourrit TOUT le groupe pour la journée SANS consommer de
   *  ration — remet les compteurs/malus de Faim à zéro (LDB 18 l.417-422). Le prix éventuel (« Repas,
   *  auberge », LDB p.302) est porté par le CHOIX de dialogue (`DialogueChoice.cost`), pas par l'effet. */
  | { type: 'mealParty' }
  /** Inflige le trauma « Cauchemars » (LDB 21 l.92) à un héros (défaut : le premier) après une scène
   *  marquante : chaque nuit, Test de Calme Facile (+40) ou Exténué. L'auteur l'assigne (pas inventé). */
  | { type: 'inflictNightmares'; heroId?: string }
  /** Inflige une Maladie (LDB 20) à un héros (défaut : le premier) — nourriture avariée, contact infecté,
   *  morsure… L'auteur choisit la maladie (DISEASE_DEFS) ; incubation/durée sont tirées à la contraction. */
  | { type: 'inflictDisease'; disease: string; heroId?: string }
  | { type: 'inflictTrauma'; kind: 'dechirure' | 'fracture' | 'amputation'; severity?: 'mineur' | 'majeur'; location: import('../engine/types').HitLocation; heroId?: string }
  /** Points de Péché (LDB 40 l.30-36) : l'auteur/MJ sanctionne une infraction aux commandements du dieu
   *  d'un Bienheureux — 1 à 3 selon la gravité (l.36). Défaut : le premier héros sachant Prier. Le dé des
   *  unités d'un Test de Prière ≤ Péchés déclenche la Colère des dieux même sur Test réussi (l.45) ;
   *  chaque jet de Colère en expie 1 (l.53). */
  | { type: 'giveSin'; amount?: number; heroId?: string }
  /** Exposition à une Influence corruptrice (LDB 19 l.23-75) : Test de Résistance (Influence physique)
   *  ou de Calme (spirituelle) par MODALE ; Points de Corruption selon le niveau et le DR. Cible : héros
   *  désigné, sinon le premier vivant. Au-delà de BFM+BE : Test de Résistance ou MUTATION. */
  | { type: 'corruptionExposure'; level: 'mineure' | 'moderee' | 'majeure'; skill: 'Résistance' | 'Calme'; heroId?: string }
  /** Points de Corruption DIRECTS (LDB 19) — contact d'un artefact maudit, Sombre Pacte scénarisé…
   *  (sans Test ; pour l'exposition testée, utiliser `corruptionExposure`). */
  | { type: 'giveCorruption'; amount?: number; heroId?: string }
  /** Enseigne un sort SANS coût en PX (trouvaille de campagne : grimoire d'un maître, parchemin…).
   *  Cible : héros désigné, sinon le premier dont un Talent rend le sort apprenable. L'apprentissage
   *  PAYANT passe par l'onglet Avancement (buySpell, LDB 46 l.44-47). */
  | { type: 'learnSpell'; spell: string; heroId?: string }
  /** « Entre deux aventures » (LDB 22-23, Jalon 5) : ouvre l'interlude — Événement d100 par héros,
   *  min(3, semaines) Activités chacun, puis Argent à gaspiller et le temps passe. À poser en fin
   *  de chapitre par l'auteur de campagne. */
  | { type: 'interlude'; weeks?: number }
  | { type: 'endDialogue' };

export interface DialogueChoice {
  text: string;
  /** Condition de flag (cf. `condMet`) : un flag, `!flag`, ou plusieurs en ET (« v1,!v2 »). */
  condition?: string;
  /** Prix de l'option (service payant : auberge, péage, pot-de-vin…). Le choix est RÉPÉTABLE mais
   *  désactivé si on ne peut pas payer ; à la sélection, le montant est débité AVANT les effets. */
  cost?: { gold?: number; silver?: number; brass?: number };
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
  /** Condition de flag (cf. `condMet`) : un flag, sa négation `!flag`, ou plusieurs en ET (« v1,!v2 »). */
  condition?: string;
  effects: Effect[];
}

/** Évalue une condition de flag — SOURCE UNIQUE pour les triggers ET les choix de dialogue. Un flag
 *  (`drapeau`) ou sa négation (`!drapeau`) ; plusieurs séparés par des virgules = combinés en ET
 *  (« v1,!v2 » ⇔ `flags.v1 && !flags.v2`). Une condition vide n'est jamais passée ici (toujours vraie). */
export function condMet(cond: string, flags: Record<string, boolean>): boolean {
  return cond
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .every((c) => (c.startsWith('!') ? !flags[c.slice(1)] : !!flags[c]));
}

export interface EncounterDef {
  id: string;
  enemies: {
    ref?: string;
    statblock?: CustomStatblock;
    pos: { x: number; y: number };
    /** Apparence (mutant modulaire : parts monstrueux) → même modèle qu'en exploration. */
    appearance?: EntityAppearance;
    /** Arme équipée (libellé) → affichée par le rig en combat. */
    weapon?: string;
    /** Combat monté (LDB 14) : cet acteur est une MONTURE rideable (peut être enfourché). */
    mount?: boolean;
    /** Index (dans `enemies`) de la monture que cet acteur chevauche au spawn (pré-monté). */
    rides?: number;
    /** Camp au spawn : 'ally' pose un combattant du côté des héros (ex. monture libre prêtable au groupe). Défaut 'enemy'. */
    side?: 'enemy' | 'ally';
    /** Traits FACULTATIFS choisis (LDB 76 l.49) — chaînes ÉDITÉES (Indice/Cible complétés par l'auteur,
     *  ex. « Armure 2 », « Haine (Sigmarites) »), fusionnées aux traits fixes au spawn (créature `ref`). */
    optionals?: string[];
    /** Sorts connus (créature `ref`) — la donnée bestiaire n'en liste pas : choix d'auteur. */
    spells?: string[];
    /** Caractéristiques aléatoires au spawn (LDB 78 : −10 + 2d10, graine stable par id). */
    randomChars?: boolean;
  }[];
  /** Scène/flag déclenché à la victoire. */
  onVictory?: Effect[];
  /** Surprise (LDB 13 l.52-81) : camp pris en EMBUSCADE au début du combat. Les combattants de ce camp
   *  font un Test opposé de Perception vs la meilleure Discrétion des embusqueurs ; les vaincus gagnent
   *  l'État `Surpris`. Absent = personne n'est surpris. */
  surprise?: 'party' | 'enemies';
}

export interface Scene {
  id: string;
  nom: string;
  description: string;
  dimensions: { w: number; h: number };
  /** Décor : 'interieur' (éclairé en permanence, l'horloge ne l'assombrit pas) vs 'exterieur'
   *  (jour/nuit = horloge). Valeurs HÉRITÉES 'jour'|'nuit'|'foret' = legacy, normalisées 'exterieur'
   *  (cf. normalizeAmbiance) — gardées pour la rétro-compat des scènes existantes (#T1c). */
  ambiance?: 'interieur' | 'exterieur' | 'jour' | 'nuit' | 'foret';
  /** Météo (LDB 14 l.94-116) — orthogonal à `ambiance`. Défaut 'clair'. Pénalise le combat
   *  (brouillard/tempête/neige) ; lu par `sceneCombatModifiers`. */
  weather?: 'clair' | 'pluie' | 'brouillard' | 'neige' | 'tempete';
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
  if (entityBlockedAt(scene, x, y)) return false; // empreinte multi-cases d'un décor (foot {w,h})
  return terrainWalkable(tileAt(scene, x, y));
}

export function emptyScene(w = 20, h = 15): Scene {
  return {
    id: `scene-${Date.now()}`,
    nom: 'Nouvelle scène',
    description: '',
    dimensions: { w, h },
    ambiance: 'exterieur',
    tiles: new Array(w * h).fill('herbe'),
    entities: [],
    buildings: [],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}

/** Le jour/nuit ne vient plus de la scène (il vient de l'horloge) ; `ambiance` ne distingue plus que
 *  intérieur vs extérieur. Normalise les valeurs héritées (jour/nuit/foret/undefined → exterieur). (#T1c) */
export function normalizeAmbiance(a: Scene['ambiance']): 'interieur' | 'exterieur' {
  return a === 'interieur' ? 'interieur' : 'exterieur';
}

/** Scène en intérieur (éclairée — l'obscurité de l'horloge ne s'y applique pas). */
export function isIndoor(scene: Pick<Scene, 'ambiance'>): boolean {
  return normalizeAmbiance(scene.ambiance) === 'interieur';
}
