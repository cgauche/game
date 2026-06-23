/** Types partagés du moteur de règles WFRP v4. */
import { t } from '../i18n';
import type { Duration } from './duration';

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

// Libellés FR dérivés du catalogue i18n (source unique des textes — cf. docs/i18n-seam.md).
export const CHAR_LABELS: Record<CharKey, string> = {
  CC: t('char.CC'),
  CT: t('char.CT'),
  F: t('char.F'),
  E: t('char.E'),
  I: t('char.I'),
  Ag: t('char.Ag'),
  Dex: t('char.Dex'),
  Int: t('char.Int'),
  FM: t('char.FM'),
  Soc: t('char.Soc'),
};

export type Characteristics = Record<CharKey, number>;

/** Inverse de CHAR_LABELS : nom français complet → abréviation (pour les compétences). */
export const CHAR_BY_LABEL: Record<string, CharKey> = Object.fromEntries(
  (Object.entries(CHAR_LABELS) as [CharKey, string][]).map(([k, v]) => [v, k]),
) as Record<string, CharKey>;

/** Localisations d'impact (Tableau de Localisation, Livre de base p. 159). */
export type HitLocation = 'tete' | 'brasG' | 'brasD' | 'corps' | 'jambeG' | 'jambeD';

export const HIT_LOCATION_LABELS: Record<HitLocation, string> = {
  tete: t('hitloc.tete'),
  brasG: t('hitloc.brasG'),
  brasD: t('hitloc.brasD'),
  corps: t('hitloc.corps'),
  jambeG: t('hitloc.jambeG'),
  jambeD: t('hitloc.jambeD'),
};

/**
 * Forme du corps d'une créature, pour la LOCALISATION d'impact (LDB « Point d'Impact des Créatures »
 * p.312). Humanoïde/quadrupède/oiseau partagent le Tableau humanoïde (p.159) — seules les ÉTIQUETTES
 * changent (quadrupède : membres antérieurs/postérieurs ; oiseau : ailes) et les Tableaux de Critiques
 * sont les mêmes. Serpent & araignée utilisent les « Localisations Alternatives » (p.312).
 */
export type BodyShape = 'humanoide' | 'quadrupede' | 'oiseau' | 'serpent' | 'araignee' | 'vehicule';

/** Étiquettes de localisation propres à une forme (surchargent HIT_LOCATION_LABELS ; LDB p.312).
 *  `vehicule` (véhicule/embarcation à coque — EDOC ch.4, MoR ch.5, MDG ch.13) : ses localisations
 *  (coque/gréement/roues/avirons…) sont PILOTÉES PAR DONNÉES (table par véhicule, branchée plus tard),
 *  donc aucune étiquette en dur ici. */
export const BODY_SHAPE_LOC_LABELS: Record<BodyShape, Partial<Record<HitLocation, string>>> = {
  humanoide: {},
  quadrupede: { brasG: t('hitloc.quadrupede.brasG'), brasD: t('hitloc.quadrupede.brasD'), jambeG: t('hitloc.quadrupede.jambeG'), jambeD: t('hitloc.quadrupede.jambeD') },
  oiseau: { brasG: t('hitloc.oiseau.brasG'), brasD: t('hitloc.oiseau.brasD'), jambeG: t('hitloc.oiseau.jambeG'), jambeD: t('hitloc.oiseau.jambeD') },
  serpent: {}, // n'expose que Tête / Corps
  araignee: { jambeD: t('hitloc.araignee.jambeD'), corps: t('hitloc.araignee.corps') }, // n'expose que Tête / Pattes / Abdomen
  vehicule: {}, // localisations data-driven (coque/gréement/…)
};

/** Disponibilité d'un objet/équipement (LDB 59 « Disponibilité ») — FOYER UNIQUE du concept :
 *  Test de Disponibilité au marché (`disponibilite`), Difficulté d'Artisanat (`activities`),
 *  décalage par qualité (`craftEconomy`). `HarvestRarity` l'étend de `'Unique'` (récolte/trophées). */
export type Availability = 'Commune' | 'Limitée' | 'Rare' | 'Exotique';

/** Propulsion d'un véhicule/embarcation — pilote la table de localisation des dégâts (terre : roues/
 *  attelage ; fleuve/mer : voiles/avirons/coque). EDOC ch.4 (terrestre), MoR ch.5 (fluvial), MDG ch.13 (maritime). */
export type Propulsion = 'terrestre' | 'fluvial' | 'maritime';

/** Classe de voyage payant d'un véhicule : prix RAW en sous (PA) par km ET par passager (LDB l.207-219). */
export interface VehicleTravelClass { key: string; label: string; brassPerKm: number; }

/**
 * Véhicule / embarcation à coque — FOYER UNIQUE de la donnée (`src/data/vehicles.json`), data-driven.
 * Le même enregistrement porte TROIS facettes indépendantes (fin des doublons transports/trappings) :
 *  - `purchase` : achat (prix + disponibilité), lu par le marché ;
 *  - `travel` : passage payant (Déplacement km/h + classes), lu par `engine/travel` ;
 *  - `hull` : profil type-créature (Endurance + Blessures + forme + propulsion), permettant au véhicule
 *    de devenir un `Combatant` qui encaisse des dégâts (incidents EDOC, Critiques MoR/MDG).
 * Une monture, elle, reste une CRÉATURE (`creatures.json` → `Combatant`) ; ce type ne couvre que les
 * coques inertes (chariots, barges, navires).
 */
export interface VehicleData {
  /** id STABLE (slug) — cible de `TravelMode`/réfs de scène. */
  id: string;
  label: string;
  /** Pictogramme d'affichage (sélecteur de mode de voyage, carte) — donnée, pas de ternaire par id en dur. */
  icon?: string;
  source?: { book: string; page: number };
  /** Encombrement de l'objet véhicule (LDB 61) — généralement `null` (on ne porte pas une diligence) ;
   *  un coracle se porte (`enc` chiffré). Lu par `itemFromVehicleById` pour l'`ItemInstance` d'inventaire. */
  enc?: number | null;
  /** Description (LDB) — reprise sur l'`ItemInstance` à l'achat/possession. */
  desc?: string;
  /** Facette ACHAT (marché / possession de carrière). `availability` absent pour les navires (MDG ne
   *  donne pas de Disponibilité). */
  purchase?: { price: { gold: number; silver: number; bronze: number }; availability?: string };
  /** Facette VOYAGE (passage payant). `movement` = Déplacement du véhicule (km/h). */
  travel?: { movement: number; classes: VehicleTravelClass[] };
  /** Facette COQUE (entité à PV). `char.E` = Endurance, `char.B` = Blessures. `bodyShape` = 'vehicule'.
   *  `rig` = gréement (avirons/voile/mixte) → colonne de Localisation des Dégâts (MDG ch.13).
   *  `locationTable`/`criticalTable` = réfs de tables data-driven (branchées aux dalles fluvial/maritime). */
  hull?: {
    char: { E: number; B: number };
    bodyShape: 'vehicule';
    propulsion: Propulsion;
    rig?: 'avirons' | 'voile' | 'mixte';
    traits?: { id: string; value?: number; arg?: string }[];
    locationTable?: string | null;
    criticalTable?: string | null;
  };
  /** Facette NAVIRE (profil naval MDG ch.12) : caractéristiques de navigation/équipage du vaisseau.
   *  `manoeuvre` = modificateur de DR (Man) ; `sail`/`oars` = Mouvement (M) + équipage minimum (É) ;
   *  `lengthM` = Taille (longueur, m) ; `capacity` = Contenance ; `traits` = Traits & Améliorations (verbatim). */
  ship?: {
    crew: number;
    manoeuvre: number;
    lengthM: number;
    capacity: number;
    sail?: { m: number; crew: number };
    oars?: { m: number; crew: number };
    traits: string[];
  };
}

export interface SkillInstance {
  /** id STABLE de la Compétence (langue-indépendant) ; l'affichage résout en libellé via `skillInstanceLabel`. */
  skillId: string;
  spec?: string;
  characteristic: CharKey;
  advances: number;
}

export interface TalentInstance {
  /** id STABLE du Talent (langue-indépendant) ; la spec est séparée (plus de libellé concret stocké). */
  talentId: string;
  spec?: string;
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
  /** Astrologie (ADE2 ch.03, optionnel) — flavor pur : signe ascendant + demeures célestes
   *  (le signe mécanique du Personnage vit sur `Combatant.star`). */
  ascendant?: string;
  dwellings?: { house: string; sign: string }[];
}

/** Ignorance de PA — descripteur GÉNÉRAL réutilisable (armes enchantées, attributs de Domaine,
 *  Projectiles…). Un NOMBRE = N points ignorés (Perforante = 1) ; sinon une catégorie : 'all' (tous),
 *  'metal' (armures métalliques — Chamon/Azyr), 'leather' (cuir — Ghur), 'nonMagic' (tout le non
 *  magique — Ulgu). Calcul : engine/armourBypass.bypassedAP. */
export type ArmourBypass = number | 'all' | 'metal' | 'leather' | 'nonMagic';

/** Spécification STRUCTURÉE des Dégâts d'arme (LDB 62). La présence du token `BF` (Bonus de Force) est
 *  PORTEUSE de sens — exprimée explicitement par `plusBF`, jamais par accident de chaîne. `flat` DÉJÀ
 *  résolu (négatif autorisé : Indice −2). `bare` : « +BF » NU (Tentacule/Piétinement) ≠ « +BF+0 ».
 *  `literal` = escape hatch pour les Dégâts non chiffrables (« Spécial »). Affichage dérivé par
 *  `damageString` ; remplace la chaîne « +BF+4 » re-parsée par regex au runtime. */
export type WeaponDamageSpec =
  | { literal: string }
  | { plusBF: boolean; flat: number; bare?: true };

/** Atout/Défaut d'arme ou d'armure PORTÉ par un objet/arme au runtime. Forme STRUCTURÉE (id stable du
 *  registre + Indice éventuel) — miroir runtime de `QualityRef` de la donnée, sans l'aplatissement en
 *  chaîne « id value » re-parsée par regex. `value` = Indice (Solide N, Recharge N, Protectrice N) OU
 *  magnitude d'une pénalité de port (`en-discretion` −10). Affichage dérivé par `qualityRefLabel`. */
export interface QualityInstance {
  /** id STABLE du registre de qualités (`QualityData.id` / `QualityRef.id`) — jamais un libellé FR. */
  id: string;
  /** Indice / magnitude éventuelle (Solide 3, Recharge 2, « -10% en Discrétion » → −10). */
  value?: number;
}

/** Côté de montage d'une pièce d'artillerie sur un navire (MDG ch.12-13), relatif au cap du bateau —
 *  pilote l'arc de tir. La LOGIQUE d'arc vit en `state/fireArc.ts` (elle dépend du cap Dir8) ; ce TYPE pur
 *  vit ici pour que `Weapon`/`ItemInstance` le portent sans dépendance engine→state. */
export type FireArc = 'proue' | 'tribord' | 'poupe' | 'babord';

export interface Weapon {
  name: string;
  type: 'melee' | 'ranged';
  /** Dégâts d'arme STRUCTURÉS (cf. `WeaponDamageSpec`) — ex. `{plusBF:true,flat:4}` (« +BF+4 »). */
  damage: WeaponDamageSpec;
  reach?: string | null;
  /** Portée en mètres (distance uniquement). */
  range?: number | null;
  qualities: QualityInstance[];
  /** `id` du Groupe d'arme/famille de munition (`WeaponGroupData.id`) — réf, ≠ libellé. Pilote la
   *  Spécialisation de combat (`combatValue`), la famille de munition (`ammoFamily`), le rendu (rig). */
  subType?: string;
  /** Nombre de mains requises (1 ou 2). Dérivé de `(2M)` / arc / arbalète. */
  hands?: 1 | 2;
  /** Main qui tient l'arme dans le loadout actif ('off' → pénalité de main secondaire). */
  hand?: 'main' | 'off';
  /** uid de l'ItemInstance source (loadout) — pour matcher un choix d'arme. Absent : Mains nues/Crochet. */
  uid?: string;
  /** id de trapping SOURCE d'une arme « built-in » (Mains nues = 'mains-nues') — marqueur STABLE,
   *  multilangue (≠ test par nom `w.name === 'Mains nues'`). Absent pour les armes manufacturées. */
  builtinId?: string;
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
  /** Effets « à la touche » repliés depuis l'enchantement de l'arme (op `augmentWeapon` / arme
   *  invoquée) par `recomputeLoadout` → lus par `effectsOf` (state/triggeredEffects). */
  onHitEffects?: import('../state/flow').TriggeredEffect[];
  /** Nature d'attaque NATURELLE (morsure/cornes/caudale/tentacules/pietinement…) STAMPÉE à la
   *  construction de l'arme (depuis le `kind` de la manœuvre/attaque gratuite qui la connaît). Clé de
   *  POSE (même domaine que le retour de `creatureAttackKind`) lue pour l'anim et la Condition Flow
   *  `attackKind` — ≠ name-parse (multilangue-safe). Absent = arme manufacturée (pose générique). */
  attackKind?: string;
  /** Pièce d'artillerie MONTÉE sur un navire : côté de montage (proue/poupe/bâbord/tribord) relatif au
   *  cap → restreint l'arc de tir (lu par la validation de visée via `inFireArc`). Absent = arme non montée. */
  mountSide?: FireArc;
}

/** Enchantement d'ARME (op `augmentWeapon` — B. de Droiture, Marteau ardent, Épée de justice ;
 *  arme invoquée — Épée ardente de Rhuin). PORTÉ PAR L'OBJET (`ItemInstance.enchants`, source de
 *  vérité) et replié dans l'arme dérivée par `recomputeLoadout` (`applyEnchants`). `id` : identité
 *  pour le retrait ciblé à l'expiration (un `ActiveEffect.enchantRef` le temporise). */
export interface WeaponEnchant {
  id: string;
  /** Atouts ajoutés en ids STABLES de qualité (`QualityRef.id` — « magique » → touche l'Éthéré ;
   *  « percutante »…). Repliés tels quels dans `Weapon.qualities` (eux-mêmes des ids) par `applyEnchants`. */
  addQualities?: string[];
  /** Dégâts supplémentaires (Marteau ardent : +BSoc ; Épée ardente : +6) — déjà résolu. */
  damageBonus?: number;
  /** Ignorance de PA conférée (Épée de justice → 'all') — descripteur général ArmourBypass. */
  bypass?: ArmourBypass;
  /** Effets DÉCLENCHÉS « à la touche » — forme `TriggeredEffect` (Marteau ardent → En flammes/À Terre). */
  onHitEffects?: import('../state/flow').TriggeredEffect[];
}

/** Points d'Armure par localisation. */
export type ArmourPoints = Record<HitLocation, number>;

/** id d'un État — slug d'`etats.json`. OUVERT (string) : les États sont de la DONNÉE éditable au Codex,
 *  on peut en CRÉER. Les 12 États canoniques (LDB 16) à comportement moteur sont référencés par le moteur
 *  via la constante `COND` (engine/conditions) — pas d'union fermée qui interdirait la création. Le libellé
 *  affiché se résout via `conditionLabel`/`findConditionById`. */
export type ConditionId = string;

export interface ConditionInstance {
  /** id de l'État (slug d'etats.json) — ≠ libellé (résolu à l'affichage via `conditionLabel`). */
  name: ConditionId;
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
  /** Compétence visée (id stable skills.json) ; 'all' = toute magie (priere + langue + focalisation). */
  skill: 'priere' | 'langue' | 'focalisation' | 'all';
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
  /** id STABLE de l'effet (langue-indépendant) pour les effets que le moteur reconnaît par identité
   *  (« Exposition (froid) » → 'exposition-froid') plutôt que par libellé. Le `label` reste l'affichage. */
  effectId?: string;
  /** Caractéristique modifiée, le cas échéant. */
  char?: CharKey;
  /** Valeur du bonus (ex. +10). */
  bonus: number;
  /** Durée de l'effet (échelle Rounds, horloge `gameTime`, ou permanent) — représentation UNIQUE
   *  (cf. `engine/duration.ts`). Remplace l'ancien couple `roundsLeft` + `untilTime` (+ sentinelle
   *  `COMBAT_PERSIST`) : un buff en Rounds = `{scale:'rounds'}`, en heures = `{scale:'clock'}` (purgé
   *  par l'horloge), sans durée = `{scale:'permanent'}`. */
  duration: Duration;
  /** SORT SOURCE de cet effet actif (posé à l'incantation via `OpsCtx.sourceSpell`) : identité + NI, pour
   *  la DISSIPATION (LDB 46 l.204-207 : Test étendu de Langue (Magick) jusqu'au NI → retrait de TOUS les
   *  effets de ce sort). Absent = effet non-magique ou sort instantané (rien à dissiper). */
  spell?: { spellId: string; ni: number; casterId: string; label: string };
  /** Ops RÉCURRENTES re-jouées à CHAQUE fin de Round tant que l'effet dure (op `perRound` — sorts
   *  multi-Rounds : 1 État X par Round, 1 Ration par Round de « Récolte de Rhya », etc.). Les valeurs
   *  sont déjà résolues à l'incantation (littérales) — `endOfRound` les ré-applique via `applyOps`
   *  sans avoir besoin du lanceur. La durée (donc le nombre de répétitions) suit `duration`, qui
   *  intègre la Surincantation de Durée (LDB 47). */
  opsPerRound?: import('./ops').GameOp[];
  /** PA temporisés à TOUTES les localisations (Armure Aethyrique : « +1 PA à toutes les
   *  Localisations ») — lus par effectiveArmourAt à la mitigation des Dégâts. */
  apAll?: number;
  /** PA temporisés à une Localisation précise (op `ap` avec `loc`) — lus par effectiveArmourAt. */
  apAt?: Partial<Record<HitLocation, number>>;
  /** Trait de créature ACCORDÉ par cet effet (op `grantTrait` — Envol, Effrayant…) : le
   *  `TraitInstance` exact posé dans `c.traits`, retiré (une instance) à l'expiration (engine/grantedTraits). */
  grantedTrait?: import('./statEntry').TraitInstance;
  /** Arme INVOQUÉE temporaire (op `grantWeapon` — Arme aethyrique, Faux de Shyish, Épée ardente) :
   *  l'objet `conjured` est posé dans un SET d'armes DÉDIÉ (réutilise le système de loadouts) rendu
   *  actif. À l'expiration, `dropExpiredGrantedWeapons` retire l'objet ET le set, et réactive le set
   *  d'origine (`restoreLoadoutId`). Pas d'arme synthétique ni d'injection parallèle. */
  conjuredSet?: { itemUid: string; loadoutId: string; restoreLoadoutId?: string };
  /** Arme NATURELLE accordée par un Sort (Dent et griffe : Morsure/Arme ; Incarnation de Wyssan) —
   *  attaque ADDITIONNELLE injectée dans `c.weapons` par recomputeLoadout (même patron que Tentacule/
   *  Cornes), retirée à l'expiration. Dégâts SB-relatifs (« +BF+N ») et Atouts portés par l'arme. */
  naturalWeapon?: Weapon;
  /** Talent ACCORDÉ par cet effet (op `grantTalent` — Flambeau de Vertu : Sans peur…) : réf par
   *  `talentId` STABLE (+ `spec` éventuel), lu par `combatFeatures/dispatch.featuresOf` tant que
   *  l'effet dure (PAS posé dans `c.talents` — la fiche/avancement ne voient que les talents
   *  possédés). Résolu en libellé concret (clé du registre) par `talentConcrete`. */
  grantedTalent?: { talentId: string; spec?: string };
  /** DURÉE d'un enchantement d'arme (op `augmentWeapon`) : l'enchant vit sur l'OBJET
   *  (`ItemInstance.enchants`, replié dans l'arme par `recomputeLoadout`) ; cet effet ne porte que sa
   *  durée + la réf de l'enchant à retirer à l'expiration (`dropExpiredGrantedWeapons`). Calqué sur
   *  `conjuredSet`. (L'arme invoquée n'en a pas : son objet est retiré en bloc.) */
  enchantRef?: { itemUid: string; enchantId: string };
  /** « Peut relancer le prochain Test auquel elle échoue » (Bénédiction de Chance, LDB 41) —
   *  consommé à l'usage au point de relance des flux de jet (engine/activeFlags). */
  freeReroll?: boolean;
  /** « Deux lancers, choisissez le meilleur » quand le PORTEUR inflige une Blessure Critique
   *  (Bénédiction de Sauvagerie, LDB 41) — lu par rollCritical via l'attaquant. */
  critRollTwice?: boolean;
  /** « Ne subit aucune pénalité causée par les États » (Endurance de l'anachorète, LDB 42) —
   *  lu par combatTestPenalty/testStatePenalty. */
  ignoreStatePenalties?: boolean;
  /** Détermination (LDB 17 l.62) : immunité PSYCHOLOGIQUE temporaire (la source est IGNORÉE, pas vaincue).
   *  Durée portée par `duration` (Rounds) → décrémentée/expirée par le système de Durée unifié. */
  psychImmune?: boolean;
  /** Détermination (LDB 17 l.64) : ignore les modificateurs de Blessure critique (traumatismes), 1 Round.
   *  Durée portée par `duration` → expirée par le système de Durée unifié (plus de flag round-scopé). */
  ignoreCritMods?: boolean;
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
  /** Points de Chance ACCORDÉS temporairement par un Sort (op `gainResource` — Signes d'Amul,
   *  Maître du Destin) : les points NON dépensés sont retirés à l'expiration de l'effet (rounds OU
   *  horloge), via `dropExpiredGrantedResources` (engine/grantedResources). */
  grantedFortune?: number;
  /** Points de Destin ACCORDÉS temporairement par un Sort (op `gainResource` — Troisième Signe d'Amul) :
   *  retirés à l'expiration s'ils n'ont pas été dépensés (cf. `grantedFortune`). */
  grantedFate?: number;
  /** Modificateurs de Compétence nommée posés par cet effet (op `skillMod` — sort « −10 Esquive 3
   *  rounds ») : lus par `traumaSkillPenalty`/`traumaDodgePenalty` en plus des ops de séquelle. */
  skillMods?: Record<string, number>;
  /** Échelle multiplicative du Mouvement (op `moveScale`) — lue par `traumaMovementHalved`/`effectiveMovement`. */
  moveScale?: { num: number; den: number };
  /** Modificateur ADDITIF de Mouvement (op `moveMod`) — sommé par `effectiveMovement` avant le `moveScale`. */
  moveMod?: number;
  /** Plafond de mains d'arme maniables (op `maxWeaponHands`) — lu par `cannotWieldTwoHanded`. */
  maxWeaponHands?: number;
}

/** Traumatisme (LDB 18-Traumatisme) — conséquence persistante d'une Blessure critique ou d'une
 *  Maladresse. Seuls les effets EN-COMBAT quantifiés sont modélisés (movementHalved, charPenalty) ;
 *  le reste (−10 Tests de Localisation, membre inutilisable, amputation, guérison) est journalisé
 *  dans `note` (→ Jalon 5). Persisté entre combats (cf. engine/persistence.ts). */
export interface Trauma {
  label: string;
  /** id STABLE d'une séquelle SYNTHÉTIQUE agrégée que le moteur reconnaît par identité
   *  (Dents perdues → 'dents-perdues', Cécité → 'cecite', Surdité → 'surdite') — ≠ libellé d'affichage.
   *  Posé par `consolidateAmputations`/`escalateSensoryLoss` pour la déduplication langue-indépendante. */
  traumaId?: string;
  location: HitLocation;
  /** Effets PASSIFS de la séquelle — vocabulaire PARTAGÉ `GameOp` (de-POC : remplace charPenalty/
   *  skillPenalty/dodgePenalty/movementHalved/noTwoHanded/sense). Lus EN DIRECT par les helpers de trauma
   *  (`traumaCharPenalties`/`traumaSkillPenalty`/`traumaDodgePenalty`/`traumaMovementHalved`/
   *  `cannotWieldTwoHanded`) avec annulation par prothèse : `charMod` (carac), `skillMod` (Esquive = ancien
   *  dodgePenalty, Langue/Chevaucher/Perception…), `moveScale` (ancien movementHalved), `maxWeaponHands`
   *  (ancien noTwoHanded), `senseLoss` (ancien sense). Éditables dans le Codex (GameOpEditor). */
  ops?: import('./ops').GameOp[];
  /** Texte canon LDB 18 VERBATIM (DISPLAY-ONLY) — jamais parsé pour de la mécanique (≠ `ops`). Provient
   *  de la fiche `traumas.json` ou d'une séquelle synthétique (fracture mal ressoudée). */
  desc?: string;
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
   *  (dans `items`). Réf par `trappingId` STABLE (`crochet`/`fausse-jambe`/`merveille-d-ingenierie`/
   *  `nez-dore`/`cache-oeil`/`oeil-de-verre`/`dents-en-bois`) — matchée contre `ItemInstance.trappingId`.
   *  `cancels: 'all'` annule toute la pénalité (Merveille d'ingénierie : « ignorer complètement la
   *  perte… d'une jambe » ; Nez doré ; Œil de verre…) ; `'movement'` rétablit le déplacement seul
   *  (Fausse jambe : « ignorer 1 Point de Mouvement perdu » — l'Esquive demande 200 PX, non modélisé). */
  prosthesis?: { trappingId: string; cancels: 'all' | 'movement' }[];
  /** Nombre d'éléments perdus pour une séquelle CUMULATIVE par comptage (LDB 18) : doigts (−5/doigt, 4+ →
   *  règle de la main, l.341/344) ou dents (−1 Soc/paire, l.338). Fusionné à chaque nouvelle perte. */
  count?: number;
}

export type ItemKind = 'melee' | 'ranged' | 'armor' | 'ammo' | 'misc';

/** Instance d'objet portée par un personnage (dérivée d'un trapping à stats). */
export interface ItemInstance {
  uid: string;
  /** `id` du trapping de catalogue dont l'objet dérive (`TrappingData.id`) — réf STABLE posée par
   *  `itemFromTrappingById`. ABSENT = objet CUSTOM (hors-base : `customTrapping`, pièces de monstre…).
   *  Source de re-dérivation (arme dérivée de prothèse, prix de revente, réparation) — ≠ name-match. */
  trappingId?: string;
  name: string;
  kind: ItemKind;
  damage?: WeaponDamageSpec; // armes
  reach?: string | null;
  range?: number | null;
  qualities: QualityInstance[];
  /** Enchantements actifs portés par l'ARME (op `augmentWeapon` / arme invoquée) — SOURCE DE VÉRITÉ,
   *  repliés dans l'arme dérivée par `recomputeLoadout` (`applyEnchants`). Temporisés via `ActiveEffect.enchantRef`. */
  enchants?: WeaponEnchant[];
  /** Pièce d'artillerie MONTÉE sur un navire : côté de montage (FireArc) — propagé à `Weapon.mountSide`
   *  par `recomputeLoadout` (restreint l'arc de tir). Posé au spawn depuis le poste (`ShipPoste.side`). */
  mountSide?: FireArc;
  pa?: number; // armures : Points d'Armure
  locs?: HitLocation[]; // armures : localisations couvertes
  enc: number; // encombrement
  equipped: boolean;
  desc?: string | null;
  /** Effet d'un CONSOMMABLE (potion/bandage) en `GameOp[]` — copié du trapping (`TrappingData.consumable`).
   *  Exécuté par `applyOps` (`useConsumable`). `isConsumable` = présence d'au moins un op. */
  consumable?: import('./ops').GameOp[];
  /** `id` du Groupe/famille (`WeaponGroupData.id`) — munition : famille compatible (arc/arbalete/
   *  poudre-noire) ; armure : type (plate/mailles/cuir-souple…). Correspond à `Weapon.subType`. */
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
  /** Arme INVOQUÉE temporaire (op `grantWeapon`) : objet ordinaire mais TENU d'office (injecté en
   *  tête de `c.weapons` par recomputeLoadout) et retiré à l'expiration du Sort. */
  conjured?: boolean;
  /** Silhouette de RENDU forcée (libellé d'arme du catalogue) — propagée à `Weapon.form`. */
  form?: string;
  /** Valeur de marché PRÉ-CALCULÉE (butin récolté : pièces de monstre, Précieuses Entrailles ZI) —
   *  rareté × dangerosité × Taille × Conservation déjà nettes. Revendu en DIRECT (sans le taux de
   *  revente catalogue), cf. `merchantFlow.sellGain`. Absent pour un objet ordinaire (prix = catalogue). */
  price?: import('./money').Money;
  // ── Marqueurs FONCTIONNELS de catégorie (propagés du `TrappingData` par itemFromTrappingById) —
  //    les règles détectent par flag STABLE, plus par nom FR (multilangue-safe). Cf. data/index.ts.
  /** Protège des intempéries (Cape/Manteau) — Exposition au froid (exposure.ts) + cape de fiche (items.ts). */
  weatherProtection?: boolean;
  /** Abri de campement (Tente) — atténue l'Exposition d'une nuit dehors (exposure.ts). */
  isShelter?: boolean;
  /** Ration de voyage — consommée par l'entretien de Faim (provisions.ts). */
  isRations?: boolean;
  /** Grimoire / livre de Sorts — lecture d'un Sort non mémorisé (grimoire.ts). */
  isGrimoire?: boolean;
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
  /** `id` STABLE de la créature du bestiaire dont ce combattant est une instance (posé au spawn) —
   *  clé de résolution du rig/apparence (« plus de label » : on ne re-résout plus par `name`). */
  creatureId?: string;
  /** Coque/navire (`bodyShape:'vehicule'`) : `id`s des Combattants d'ÉQUIPAGE exposés à bord (MDG ch.14).
   *  Un Critique « Équipage » et les Éclats reviennent à ces marins (Critiques de personnage / Dégâts). */
  crewIds?: string[];
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
  /** États psychologiques portés (LDB 21) — Peur/Terreur/Animosité/Haine ET **Frénésie** (`type:'frenesie'`,
   *  posée à l'entrée, lue par `isFrenzied` ; +1 BF / immunité psy / sortie en DONNÉES `psychology.json`). */
  psychState?: import('./psychology').PsychAffliction[];
  /** (Détermination : l'immunité psy temporaire + l'ignorance des modifs de Critique sont désormais
   *  portées par des `ActiveEffect` à `duration` Rounds — `psychImmune`/`ignoreCritMods` — expirées par
   *  le système de Durée unifié, plus de compteur/flag round-scopé ad hoc.) */
  /** Groupes d'appartenance + traits psy possédés (matching des Cibles — utilisés en P3). */
  groups?: string[];
  psychTraits?: import('./psychology').PsychTrait[];
  /** Traits de créature (STRUCTURÉS — `TraitInstance` : id/value/arg/count/range) → attaques
   *  naturelles gratuites & règles dérivées (Morsure, Attaque caudale, Souffle… cf.
   *  engine/creatureAttacks). Lus sans aucun parsing (`resolveTraits`/`hasTraitKey`). Conservés au spawn. */
  traits?: import('./statEntry').TraitList;
  /** Traits dont les modificateurs de PROFIL (charMods/Mouvement, LDB 85 : Élite/Coriace/Brutal/Rapide…)
   *  s'appliquent en DIRECT par le collecteur passif (kind `intrinsèque`) plutôt que d'être cuits dans
   *  `characteristics`/`movement` : facultatifs d'un profil bestiaire FINAL, traits d'un statbloc d'éditeur,
   *  traits ACCORDÉS en jeu (`grantTrait`). Absent ⇒ aucun (profil déjà final / héros sans trait créature).
   *  `characteristics` reste la BASE pure ; `effectiveChar` ajoute ces traits (cf. `baseWithTraits`). */
  liveTraits?: import('./statEntry').TraitList;
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
  /** Rôle de marche PERSISTANT (`id` d'Activité de voyage EDOC ch.5) — « les mêmes tiennent toujours le
   *  même poste ». Attaché au personnage (toutes parties de voyage) ; l'assignation d'un trajet en est
   *  initialisée. Absent ⇒ inféré des compétences (`defaultTravelRole`). Le joueur l'épingle/le change. */
  travelRole?: string;
  /** File transitoire d'attaques gratuites de créature restant à résoudre ce tour (kinds :
   *  morsure/caudale/pietinement) — pilotée par aiCreatureFreeAttacks à travers la modale de défense. */
  pendingFreeAttacks?: string[];
  /** A chargé ce tour → ouvre une Attaque gratuite de Cornes (LDB 85) si la créature a le trait. */
  chargedThisTurn?: boolean;
  /** Règle optionnelle « se fatiguer » (LDB 16 l.99) : Rounds d'effort soutenu accumulés ; à BE Rounds,
   *  Test de Résistance → échec = Exténué. Inerte tant que la règle `combat-se-fatiguer` est inactive. */
  effortRounds?: number;
  /** Attaques GRATUITES de manœuvre déjà jouées ce TOUR, COMPTÉES par type (LDB 85 : « pendant son tour,
   *  la créature peut effectuer UNE Attaque gratuite » → plafond 1/tour ; exception « une Attaque par
   *  tentacule » → `count`/tour). Remplace l'ancien booléen tentacule ; remis à zéro en début de tour. */
  freeAttacksThisTurn?: Partial<Record<string, number>>;
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
  /** Composants d'incantation possédés (LDB 46 l.158-163) — `id` des Sorts d'Arcane/Domaine pour
   *  lesquels le héros a acheté un composant (coût = NI pistoles d'argent, « acheté pour un Sort
   *  spécifique »). Sous la règle optionnelle `magic-composant`, le composant absorbe les pires
   *  effets du contrecoup : Imparfaite Majeure → Mineure, Mineure → annulée ; consommé à l'incantation
   *  (succès OU échec, Imparfaite OU PAS). Persisté entre combats. */
  componentSpells?: string[];
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
  /** Accumulateur de DISSIPATION permanente (LDB 46 l.204-207) : Test étendu de Langue (Magick) en cours,
   *  DR cumulé vers la NI d'UN sort durable (identifié par sort + lanceur). Persiste entre Rounds de combat
   *  (une Action/Round) ; effacé à la dissipation (DR ≥ NI) ou à la fin du combat. Cf. `caster.focus`. */
  dispel?: { spellId: string; spellCasterId: string; total: number };
  /** Mouvement (cases par tour, dérivé de la table de Mouvement). */
  movement: number;
  // Destin / Résilience (héros uniquement)
  fate?: number;
  fortune?: number;
  resilience?: number;
  resolve?: number;
  motivation?: string;
  /** Signe astral (« Naissance sous les Étoiles », ADE2) — `id` STABLE du signe (≠ libellé —
   *  multilangue-safe) ; résolu à l'affichage par `findStarById`. */
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
  /** Maladies auxquelles ce combattant a été EXPOSÉ pendant le combat (blessé par une source porteuse :
   *  Infecté → 'blessure-purulente', Rongeur Infecté → 'fievre-du-rongeur', Maladie (Type) → l'`arg`,
   *  munition Infecté) → Tests de Contraction post-combat (LDB 85 p.340 / LDB 20 l.32/49). SOURCE UNIQUE
   *  (op `exposeDisease`) — remplace les anciens flags `woundedByInfected`/`woundedByRodent`. */
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
  /** Le déclencheur `onSlain` a déjà été émis pour ce combattant (mise hors de combat) — garde-fou
   *  d'unicité : `onSlain` peut être atteint par plusieurs chemins de mort, on ne le tire qu'UNE fois. */
  slainNotified?: boolean;
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
  /** `passive` GameOp[] des AURAS de combat à portée desquelles ce combattant se trouve (Perturbant :
   *  −20 aux Tests, LDB 85 p.341) — recalculé chaque Round par le hook `recompute-auras` à partir des
   *  `TraitData.aura` voisines, lu par `passiveMods` (kind `etat`, non-cumul). Générique (toute aura). */
  auraMods?: import('./ops').GameOp[];
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
  tresFacile: t('difficulty.tresFacile'),
  facile: t('difficulty.facile'),
  accessible: t('difficulty.accessible'),
  intermediaire: t('difficulty.intermediaire'),
  complexe: t('difficulty.complexe'),
  difficile: t('difficulty.difficile'),
  tresDifficile: t('difficulty.tresDifficile'),
};
