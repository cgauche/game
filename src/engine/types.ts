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

/** Détails supplémentaires d'un héros (LDB 05 étape 6 — cosmétique, aucune règle). */
export interface HeroDetails {
  age?: number;
  /** Taille en cm. */
  height?: number;
  eyes?: string;
  hair?: string;
  /** Ambitions à court / long terme (LDB 05 l.710-717). */
  ambitionShort?: string;
  ambitionLong?: string;
}

/** Ignorance de PA — descripteur GÉNÉRAL réutilisable (armes enchantées, attributs de Domaine,
 *  Projectiles…). Un NOMBRE = N points ignorés (Perforante = 1) ; sinon une catégorie : 'all' (tous),
 *  'metal' (armures métalliques — Chamon/Azyr), 'leather' (cuir — Ghur), 'nonMagic' (tout le non
 *  magique — Ulgu). Calcul : engine/armourBypass.bypassedAP. */
export type ArmourBypass = number | 'all' | 'metal' | 'leather' | 'nonMagic';

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
  /** Nombre de mains requises (1 ou 2). Dérivé de `(2M)` / arc / arbalète. */
  hands?: 1 | 2;
  /** Main qui tient l'arme dans le loadout actif ('off' → pénalité de main secondaire). */
  hand?: 'main' | 'off';
  /** uid de l'ItemInstance source (loadout) — pour matcher un choix d'arme. Absent : Mains nues/Crochet. */
  uid?: string;
  /** Rechargement : Indice DR à cumuler (Test étendu de Projectiles) ; 0 = aucun, tire chaque Round. */
  reload?: number;
  /** Ignorance de PA de l'arme (Épée de justice → 'all', etc.) — fusionnée par `enchantedWeapon`,
   *  lue par `woundsFromHit` (engine/armourBypass). */
  bypass?: ArmourBypass;
  /** Dégâts subis par l'arme (LDB 62 l.178) : réduit les Dégâts de 1/point ; à +0 → improvisée. */
  damageTaken?: number;
  /** Arme détruite (Incident de Tir, LDB 14) : inutilisable. */
  destroyed?: boolean;
  /** SKIN cosmétique (objets uniques/légendaires) : override de palette token→hex appliqué au
   *  rendu de l'arme (ex. { metal:'#caa64a' } → lame dorée). Données opaques côté moteur. */
  skin?: Record<string, string>;
  /** Silhouette de RENDU forcée (libellé d'arme du catalogue, ex. arme invoquée affichée comme
   *  « Bâton de combat » bien que nommée « Arme aethyrique ») — résolue par le rig (weaponFamily).
   *  Donnée opaque côté moteur (un simple libellé). */
  form?: string;
}

/** Points d'Armure par localisation. */
export type ArmourPoints = Record<HitLocation, number>;

export interface ConditionInstance {
  name: string;
  value: number; // certains États s'empilent (ex. Hémorragique)
  /** Source de l'État (id du Combatant) — pour le Test opposé de « se libérer » d'un Empêtré (LDB 16 l.61). */
  sourceId?: string;
  /** Force d'évasion FIGÉE d'un État à Test opposé (Empêtré « se libérer » — LDB 16 l.61) : posée par
   *  l'op `condition.escapeStrength` (ex. Force Mentale du lanceur d'un Enchevêtrement). Si présente, le
   *  flux de récupération l'oppose AU LIEU de la Force de la source vivante — vaut même lanceur absent. */
  escapeStrength?: number;
  /** Durée en Rounds d'un État posé par un SORT (« 1 État Sonné qui dure 1d10 Rounds ») —
   *  décrémenté en fin de Round, l'État se dissipe à 0. Un ajout NON temporisé du même État
   *  efface la durée (l'État redevient régi par ses règles normales — on n'écourte jamais). */
  roundsLeft?: number;
}

/** Pénalité/blocage d'incantation temporisé (contrecoups des tables d'Imparfaites /
 *  Colère des dieux — LDB 46 l.61-136, LDB 40 l.58-138). Une seule des deux durées :
 *  `roundsLeft` (échelle tactique) ou `untilTime` (minutes d'horloge `gameTime`). */
export interface CastPenalty {
  label: string;
  /** Compétence visée ; 'all' = toute magie (Prière + Langue + Focalisation). */
  skill: 'Prière' | 'Langue' | 'Focalisation' | 'all';
  /** Modificateur (négatif) à la valeur de Test (« Langue maladroite −10 »). */
  mod?: number;
  /** Tests interdits (« Vous abusez de ma patience », « Propos ésotériques »…). */
  blocked?: boolean;
  /** « Pensez à vos actes » : tout Test de Prière réussi est plafonné à 0 DR. */
  maxZeroDR?: boolean;
  roundsLeft?: number;
  untilTime?: number;
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
  /** Échéance d'HORLOGE (minutes `gameTime`) d'un buff à durée en minutes/heures/jours (LDB 47 —
   *  « (Bonus de FM) heures », « Jusqu'au lever du soleil »…) : purgé par la cascade #T3
   *  (`purgeClockEffects`) ; `roundsLeft` reste à COMBAT_PERSIST en attendant. */
  untilTime?: number;
  /** Ops RÉCURRENTES re-jouées à CHAQUE fin de Round tant que l'effet dure (op `perRound` — sorts
   *  multi-Rounds : 1 État X par Round, 1 Ration par Round de « Récolte de Rhya », etc.). Les valeurs
   *  sont déjà résolues à l'incantation (littérales) — `endOfRound` les ré-applique via `applyOps`
   *  sans avoir besoin du lanceur. La durée (donc le nombre de répétitions) suit `roundsLeft`, qui
   *  intègre la Surincantation de Durée (LDB 47). */
  opsPerRound?: import('./ops').GameOp[];
  /** PA temporisés à TOUTES les localisations (Armure Aethyrique : « +1 PA à toutes les
   *  Localisations ») — lus par effectiveArmourAt à la mitigation des Dégâts. */
  apAll?: number;
  /** Trait de créature ACCORDÉ par cet effet (op `grantTrait` — Envol, Effrayant…) : la chaîne
   *  exacte posée dans `c.traits`, retirée (une instance) à l'expiration (engine/grantedTraits). */
  grantedTrait?: string;
  /** Arme INVOQUÉE temporaire (op `conjureWeapon` — Arme aethyrique, Faux de Shyish, Épée ardente) :
   *  l'objet `conjured` est posé dans un SET d'armes DÉDIÉ (réutilise le système de loadouts) rendu
   *  actif. À l'expiration, `dropExpiredGrantedWeapons` retire l'objet ET le set, et réactive le set
   *  d'origine (`restoreLoadoutId`). Pas d'arme synthétique ni d'injection parallèle. */
  conjuredSet?: { itemUid: string; loadoutId: string; restoreLoadoutId?: string };
  /** Arme NATURELLE accordée par un Sort (Dent et griffe : Morsure/Arme ; Incarnation de Wyssan) —
   *  attaque ADDITIONNELLE injectée dans `c.weapons` par recomputeLoadout (même patron que Tentacule/
   *  Cornes), retirée à l'expiration. Dégâts SB-relatifs (« +BF+N ») et Atouts portés par l'arme. */
  naturalWeapon?: Weapon;
  /** Talent ACCORDÉ par cet effet (op `grantTalent` — Flambeau de Vertu : Sans peur…) : lu par
   *  `combatFeatures/dispatch.featuresOf` tant que l'effet dure (PAS posé dans `c.talents` —
   *  la fiche/avancement ne voient que les talents possédés). */
  grantedTalent?: string;
  /** Enchantement d'ARME temporisé (op `enchantWeapon` — B. de Droiture, Marteau ardent, Épée
   *  ardente de Rhuin, Arme aethyrique) : porté par le PORTEUR (pas l'objet — `recomputeLoadout`
   *  l'écraserait), fusionné à l'arme au moment de la résolution (`enchantedWeapon`). */
  weaponEnchant?: {
    /** Atouts ajoutés (« Magique » → touche l'Éthéré ; « Percutante »…). */
    addQualities?: string[];
    /** Dégâts supplémentaires (Marteau ardent : +BSoc ; Épée ardente : +6). */
    damageBonus?: number;
    /** Ignorance de PA conférée à l'arme (Épée de justice → 'all') — descripteur général ArmourBypass. */
    bypass?: ArmourBypass;
    /** L'enchantement ne s'applique QUE si l'arme tenue matche cette famille (mot-clé sur nom/sous-type :
     *  « épée », « hache », « lance ») — Épée de justice / Morsure de l'hiver / Lance de Myrmidia. */
    requiresWeapon?: string;
    /** États infligés à TOUTE cible frappée (Marteau ardent : En flammes + À Terre), sans Test.
     *  `onlyGroups` : ne s'applique qu'aux cibles d'un Groupe (engine/groups). */
    onHitConditions?: { name: string; value?: number; onlyGroups?: string[] }[];
    /** Test à la touche GATÉ par Groupe (système de Groupes — auteur-marqué) : une cible du/des
     *  `onlyGroups` (ou hors `exceptGroups`) effectue un Test ; sur ÉCHEC elle gagne `onFail`.
     *  Épée de justice : un « Criminel » frappé teste Résistance (+20) ou tombe Inconscient ;
     *  Morsure de l'hiver : une cible « vivante » (hors Mort-vivant/Démon) teste ou gagne Sonné. */
    onHitTest?: { onlyGroups?: string[]; exceptGroups?: string[]; skill: string; difficulty: Difficulty; onFail: { name: string; value?: number }[] };
  };
  /** « Peut relancer le prochain Test auquel elle échoue » (Bénédiction de Chance, LDB 41) —
   *  consommé à l'usage au point de relance des flux de jet (engine/activeFlags). */
  freeReroll?: boolean;
  /** « Deux lancers, choisissez le meilleur » quand le PORTEUR inflige une Blessure Critique
   *  (Bénédiction de Sauvagerie, LDB 41) — lu par rollCritical via l'attaquant. */
  critRollTwice?: boolean;
  /** « Ne subit aucune pénalité causée par les États » (Endurance de l'anachorète, LDB 42) —
   *  lu par combatTestPenalty/testStatePenalty. */
  ignoreStatePenalties?: boolean;
  /** Traits psychologiques SUSPENDUS par l'effet (Baume pour un esprit blessé, LDB 42 : « Tous les
   *  Traits Psychologiques sont retirés pour la durée ») — restitués à l'expiration (rounds OU horloge). */
  suppressedPsych?: import('./psychology').PsychTrait[];
  /** Aura « N'écoutez point la Sorcière » (LDB 42) : tout SORT (Langue (Magick)) ciblant quelqu'un
   *  à `radiusMeters` du porteur subit −20 au Test d'incantation. */
  castWard?: { radiusMeters: number };
  /** Le porteur SUFFOQUE (Noyade et Suffocation, LDB 18 l.424-425 — Ombres étrangleuses,
   *  Transmutation de Chamon) : −1 PB/Round, 0 PB → Inconscient, mort après BE Rounds. */
  suffocates?: boolean;
  /** « N'a pas besoin de respirer et ignore les règles de suffocation » (B. de Souffle, LDB 41). */
  noBreath?: boolean;
  /** « N'a pas besoin de manger ou de boire » (Graisse de la terre, LDB 48) : exempte de la Faim —
   *  `dailyFoodUpkeep` saute la consommation de ration et l'aggravation tant que l'effet dure. */
  noHunger?: boolean;
  /** Modificateur GLOBAL à TOUS les Tests du porteur (Malédiction de malchance : −10 ; bénédictions
   *  futures : +N) — STACKE par-dessus la pénalité d'État (≠ État, donc non soumis au non-cumul ni à
   *  `ignoreStatePenalties`). Lu par `combatTestPenalty`/`testStatePenalty` (engine/conditions). */
  testMod?: number;
  /** Immunité à l'EXPOSITION météo (froid/pluie/neige/tempête — Peau de loup d'hiver d'Ulric,
   *  Protection contre la pluie) : `exposureNight` est sauté tant que l'effet dure. */
  weatherImmune?: boolean;
  /** Bouclier anti-flèches (LDB 47 — L11) : les projectiles ORGANIQUES (flèches, carreaux,
   *  javelots) entrant dans la zone de `radiusMeters` autour du porteur sont détruits. */
  arrowWard?: { radiusMeters: number };
  /** Dôme (LDB 47 — L11) : quiconque dans la zone gagne Protection (6+) contre les attaques
   *  magiques ou à distance provenant de l'EXTÉRIEUR du dôme. */
  domeWard?: { radiusMeters: number };
  /** Bénédiction de Protection (LDB 41 — L13) : « Les ennemis doivent effectuer un Test de FM
   *  Accessible (+20) pour attaquer votre cible. Sur un échec, ils doivent choisir une cible ou
   *  une Action différente. » — Test joué à la DÉCLARATION d'attaque (rien n'est consommé). */
  attackWardFM?: boolean;
  /** Martyr (LDB 42 — L13) : « Vous recevez tous les Dégâts subis en principe par vos cibles »
   *  — id du PRÊTRE qui encaisse à la place du porteur (BE doublé pour ces Dégâts). */
  martyrGuard?: string;
  /** Points de Chance ACCORDÉS temporairement par un Sort (op `gainFortune` — Signes d'Amul,
   *  Maître du Destin) : les points NON dépensés sont retirés à l'expiration de l'effet (rounds OU
   *  horloge), via `dropExpiredGrantedResources` (engine/grantedResources). */
  grantedFortune?: number;
  /** Points de Destin ACCORDÉS temporairement par un Sort (op `gainFate` — Troisième Signe d'Amul) :
   *  retirés à l'expiration s'ils n'ont pas été dépensés (cf. `grantedFortune`). */
  grantedFate?: number;
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
  /** Pénalité (négative) à une Compétence nommée (clé minuscule, ex. « langue ») — séquelle de fracture à la
   *  Tête (−5/−10 aux Tests de Langue, LDB 18 l.300/309). Lue par `testValue`. */
  skillPenalty?: Record<string, number>;
  note: string;
  /** Jours de convalescence restants (LDB 18 : déchirure 30−BE, fracture 30+1d10…). Décompté au repos ;
   *  à 0 le trauma (et ses pénalités) disparaît. Absent = trauma legacy/permanent (pas de décompte). */
  recoveryDays?: number;
  /** Durée totale de convalescence (à la création) — seuils : mi-durée d'une déchirure majeure (downgrade
   *  −20→−10, l.326), fenêtre de pose d'une semaine d'une fracture (l.302). */
  recoveryTotal?: number;
  /** Type / sévérité, pour la convalescence à étapes (déchirure : Guérison accélère ; fracture : Test de fin). */
  kind?: 'dechirure' | 'fracture';
  severity?: 'mineur' | 'majeur';
  /** La Compétence Guérison a déjà été EMPLOYÉE sur ce trauma — succès (l.317 : −1 j −1/DR, une
   *  seule fois) comme échec : le jet est consommé, on ne relance pas jusqu'au succès. */
  healAccelerated?: boolean;
  /** Fracture « réduite » : bandée par un Test de Guérison dans la semaine (l.302) → pas de Test de Résistance de fin. */
  fractureSet?: boolean;
  /** Trauma exigeant de la CHIRURGIE pour guérir (amputation, fracture majeure « peu probable sans
   *  intervention médicale », LDB 18 l.305/398) — traité par le Talent Chirurgie, pas par le simple repos. */
  needsSurgery?: boolean;
  /** Prothèses (LDB 73) qui annulent la séquelle permanente d'une amputation TANT QUE l'objet est porté
   *  (dans `items`). `cancels: 'all'` annule toute la pénalité (Merveille d'ingénierie : « ignorer
   *  complètement la perte… d'une jambe » ; Nez doré ; Œil de verre…) ; `'movement'` rétablit le déplacement
   *  seul (Fausse jambe : « ignorer 1 Point de Mouvement perdu » — l'Esquive demande 200 PX, non modélisé). */
  prosthesis?: { name: string; cancels: 'all' | 'movement' }[];
  /** Main/bras amputé (LDB 18 l.352/335) : interdit le port d'une arme à DEUX mains. Levé par une prothèse
   *  `cancels:'all'` (Merveille d'ingénierie). */
  noTwoHanded?: boolean;
  /** Nombre d'éléments perdus pour une séquelle CUMULATIVE par comptage (LDB 18) : doigts (−5/doigt, 4+ →
   *  règle de la main, l.341/344) ou dents (−1 Soc/paire, l.338). Fusionné à chaque nouvelle perte. */
  count?: number;
  /** Organe sensoriel PAIRÉ perdu (LDB 18) : 2 pertes du même sens → escalade (Cécité/Surdité). Porté
   *  par la séquelle « Œil perdu » / « Oreille perdue » pour que `escalateSensoryLoss` compte par sens,
   *  sans name-match sur le libellé. */
  sense?: 'vue' | 'ouie';
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
  /** Nombre de mains requises (1 ou 2), posé à la création par itemFromTrapping (marqueur `(2M)`). */
  hands?: 1 | 2;
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
  /** Aura magique DÉTECTÉE (Talent Détection d'artefact, LDB 10 l.310-312 : « vous sentez que
   *  l'objet est magique ») — s'affiche ✨ magique même tant que ses règles restent non identifiées. */
  magicKnown?: boolean;
  /** Détection d'artefact déjà tentée sur cet objet (LDB 10 l.312 : « En principe, vous ne pouvez
   *  tenter ce Test qu'une seule fois par artefact touché »). */
  detectTried?: boolean;
  /** Jour de jeu de la dernière Évaluation RATÉE : pas de re-tentative le même jour (anti-spam —
   *  LDB 12 l.120 : seul un résultat marginal offre un nouvel essai ; ADE2 : re-tenter coûte du temps). */
  appraiseTriedDay?: number;
  /** FAUSSES Particularités soupçonnées (ADE2 ch.4 : échec Impressionnant/Stupéfiant de
   *  l'identification — « soupçonne que l'objet possède une Particularité qu'il n'a pas
   *  réellement »). Affichées « soupçonné : … » tant que l'objet n'est pas identifié ; purgées
   *  par une vraie révélation. AUCUN effet mécanique. */
  suspectedQualities?: string[];
  /** Prothèse ENTRAÎNÉE par dépense de PX (LDB 73) : une Fausse jambe « réapprise » (200 PX) annule AUSSI
   *  l'Esquive (sa séquelle passe de `'movement'` à `'all'`), pas seulement le déplacement. */
  prosthesisTrained?: boolean;
  /** Arme INVOQUÉE temporaire (op `conjureWeapon`) : objet ordinaire mais TENU d'office (injecté en
   *  tête de `c.weapons` par recomputeLoadout) et retiré à l'expiration du Sort. */
  conjured?: boolean;
  /** Silhouette de RENDU forcée (libellé d'arme du catalogue) — propagée à `Weapon.form`. */
  form?: string;
}

/** Set d'armes nommé (les 2 mains). `off` ignoré si l'arme `main` est à 2 mains. uids → ItemInstance. */
export interface WeaponLoadout {
  id: string;
  name: string;
  main?: string;
  off?: string;
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
  /** Traits de créature (STRUCTURÉS — `TraitInstance` : key/value/arg/count/range) → attaques
   *  naturelles gratuites & règles dérivées (Morsure, Attaque caudale, Souffle… cf.
   *  engine/creatureAttacks). Lus sans parsing via `resolveTraits`/`asTrait`. Conservés au spawn.
   *  Union transitoire : les chaînes legacy/test restent acceptées (normalisées par `asTrait`). */
  traits?: import('./statEntry').TraitList;
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
  /** Trait Tentacules (LDB 85 l.354, mutation Tentacule épais) : l'Attaque gratuite de tentacule
   *  de ce Tour a-t-elle été jouée ? (héros — réinitialisée en fin de tour.) */
  tentacleUsedThisTurn?: boolean;
  /** Dissipation (LDB 46 l.201-202 : « un seul Sort chaque Round ») — Contre-sort déjà tenté ce Round. */
  dispelledThisRound?: boolean;
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
  /** Sets d'armes du héros (les ennemis n'en ont pas → chemin legacy = toutes armes équipées). */
  loadouts?: WeaponLoadout[];
  activeLoadoutId?: string;
  /** Sorts/prières connus (libellés référençant src/data/spells.json). */
  spells?: string[];
  /** Points de Péché (LDB 40 l.30-36) — Bienheureux ayant violé les commandements de
   *  son dieu. Octroyés par le MJ/l'auteur (Effet `giveSin`), jamais inventés ; pas de
   *  maximum ; chaque jet de Colère des dieux en retire 1 (l.53). Persisté entre combats. */
  sinPoints?: number;
  /** Effets magiques actifs et temporisés (buffs de Bénédiction/Sort). */
  activeEffects?: ActiveEffect[];
  /** Pénalités/blocages d'incantation temporisés (contrecoups des tables d'Imparfaites/Colère,
   *  LDB 46/40) : « Langue maladroite −10 », « pas de Test de Prière N Rounds », « DR de Prière
   *  plafonné à 0 une semaine »… `roundsLeft` décrémenté en fin de Round (combat + entretien hors
   *  combat) ; `untilTime` purgé par l'horloge (advanceTime). Persisté. */
  castPenalties?: CastPenalty[];
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
  /** Signe astral (« Naissance sous les Étoiles », ADE2) — libellé du signe ; flavor. */
  star?: string;
  /** Détails supplémentaires (âge, taille, yeux, cheveux, ambitions — LDB 05 étape 6). */
  details?: HeroDetails;
  // Traumatisme (LDB 18) — modèle de mort
  /** Nombre de Blessures critiques cumulées (mort si > Bonus d'Endurance + Inconscient + 0 PB). */
  criticalWounds?: number;
  /** A subi ≥1 Blessure critique DANS le combat courant (transitoire) — déclenche en fin de combat le Test
   *  de Résistance Très Facile (+60) « ou Infection Mineure » (LDB 20 l.72). Remis à zéro au prochain combat. */
  tookCriticalThisFight?: boolean;
  /** La blessure a été PANSÉE (matériel stérile / pansement) DANS le combat courant — un soin de Guérison
   *  réussi ou un bandage suffit : « aucune Infection ne se développera suite à la blessure » (LDB 09 /
   *  18 l.382). Empêche la contraction d'Infection Mineure en fin de combat. Transitoire (par rencontre). */
  woundDressed?: boolean;
  /** Traumatismes subis (LDB 18) — persistants ; effets en-combat lus par effectiveChar/effectiveMovement. */
  traumas?: Trauma[];
  /** Points de Corruption (LDB 19) — dérive de l'âme vers le Chaos. Gagnés par expositions/
   *  Sombres Pactes/contrecoups magiques ; au-delà de BFM+BE, chaque gain impose un Test de
   *  Résistance ou MUTATION. Persisté. */
  corruption?: number;
  /** Mutations subies (LDB 19, Tableaux p.184-185) — DONNÉE persistée ; les effets (caracs
   *  permanentes, Mouvement, PA naturels, mods de Tests, Traits) sont lus à la volée. */
  mutations?: import('./corruption').Mutation[];
  /** Damné (LDB 19 l.95) : plus de mutations physiques que BE ou mentales que BFM — l'âme
   *  appartient aux Dieux Sombres. Hors-jeu définitif (traité comme mort, affiché « Damné »). */
  damned?: boolean;
  /** Trauma psychologique « Cauchemars » (LDB 21 l.92) : chaque nuit, Test de Calme Facile (+40) ou
   *  Exténué. Posé par l'Effet d'éditeur `inflictNightmares` (assigné par l'auteur, jamais inventé). */
  nightmares?: boolean;
  /** Maladies et infections en cours (LDB 20) — incubation/durée décomptées au repos ; symptômes lus par
   *  `diseaseCharPenalties` (fièvre) / `rest.ts` (malaise→Exténué, blessé bloque la guérison). */
  diseases?: import('./disease').Disease[];
  /** Faim (LDB 18 l.417-422) : jours sans manger, Tests tentés (−10 cumulatif), échecs (malus de
   *  caracs lus par `hungerCharPenalties`). Absent = nourri. Entretien quotidien : `dailyFoodUpkeep`. */
  hunger?: import('./provisions').HungerState;
  /** Immunités acquises (Vérole Urticante guérie — LDB 20 l.97) : maladies inattrapables à nouveau. */
  diseaseImmunities?: string[];
  /** Blessé pendant CE combat par une créature au Trait Infecté → Test post-combat de Résistance
   *  Facile (+40) ou Blessure Purulente (LDB 20 l.32) ; rongeur Infecté → aussi Fièvre du Rongeur (+20, l.49). */
  woundedByInfected?: boolean;
  woundedByRodent?: boolean;
  /** Maladies (Trait « Maladie (Type) ») auxquelles ce combattant a été EXPOSÉ pendant le combat
   *  (blessé par la créature porteuse) → Tests de Contraction post-combat (LDB 85 p.340 / LDB 20). */
  diseaseExposure?: string[];
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
  /** Suffocation (LDB 18 l.425) : Rounds restants avant la MORT une fois Inconscient à 0 PB
   *  en suffoquant (posé à BE, décrémenté par Round de suffocation continue ; 0 → mort). */
  suffocationCountdown?: number;
  /** Attribut de Shyish (LDB 48 l.400) : « Une cible ne peut avoir qu'un seul État Exténué gagné
   *  de cette façon à la fois » — marqueur posé au premier Exténué d'un Sort de la Mort. */
  shyishExhausted?: boolean;
  /** A déjà bénéficié d'un soin de Blessures (Guérison) cette rencontre (LDB 09-Compétences l.233).
   *  Réinitialisé au début de chaque combat (startCombat). N'affecte PAS l'arrêt d'Hémorragie. */
  soinRencontreUtilise?: boolean;
  /** Mort (résultat létal ou mort lente). Hors de combat définitif. */
  dead?: boolean;
  /** PNJ important : utilise le système complet de critiques au lieu de la Mort Subite. */
  important?: boolean;
  /** « Meurs un autre jour » (Destin) : éjecté de la rencontre — vivant mais hors de combat. */
  outOfRencontre?: boolean;
  /** Combattant INVOQUÉ par un Sort (champ `SpellSpec.summon` — Nécromancie, Hurlement du loup,
   *  Manifestation de démon…) : `byId` = le lanceur ; `expiresAtRound` = la créature se dissipe au
   *  franchissement de Round une fois ce numéro dépassé ; `despawnIfSummonerDown` = elle s'effondre
   *  si le lanceur est hors de combat (minions de Nécromancie liés au sorcier). Géré par state/summonFlow. */
  summon?: { byId: string; expiresAtRound?: number; despawnIfSummonerDown?: boolean; label?: string };
  // NB : `ammoUid`/`loaded`/`reloadProgress` sont au niveau du combattant, pas de l'arme. Le modèle
  // suppose UNE arme à distance équipée à la fois (le tir et le rechargement ciblent la 1re `ranged`
  // via `attackWeapon`/`battleReload`). À porter sur l'arme si on autorise un jour 2 armes à distance.
  /** Munition sélectionnée pour l'arme à distance (uid d'un ItemInstance `kind 'ammo'`). */
  ammoUid?: string;
  /** Arme à distance chargée ? (Arc : toujours ; Recharge N : faux après un tir). */
  loaded?: boolean;
  /** DR cumulés du Test étendu de Projectiles vers `Weapon.reload` (Indice DR), pas un compteur d'Actions. */
  reloadProgress?: number;
  /** À Répétition (Indice) (LDB 62 l.264-265) : munitions restantes dans le chargeur de l'arme à
   *  distance équipée (auto-rechargées entre les coups) ; undefined = pas de chargeur / vide. */
  chambered?: number;
  /** Salve (Aux Armes p.126) : nombre de tirs DÉJÀ effectués ce tour (réinit. au changement de tour) ;
   *  chaque tir suivant d'une arme à Salve subit −10 cumulatif (lu par `attackModifiers`). */
  shotsThisTurn?: number;
  /** Perturbante (LDB 62 l.275-276) : mode « Repousser » armé — la prochaine attaque réussie repousse
   *  d'1 m par DR au lieu de causer des Dégâts. Consommé par l'attaque (héros uniquement). */
  pushbackMode?: boolean;
  /** Dans l'aura d'une créature Perturbante (LDB 85 p.341) : −20 à tous les Tests — recalculé
   *  à chaque franchissement de Round par combatFlow. */
  perturbed?: boolean;
  // Avancement par Points d'Expérience (héros uniquement, LDB Carrières)
  /** PX disponibles à dépenser. */
  xp?: number;
  /** Augmentations de Caractéristique DÉJÀ achetées par caractéristique (≠ valeur courante :
   *  sert au coût de la prochaine Augmentation, qui dépend du nombre déjà acheté, l.69). */
  charAdvances?: Partial<Record<CharKey, number>>;
  /** Niveau de Carrière courant (défaut 1) — détermine le schéma in-carrière pour le coût. */
  careerLevel?: number;
  /** Désignations des emplacements « (Au choix) » des carrières (LDB 09 l.38 : la Spécialisation
   *  se choisit à l'allocation). Par carrière : slotKey → libellé concret (« Sens aiguisé (Ouïe) »).
   *  Deux slots d'une même carrière ne désignent jamais le même libellé ; les désignations sont
   *  PAR carrière (un changement de carrière rouvre les choix). Cf. engine/careerSlots.ts. */
  careerSlotChoices?: Record<string, Record<string, string>>;
  // Combat tactique (grille)
  pos?: { x: number; y: number };
  initiative?: number;
  /** A gagné de l'Avantage durant le Round courant (upkeep de fin de Round, LDB Dépl. l.40). */
  gainedAdvThisRound?: boolean;
  /** « Sur la défensive » : +20 à tous les Tests de défense jusqu'au début du prochain tour (LDB Combat l.118). */
  defensiveStance?: boolean;
  /** Maniement de deux armes (LDB 10 l.638) : −10 à TOUTES ses défenses jusqu'au début de son prochain Tour. */
  dualStrikeDefensePenalty?: boolean;
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

/** Spec d'un Test de Résistance d'entretien DIFFÉRÉ (cascade de nuit influençable) : le moteur le
 *  COLLECTE au lieu de le rouler (`state/upkeep` calcule la cible et en fait une étape de cascade,
 *  résolue par l'applicateur de `kind`). Garde l'invariante « si y'a un jet, y'a une étape ». */
export type UpkeepDeferTest = (spec: {
  kind: string;
  label: string;
  base: number;
  difficulty: Difficulty;
  penalty?: number;
  meta?: Record<string, number | string | boolean>;
}) => void;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  tresFacile: 'Très facile (+60)',
  facile: 'Facile (+40)',
  accessible: 'Accessible (+20)',
  intermediaire: 'Intermédiaire (+0)',
  complexe: 'Complexe (−10)',
  difficile: 'Difficile (−20)',
  tresDifficile: 'Très difficile (−30)',
};
