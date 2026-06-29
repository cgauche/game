/**
 * Schéma de Scène/Niveau — contrat UNIQUE partagé par :
 *  - l'éditeur de niveau (lecture/écriture),
 *  - le runtime (exploration + combat),
 *  - le contenu de campagne (livré comme documents de scène à ce format).
 *
 * Aucune scène n'est codée « en dur » : la campagne est de la donnée.
 */
import { CharKey, Difficulty } from '../engine/types';
import type { ShipPoste, NavalTraitRef } from '../engine/types';
import type { Flow, Condition, EffectOp } from './flow';
import { type DayPhaseKey } from '../engine/clock';
import type { Dir8 } from './dir8';
import { terrainWalkable } from './terrain';
import { buildingBlockedAt } from './buildings';
import { entityBlockedAt } from './sceneRules';

/** Un terrain est un id de catalogue (cf. src/state/terrain.ts). */
export type Terrain = string;

export type Facing = 'N' | 'S' | 'E' | 'O';

/**
 * Rôle d'une entité de scène. `personnage` = tout être animé (apparence libre
 * via `ref` + dialogue/quête optionnel) — fusion des anciens `pnj`/`ennemi`,
 * que le combat (encounters) et l'interaction (dialogueId) ne distinguaient pas.
 */
export type EntityKind = 'heroStart' | 'personnage' | 'prop';

export interface CustomStatblock {
  name: string;
  char: Partial<Record<CharKey | 'M' | 'B', number>>;
  weaponDamage?: string; // ex. "+BF+4"
  armour?: number; // PA uniforme sur toutes localisations
  /** Traits du profil custom, STRUCTURÉS (`TraitInstance` : id + value/arg) — édités par picker. */
  traits?: import('../engine/statEntry').TraitInstance[];
  /** Catégorie de Taille (LDB 85) — sinon dérivée du trait « Taille (X) », défaut Moyenne. */
  size?: import('../engine/size').SizeCategory;
  /** Groupes d'appartenance manuels supplémentaires (Sigmarite, Cultiste…) pour les Traits psy ciblés (LDB 21). */
  groups?: string[];
  /** Sorts connus (ids de spells.json) — choix d'AUTEUR ; l'IA incante les Projectiles magiques. */
  spells?: string[];
  /** Compétences STRUCTURÉES (`SkillRef` : id stable + valeur de Test FINALE) → avances dérivées au
   *  spawn (valeur − Caractéristique, inverse de LDB 09). */
  skills?: import('../data').SkillRef[];
  /** Talents STRUCTURÉS (`TalentRef` : id stable + spécialisation/niveau). */
  talents?: import('../data').TalentRef[];
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
  ailes?: boolean;     // ailes emplumées repliées dans le dos (harpie, démon ailé)
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
  /** Espèce/race CHOISIE — découple l'apparence du nom (label/ref) : 'Nains', 'Halflings',
   *  'Elfes'… (canonicalisée par `baseSpeciesOf`). Vide = dérivée du nom. */
  species?: string;
  /** Tenue CHOISIE — découple l'habit du nom : un PNJ peut porter n'importe
   *  quelle tenue (Mendiant, Soldat, Skaven, Nu…). Vide = dérivée du nom/espèce. */
  tenue?: string;
  /** Yeux personnalisés (clés du catalogue `EYE_OPTIONS` : chat/caprin/reptilien/noir/rouge/
   *  verre) — remplacés EN PLACE sur l'orbite du visage. Vide = yeux normaux. */
  eyes?: { G?: string; D?: string };
  /** Traits de corps ADDITIFS — clés du catalogue d'éléments (`parts/elements.ts` : queue, cornes,
   *  oreilles-pointues, crocs, écailles…). N'importe quel PNJ peut en porter (perso. réutilisable). */
  features?: string[];
}

export interface SceneEntity {
  id: string;
  kind: EntityKind;
  pos: { x: number; y: number };
  /** Étage (niveau de scène, cf. `levels`). 0 ou absent = sol ; >0 = posée sur un étage supérieur,
   *  rendue soulevée de z·LEVEL_H px et triée par-dessus le niveau inférieur. */
  z?: number;
  /** Orientation MONDE (8 directions) — éditable, projetée au rendu (project + camRot). */
  facing?: Dir8;
  label?: string;
  /** Référence au bestiaire (personnage) ou au catalogue de décor (prop, cf. PROPS). */
  ref?: string;
  /** Profil personnalisé (sinon on utilise `ref`). */
  statblock?: CustomStatblock;
  /** Coque/navire : `id`s des entités d'ÉQUIPAGE exposées à bord (MDG ch.14) — posés sur le Combattant au spawn. */
  crewIds?: string[];
  /** Coque/navire : pièces d'artillerie MONTÉES (postes, MDG ch.12-13) — posées sur le Combattant-coque au
   *  spawn, puis `applyShipPostes` sert chaque poste à son chef de pièce. */
  postes?: ShipPoste[];
  /** Coque/navire : **Améliorations d'INSTANCE** (MDG ch.12, réfs par id ex. `{ id: 'blindage-fer' }`) —
   *  s'ajoutent aux Traits du TYPE et modifient ce navire-ci (PA de coque, M, couvert…). Posées au spawn. */
  upgrades?: NavalTraitRef[];
  dialogueId?: string;
  /** Clé d'asset (token). */
  sprite?: string;
  /** Décor INTERACTIF (fouille/ramassage). Absent = décor pur. `flow` exécuté une fois (un butin de
   *  feuilles `do` est ramassable un à un — cf. entityPickables ; un `test` en fait une fouille à risque) ;
   *  `consume:true` → le décor disparaît quand pris, sinon il reste (marqué `__fouille_<id>`). */
  interact?: { flow: Flow; consume?: boolean };
  /** Apparence (calques) : override éditeur ; sinon auto-variée au seed de l'id. */
  appearance?: EntityAppearance;
  /** Animation d'ambiance en boucle (clé de AMBIENT_CLIPS) — rend l'entité via le rig. */
  anim?: string;
  /** Arme ÉQUIPÉE (libellé) — affichée par le rig (tenue prête si à distance). Ex. 'Arbalète'. */
  weapon?: string;
  /** Empreinte multi-cases (décor statique : charrette 2×1, épave 2×2…). Défaut 1×1.
   *  Bloque la walkability (entityBlockedAt) et porte le Couvert sur toutes ses cases. */
  foot?: { w: number; h: number };
  /** Source de lumière (brouillard de guerre) : rayon d'éclairage en cases. Override de l'instance ;
   *  sinon le rayon vient du TYPE de prop (`props.json` `light`). Absent + type sans `light` = pas de lumière. */
  light?: { radiusTiles: number };
  /** Marchand (#2) : ce PNJ ouvre un panneau d'achat/vente (référence un archétype de `state/merchants`).
   *  `settlement`/`resaleRate`/`buyMarkup` surchargent l'archétype pour cette entité (prix paramétrables :
   *  resaleRate = rachat à la vente, buyMarkup = majoration à l'achat). */
  merchant?: { archetype: string; settlement?: import('../engine/disponibilite').Settlement; resaleRate?: number; buyMarkup?: number; restockDays?: number };
  /** RÔLE combat optionnel (au même titre que dialogue/marchand) : présent = ce personnage peut être
   *  enrôlé dans une rencontre (cf. EncounterMember). Porte les choix d'auteur qui DÉCRIVENT la
   *  personne au combat — son profil (ref/statblock) et son apparence vivent déjà sur l'entité. */
  combat?: {
    /** Traits FACULTATIFS choisis (LDB 76 l.49), STRUCTURÉS (`TraitInstance`), fusionnés au spawn. */
    optionals?: import('../engine/statEntry').TraitInstance[];
    /** Sorts connus (ids de spells.json, créature `ref`) — choix d'auteur (la donnée bestiaire n'en liste pas). */
    spells?: string[];
    /** Caractéristiques aléatoires au spawn (LDB 78 : −10 + 2d10, graine stable par id). */
    randomChars?: boolean;
    /** Invisible en EXPLORATION (embuscade) : n'apparaît qu'au combat. `false`/absent = PNJ visible
     *  qui devient hostile au déclenchement. */
    hiddenUntilCombat?: boolean;
  };
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
  /** Donne un objet à un héros (défaut : le premier). `trappingId` = objet de CATALOGUE à stats (réf
   *  `TrappingData.id`) ; `custom` = objet HORS-base (nom libre — trinket/quête/pièces de monstre) sans
   *  stats. L'objet arrive NON équipé. Champs MAGIQUES optionnels (butin/quête) : `qualities` AJOUTÉES
   *  (Atout/Défaut), `identified:false` = qualités masquées jusqu'à Évaluation (#2), `skin` = recoloration. */
  | { type: 'giveTrapping'; trappingId?: string; custom?: string; heroId?: string; qualities?: string[]; identified?: boolean; skin?: Record<string, string>;
      /** Aura détectée / Détection déjà tentée (Talent Détection d'artefact, LDB 10) / jour de la
       *  dernière Évaluation ratée — posés par la fenêtre de loot AVANT attribution, propagés sur
       *  l'ItemInstance à la remise. */
      magicKnown?: boolean; detectTried?: boolean; appraiseTriedDay?: number;
      /** Valeur de marché propre posée sur l'instance (ex. pièces de monstre récoltées, ZI). */
      price?: { gold?: number; silver?: number; brass?: number } }
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
  /** Test ÉTENDU (LDB 12 l.197-211) : un acteur cumule des DR Round par Round jusqu'à `targetDR`
   *  (crocheter une serrure, forcer un mécanisme…). `flag` posé à la réussite (gate la suite). */
  | {
      type: 'extendedTest';
      skill?: string;
      /** Spécialisation ciblée (Métier (Serrurier), Savoir (Magie)…) — précise QUELLE instance du
       *  `skill` est testée quand le héros en possède plusieurs ; sinon la première suffit. */
      spec?: string;
      characteristic?: CharKey;
      difficulty?: Difficulty;
      label: string;
      /** DR CUMULÉ à atteindre (ex. serrure complexe = 5). */
      targetDR: number;
      flag?: string;
    }
  /** Enfoncer une PORTE/objet à PLUSIEURS (EDO Appendice 2) : objet (BE = Bonus d'Endurance, B =
   *  Blessures) ; chaque héros frappe (Bagarre, dégâts = DR + BF − BE). `flag` posé quand l'objet cède. */
  | { type: 'forceDoor'; label: string; doorBE: number; doorB: number; flag?: string }
  | { type: 'setTime'; phase: DayPhaseKey }            // « passe à l'aube/jour/…/nuit » (saut en avant, #T1c)
  | { type: 'setTime'; hour: number; minute?: number } // heure précise (saut en avant)
  /** Effet PROGRAMMÉ (Lot 0) : `effects` est appliqué quand l'horloge atteint l'échéance —
   *  `afterMinutes` (compte à rebours relatif : mèche de bombe) OU `atHour`/`atMinute` (prochaine
   *  occurrence de cette heure du jour). Annulé si `cancelFlag` est posé avant l'échéance
   *  (désamorçage). Déclenché au FRANCHISSEMENT dans `advanceTime` (le temps avance par actions
   *  discrètes : un événement programmé entre deux pas se déclenche dès le pas qui le dépasse). */
  | { type: 'delayedEffect'; afterMinutes?: number; atHour?: number; atMinute?: number; flow: Flow; cancelFlag?: string }
  /** Ouvre la boutique d'une entité marchande (par son id) — permet d'inclure le Marchand dans un
   *  dialogue (ex. choix « Montrez-moi vos marchandises »). L'entité doit porter `merchant` (#2). */
  | { type: 'openMerchant'; entityId: string }
  /** Soins PAYANTS d'un PNJ (médecin/guérisseur/temple — LDB 75 « Docteur en médecine », l'aide
   *  médicale se paie À L'ACTE, 4-6 pistoles) : ouvre l'INFIRMERIE du PNJ (modale persistante,
   *  state/medicFlow) avec ses actes et leurs tarifs — `acts` liste {act, cost?} ; le débit a lieu
   *  au lancement de chaque acte (remboursé si annulé avant le jet). `skill`/`intBonus` = compétence
   *  de Guérison du PNJ (sa fiche, éditable — le moteur applique le RAW Guérison/Chirurgie existant).
   *  `entityId` = le PNJ soigneur (son `label` donne le NOM affiché) → aucun nom codé en dur. Le
   *  joueur choisit les patients dans la modale. */
  | { type: 'medicalAid'; acts?: { act: 'wounds' | 'bleed' | 'trauma' | 'surgery'; cost?: { gold?: number; silver?: number; brass?: number } }[]; skill: number; intBonus: number; entityId?: string }
  /** Début de session (LDB 17 l.47) : chaque héros regagne tous ses Points de Chance,
   *  jusqu'à un maximum égal à son Destin actuel. Exposé dans l'éditeur (pas de hook caché). */
  | { type: 'restoreFortune' }
  /** Repos (LDB 16/18/21) : ouvre la MODALE DE NUIT (state/restFlow) — par héros : couchage +
   *  pitance, prix RAW calculés (LDB ch.66 : commune 10 sc, privée 10 pa pour 2, repas 1 pa —
   *  débit dans la modale), puis bilan globalisé (Exposition dehors, récupération, cauchemars,
   *  contagion). `lodging` : contexte du lieu (auberge/chez soi/campement) ; `quality: 'pietre'`
   *  = ½ prix mais nourriture à risque (Courante galopante 10 %, ch.66 l.51). LEGACY : sans
   *  `lodging`, contexte « maison » (gratuit — prix porté par le choix de dialogue). */
  | { type: 'rest'; days?: number; lodging?: 'auberge' | 'maison' | 'camp'; quality?: 'normale' | 'pietre' }
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
  /** Inflige des dégâts (Lot 3) à un héros (`hero` + `heroId`, défaut = 1er vivant) ou à TOUT le
   *  groupe (`party`) — piège, souffle scénarisé, tick… `amount` = Points de Blessure (0 PB → À Terre,
   *  géré par `loseWounds`). DÉTERMINISTE (pas de jet) → pas de modale. */
  /** EFFECTOP — pont UNIQUE entre la logique authorée (Flow) et le moteur mécanique des sorts : applique
   *  des `GameOp` à une cible (`party`/`hero` scène, ou `caster`/`target` incantation). Type défini dans
   *  le noyau engine (`engine/flowCore` — c'est aussi la feuille PAR DÉFAUT du `Flow<E>` générique) ;
   *  l'union `Effect` ci-dessous l'inclut comme l'un de ses membres. Remplace `inflictDamage` (→ op
   *  `wounds`) et `applyCondition` (→ op `condition`). */
  | EffectOp
  /** Souffle de ZONE (Lot 3) centré sur une case : tous les combattants à `radius` cases (Chebyshev)
   *  — en combat par position, hors combat le groupe (à partyPos) — subissent les `ops` (vocabulaire
   *  unique `GameOp`, appliquées par `applyOps` cible par cible). Bombe, grenade, piège de zone…
   *  Dégâts BRUTS par défaut (`op:'wounds'` ignore BE+PA) ; mitiger = `{ignoreTB:false, ignoreAP:false}`. */
  | { type: 'zoneBlast'; center: { x: number; y: number }; radius: number; ops: import('../engine/ops').GameOp[] }
  /** Chute (LDB 15 l.117-122) : la cible tombe de `metres` mètres → 3 Dégâts/mètre + 1d10, réduits par
   *  le Bonus d'Endurance mais PAS par les PA ; si les Blessures subies dépassent le BE → État À Terre.
   *  `to` (optionnel) repositionne le GROUPE à l'arrivée (balcon→parterre, plancher de loge effondré). */
  | { type: 'fall'; target: 'party' | 'hero'; heroId?: string; metres: number; to?: { x: number; y: number; z?: number } }
  /** Mise en scène (Lot L) : règle le niveau de LUMIÈRE de la scène (0 = noir, 1 = plein jour) — « les
   *  lumières baissent, le rideau se lève ». Lu par le rendu (overlay d'assombrissement). Générique :
   *  tout intérieur (donjon, salle, théâtre). null implicite = auto (horloge/ambiance) tant qu'aucun setLight. */
  | { type: 'setLight'; level: number }
  /** Porte dynamique (brouillard de guerre) : ouvre/ferme la porte de l'arête (x,y,side) — une porte
   *  fermée bloque vue ET passage. Pour un levier/piège/scripted authored. */
  | { type: 'setDoor'; x: number; y: number; side: WallSide; z?: number; open: boolean }
  /** Points de Péché (LDB 40 l.30-36) : l'auteur/MJ sanctionne une infraction aux commandements du dieu
   *  d'un Bienheureux — 1 à 3 selon la gravité (l.36). Défaut : le premier héros sachant Prier. Le dé des
   *  unités d'un Test de Prière ≤ Péchés déclenche la Colère des dieux même sur Test réussi (l.45) ;
   *  chaque jet de Colère en expie 1 (l.53). */
  | { type: 'giveSin'; amount?: number; heroId?: string }
  /** Exposition à une Influence corruptrice (LDB 19 l.23-75) : Test de Résistance (Influence physique)
   *  ou de Calme (spirituelle) par MODALE ; Points de Corruption selon le niveau et le DR. Cible : héros
   *  désigné, sinon le premier vivant. Au-delà de BFM+BE : Test de Résistance ou MUTATION. */
  // `skill` ABSENT = nature indéterminée (l.26 « comme déterminé par le MJ ») → le joueur choisit
  // Résistance/Calme dans la modale ; PRÉSENT = déterminé en amont → verrouillé (pas de choix).
  // `align` (Puissance du Chaos) facultatif : si la mutation survient, force la table EDOC alignée
  // (sinon la règle globale décide). C'est à l'éditeur de niveau de le poser quand la source est dédiée.
  | { type: 'corruptionExposure'; level: 'mineure' | 'moderee' | 'majeure'; skill?: 'resistance' | 'calme'; align?: import('../engine/corruption').ChaosAlign; heroId?: string }
  /** Enseigne un sort SANS coût en PX (trouvaille de campagne : grimoire d'un maître, parchemin…).
   *  Cible : héros désigné, sinon le premier dont un Talent rend le sort apprenable. L'apprentissage
   *  PAYANT passe par l'onglet Avancement (buySpell, LDB 46 l.44-47). */
  | { type: 'learnSpell'; spell: string; heroId?: string }
  /** « Entre deux aventures » (LDB 22-23, Jalon 5) : ouvre l'interlude — Événement d100 par héros,
   *  min(3, semaines) Activités chacun, puis Argent à gaspiller et le temps passe. À poser en fin
   *  de chapitre par l'auteur de campagne. */
  | { type: 'interlude'; weeks?: number }
  /** Ouvre la CARTE DU MONDE (#T2) — à poser sur la porte/route d'un lieu (« partir en voyage »).
   *  Sans effet si le projet n'a pas de carte ou en combat. */
  | { type: 'openWorldMap' }
  | { type: 'endDialogue' };

export interface DialogueChoice {
  text: string;
  /** Condition d'AFFICHAGE du choix (algèbre `Condition`, cf. `evalCondition`). Absente = toujours visible. */
  when?: Condition;
  /** Prix de l'option (service payant : auberge, péage, pot-de-vin…). Le choix est RÉPÉTABLE mais
   *  désactivé si on ne peut pas payer ; à la sélection, le montant est débité AVANT le flow. */
  cost?: { gold?: number; silver?: number; brass?: number };
  /** LOGIQUE exécutée à la sélection : séquence d'effets + branches `if`/`test` (exécutée par `runFlow`). */
  flow?: Flow;
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

/** Fenêtre horaire d'un trigger (heure-du-jour, `before` EXCLUSIF). Champs absents = borne ouverte ;
 *  objet vide = toujours vrai. Combinée en ET avec `rect`/`condition` : le déclencheur ne se produit
 *  qu'en entrant dans la zone PENDANT cette fenêtre (spot-check « au bon endroit au bon moment »).
 *  DÉCLARÉE dans le noyau engine (`engine/flowCore`, zéro dépendance) ; ré-exportée ici pour les
 *  importeurs historiques de `./scene` (ConditionEditor, tests). */
export type { TemporalCondition } from '../engine/flowCore';

export interface Trigger {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  once?: boolean;
  /** Condition d'ENTRÉE (algèbre `Condition`, cf. `evalCondition`) — combinée en ET avec le `rect` et
   *  évaluée à l'entrée dans la zone. Absente = pas de garde (un pur événement horaire sans position =
   *  `delayedEffect`). Remplace les anciens `condition`/`temporalCondition`. */
  when?: Condition;
  /** LOGIQUE exécutée à l'entrée : séquence d'effets + branches `if`/`test` (exécutée par `runFlow`). */
  flow: Flow;
}

// Évaluation des conditions (flag/temporelle) : SOURCE UNIQUE `evalCondition` (src/state/flow.ts).
// Les anciens `condMet`/`temporalConditionMet` ont fondu dedans (algèbre de Conditions unifiée).

/** Membre d'une rencontre : RÉFÉRENCE une `SceneEntity` (kind 'personnage') de la scène — c'est
 *  ELLE qui porte le profil (ref/statblock/apparence/arme/label/facing/combat). Le membre n'ajoute
 *  que le contexte propre à CETTE rencontre (camp, monture). */
export interface EncounterMember {
  /** id de la `SceneEntity` enrôlée. */
  entityId: string;
  /** Camp au spawn : 'ally' pose un combattant du côté des héros (ex. monture prêtée). Défaut 'enemy'. */
  side?: 'enemy' | 'ally';
  /** Combat monté (LDB 14) : cet acteur est une MONTURE rideable (peut être enfourché). */
  mount?: boolean;
  /** id d'entité de la monture chevauchée au spawn (pré-monté) — réf stable (≠ ancien index `rides`). */
  ridesEntityId?: string;
}

export interface EncounterDef {
  id: string;
  /** Membres référençant des entités de la scène (peuplés par l'éditeur, ou à l'authoring via
   *  `buildEncounter`). SOURCE UNIQUE lue par le runtime — chaque membre pointe une `SceneEntity`
   *  'personnage' qui porte tout le profil (ref/statblock/apparence/arme/`combat.hiddenUntilCombat`). */
  members?: EncounterMember[];
  /** Scène/flag déclenché à la victoire — Flow (UN seul format avec `Trigger.flow`/`DialogueChoice.flow`).
   *  Aplati en `Effect[]` par `finishVictory` (la déférence transition/dialogue + la mesure de récompense
   *  restent sur la séquence plate). */
  onVictory?: Flow;
  /** Surprise (LDB 13 l.52-81) : camp pris en EMBUSCADE au début du combat. Les combattants de ce camp
   *  font un Test opposé de Perception vs la meilleure Discrétion des embusqueurs ; les vaincus gagnent
   *  l'État `Surpris`. Absent = personne n'est surpris. */
  surprise?: 'party' | 'enemies';
}

/** Un étage de la scène : sa cote `z` (0 = sol) et sa grille de tuiles (w×h aplatie). */
export interface Level {
  z: number;
  tiles: Terrain[];
  /** Élévation par case, PARALLÈLE à `tiles` (même indexation y·w+x), en unités d'étage : 1 = un
   *  plancher entier, 0.4 = scène surélevée, -0.5 = fosse d'orchestre en contrebas. Absent = tout au
   *  ras du niveau (0). Purement VISUEL/positionnel : ne change ni la profondeur (étage z) ni la
   *  marchabilité — un dénivelé léger est un gradin franchissable (les vraies chutes = effet `fall`). */
  elev?: number[];
}

/** Aire d'une zone d'effet : rectangle (`rect`) ou disque de Chebyshev (`disc`, rayon en CASES). */
export type ZoneArea =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'disc'; cx: number; cy: number; radius: number };

/** ZONE D'EFFET authorée (piège/hasard/aura environnementale). Payload = `GameOp[]` partagé avec les
 *  zones de Sort (vocabulaire unique, appliqué par `applyOps`). `onCross` se déclenche à la TRAVERSÉE
 *  (une case du chemin est dans l'aire), `perRound` au franchissement de Round pour qui STATIONNE dedans.
 *  Au moins l'un des deux. */
export interface SceneEffectZone {
  id: string;
  label: string;
  area: ZoneArea;
  blocksLoS?: boolean;
  onCross?: import('../engine/ops').GameOp[];
  perRound?: import('../engine/ops').GameOp[];
  /** BARRIÈRE infranchissable : aucune créature ne peut PÉNÉTRER dans l'aire (mur magique, cercle de
   *  ward). `blockGroups` vide/absent = bloque TOUT le monde ; sinon ne bloque que les créatures dont
   *  un Groupe correspond (ex. `['Démon', 'Mort-vivant']` = barrière sacrée, profanes tenus à l'écart —
   *  Protection de Phâ / Octogramme). Une créature DÉJÀ à l'intérieur peut sortir, pas re-rentrer. */
  barrier?: { blockGroups?: string[] };
}

export interface Scene {
  id: string;
  nom: string;
  description: string;
  dimensions: { w: number; h: number };
  /** Échelle métrique d'une CASE (m/case) — défaut 2 (person-scale). Une Scène MER (combat naval, MDG ch.13)
   *  vaut ~10 (1 pt de Distance = 10 m, `ch.13 l.362`) → le M des navires et les portées canon (50/75/150 m)
   *  tombent en nombres de cases jouables. Lue via `sceneMetresPerTile` ; consommée par les bandes de portée
   *  (`rangeBandAt`) et l'avance des navires. N'altère AUCUNE géométrie de rendu — seul le SENS d'une case change. */
  metresPerTile?: number;
  /** Décor : 'interieur' (éclairé en permanence, l'horloge ne l'assombrit pas) vs 'exterieur'
   *  (jour/nuit = horloge). Absent = extérieur. */
  ambiance?: 'interieur' | 'exterieur';
  /** Météo (LDB 14 l.94-116) — orthogonal à `ambiance`. Défaut 'clair'. Pénalise le combat
   *  (brouillard/tempête/neige) ; lu par `sceneCombatModifiers`. */
  weather?: 'clair' | 'pluie' | 'brouillard' | 'neige' | 'tempete';
  /** Niveau de lumière ambiante (brouillard de guerre) : `id` d'un `lightLevels` (jour/nuit/ténèbres…)
   *  ou `'auto'`/absent = suit l'horloge via `ambiance` (extérieur de nuit = sombre). Lu par `ambientScalar`. */
  ambientLight?: string;
  /** OFFRE DE REPOS de la scène (bouton 🌙 d'exploration → modale de Repos) : lieux disponibles
   *  (auberge/chez soi/camp, combinables) + qualité (piètre = ½ prix, nourriture à risque).
   *  Absent = camp seulement ; tout à false = repos interdit ici. La météo ci-dessus donne la
   *  sévérité d'Exposition d'une nuit dehors (engine/exposure). */
  rest?: { auberge?: boolean; maison?: boolean; camp?: boolean; quality?: 'normale' | 'pietre' };
  /** Offre de repos PAR ZONE (prioritaire sur `rest` là où le groupe se tient) — « paramétrable
   *  sur la zone » : le quartier de l'auberge offre des chambres, la place du marché non. */
  restZones?: { rect: { x: number; y: number; w: number; h: number }; places: { auberge?: boolean; maison?: boolean; camp?: boolean }; quality?: 'normale' | 'pietre' }[];
  /** ZONES D'EFFET posées sur la carte (éditeur) — PIÈGES / hasards / brasiers : tout combattant qui
   *  TRAVERSE (`onCross` : pic, flaque acide, glyphe) ou STATIONNE (`perRound` : nuage de poison,
   *  brasier) y subit l'effet (Dégâts/soin/États en `GameOp[]`). Converties en `BattleZone`
   *  PERMANENTES au début du combat — même runtime que les zones de Sort (Mur de feu, Grands feux).
   *  `blocksLoS` masque la Ligne de Vue (fumée, ténèbres). Contenu 100 % donnée : aucune zone codée en dur. */
  effectZones?: SceneEffectZone[];
  /** Musique de la scène — ids de pistes du registre audio (defs `music`). Champ absent/undefined
   *  = AUTOMATIQUE (intérieur/extérieur pour l'ambiance, piste de combat générique en combat) ;
   *  `null` = SILENCE forcé. Éditable dans l'éditeur (onglet Scène). */
  music?: { ambient?: string | null; combat?: string | null };
  /** Étages de la scène (multi-niveaux). Au moins un niveau ; `z:0` = le sol. Chaque niveau a sa
   *  propre grille aplatie de longueur w×h (ligne par ligne). Les niveaux z>0 sont des plateformes
   *  en surplomb (loges, galeries) reliées par des escaliers (cf. `stairs`). */
  levels: Level[];
  /** Escaliers reliant deux cases de niveaux différents (seuls points de franchissement vertical). */
  stairs?: { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number } }[];
  /** Murs sur ARÊTES de case (cloisons fines entre deux cases adjacentes) — bloquent le passage sans
   *  occuper de tuile, contrairement au terrain `mur`. Forme canonique : `side:'N'` = arête entre (x,y)
   *  et (x,y-1) ; `side:'E'` = arête entre (x,y) et (x+1,y). `door` = arête franchissable (porte). */
  walls?: WallSeg[];
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

/** Échelle métrique d'une case (m/case) — défaut 2 (person-scale, LDB). Source UNIQUE pour la couche Mer. PUR. */
export function sceneMetresPerTile(scene: { metresPerTile?: number } | null | undefined): number {
  return scene?.metresPerTile ?? 2;
}

/** La scène est-elle à l'échelle MER (combat naval OPÉRATIONNEL : navire-unité, équipage abstrait/passager) ?
 *  Proxy = case ≥ 4 m (vs 2 m person-scale du Pont/sol). Pilote le modèle navire-unité (cf. couche Mer ⇄ Pont). PUR. */
export function isMerScene(scene: { metresPerTile?: number } | null | undefined): boolean {
  return sceneMetresPerTile(scene) >= 4;
}

export const SCHEMA_VERSION = 2;

/** Grille de tuiles d'un niveau (défaut z=0 = sol). Repli sur le 1ᵉʳ niveau si `z` absent. */
export function levelTiles(scene: Scene, z = 0): Terrain[] {
  return (scene.levels.find((l) => l.z === z) ?? scene.levels[0]).tiles;
}

export function tileAt(scene: Scene, x: number, y: number, z = 0): Terrain {
  if (x < 0 || y < 0 || x >= scene.dimensions.w || y >= scene.dimensions.h) return 'mur';
  return levelTiles(scene, z)[y * scene.dimensions.w + x] ?? 'sol';
}

/** Élévation (décalage vertical SUB-niveau, en unités d'étage : 1 = un plancher) de la case (x,y) du
 *  niveau `z` : >0 surélevé (scène), <0 en contrebas (fosse). Hors-grille ou sans tableau `elev` → 0.
 *  Repli sur le 1ᵉʳ niveau si `z` absent, comme `tileAt`. */
export function elevAt(scene: Scene, x: number, y: number, z = 0): number {
  if (x < 0 || y < 0 || x >= scene.dimensions.w || y >= scene.dimensions.h) return 0;
  const lvl = scene.levels.find((l) => l.z === z) ?? scene.levels[0];
  return lvl.elev?.[y * scene.dimensions.w + x] ?? 0;
}

export function isWalkable(scene: Scene, x: number, y: number, z = 0): boolean {
  if (z === 0 && buildingBlockedAt(scene, x, y)) return false; // les bâtiments sont au sol
  if (entityBlockedAt(scene, x, y)) return false; // empreinte multi-cases d'un décor (foot {w,h})
  return terrainWalkable(tileAt(scene, x, y, z));
}

/** Mur sur ARÊTE de case. `side:'N'` = arête entre (x,y) et (x,y-1) ; `side:'E'` = arête entre (x,y)
 *  et (x+1,y). Les DIAGONALES `'\\'` (coin NO→SE) et `'/'` (coin NE→SO) tracent une cloison OBLIQUE en
 *  travers de la case (x,y) — pour les parois en éventail / courbes (purement VISUELLES : le déplacement
 *  reste orthogonal, géré par le sol / les arêtes N-E). `door` = franchissable (porte). `z` = étage. */
export type WallSide = 'N' | 'E' | '\\' | '/';
export interface WallSeg {
  x: number;
  y: number;
  side: WallSide;
  z?: number;
  door?: boolean;
  /** Porte FERMÉE par défaut à l'ouverture de la scène (bloque vue+passage tant qu'on ne l'ouvre pas).
   *  Absent = ouverte par défaut (comportement historique : une porte est une ouverture franchissable). */
  closed?: boolean;
  /** Structure destructible posée SUR l'arête (id de `structures.json`, ex. `porte-de-ville`). Tant
   *  qu'elle tient, l'arête bloque passage+vue comme un mur plein ; une fois ABATTUE (`structureIsDown`),
   *  l'arête devient une BRÈCHE franchissable et transparente. */
  structure?: string;
}

/** Clé de flag d'état d'une porte (`scene.flags`) — `true` = OUVERTE, `false` = FERMÉE (override runtime
 *  de l'état authored `closed`). Absent du flag = défaut authored (`!closed`). */
export function doorKey(x: number, y: number, side: WallSide, z = 0): string {
  return `__door_${x}_${y}_${side}_${z}`;
}

/** Une porte est-elle OUVERTE ? Flag runtime (`scene.flags[doorKey]`) prioritaire, sinon défaut authored
 *  (`!seg.closed`). Une porte ouverte ne bloque ni la vue ni le passage ; fermée, elle bloque les deux. */
export function doorIsOpen(scene: Pick<Scene, 'flags'>, seg: WallSeg): boolean {
  const f = scene.flags?.[doorKey(seg.x, seg.y, seg.side, seg.z ?? 0)];
  return f !== undefined ? f : !seg.closed;
}

/** Le segment de PORTE sur l'arête (x,y,side,z), ou undefined. */
export function doorAt(scene: Pick<Scene, 'walls'>, x: number, y: number, side: WallSide, z = 0): WallSeg | undefined {
  return scene.walls?.find((w) => !!w.door && w.x === x && w.y === y && w.side === side && (w.z ?? 0) === z);
}

/** Pose l'état OUVERT/FERMÉ d'une porte (flag runtime) — renvoie une NOUVELLE Scène (réf changée →
 *  recompute de la vue + re-rendu). No-op (même réf) si pas de porte à cette arête. PUR. */
export function setDoorOpen<S extends Pick<Scene, 'walls' | 'flags'>>(scene: S, x: number, y: number, side: WallSide, z: number, open: boolean): S {
  if (!doorAt(scene, x, y, side, z)) return scene;
  return { ...scene, flags: { ...scene.flags, [doorKey(x, y, side, z)]: open } };
}

/** Bascule une porte (ouverte ↔ fermée). PUR (nouvelle Scène). */
export function toggleDoorIn<S extends Pick<Scene, 'walls' | 'flags'>>(scene: S, x: number, y: number, side: WallSide, z = 0): S {
  const seg = doorAt(scene, x, y, side, z);
  if (!seg) return scene;
  return setDoorOpen(scene, x, y, side, z, !doorIsOpen(scene, seg));
}

/** Clé de flag d'état d'une structure d'arête (`scene.flags`) — présent & `true` = ABATTUE (brèche).
 *  Absent = défaut intact (une structure neuve tient ; pas de couche authored à inverser, à la différence
 *  d'une porte qui peut être `closed` au départ). */
export function structureDownKey(x: number, y: number, side: WallSide, z = 0): string {
  return `__struct_down_${x}_${y}_${side}_${z}`;
}

/** La structure de cette arête est-elle ABATTUE ? Flag runtime override ; absent = intacte (false). Une
 *  structure abattue ne bloque plus ni la vue ni le passage (la brèche est ouverte). */
export function structureIsDown(scene: Pick<Scene, 'flags'>, seg: WallSeg): boolean {
  return scene.flags?.[structureDownKey(seg.x, seg.y, seg.side, seg.z ?? 0)] === true;
}

/** Le segment portant une STRUCTURE sur l'arête (x,y,side,z), ou undefined. */
export function structureAt(scene: Pick<Scene, 'walls'>, x: number, y: number, side: WallSide, z = 0): WallSeg | undefined {
  return scene.walls?.find((w) => !!w.structure && w.x === x && w.y === y && w.side === side && (w.z ?? 0) === z);
}

/** Pose l'état ABATTU/INTACT d'une structure d'arête (flag runtime) — renvoie une NOUVELLE Scène. No-op
 *  (même réf) si aucune structure n'est posée sur l'arête. PUR. */
export function setStructureDown<S extends Pick<Scene, 'walls' | 'flags'>>(scene: S, x: number, y: number, side: WallSide, z: number, down: boolean): S {
  if (!structureAt(scene, x, y, side, z)) return scene;
  return { ...scene, flags: { ...scene.flags, [structureDownKey(x, y, side, z)]: down } };
}

/** Une arête est-elle OUVERTE (ne bloque NI passage NI vue) ? Prédicat CANONIQUE unique des deux modes
 *  d'ouverture : porte ouverte OU structure abattue. Sinon l'arête bloque (mur plein, porte fermée,
 *  structure intacte). Les lecteurs de franchissabilité/transparence (`wallBetween`, `buildOpaque`) s'y
 *  branchent — pas de réimplémentation par site. */
export function wallIsOpen(scene: Pick<Scene, 'flags'>, seg: WallSeg): boolean {
  return (!!seg.door && doorIsOpen(scene, seg)) || (!!seg.structure && structureIsDown(scene, seg));
}

/** Arête CANONIQUE (cellule + side N/E) séparant deux cases ADJACENTES en cardinal — null si non
 *  adjacentes. L'arête entre (x,y) et (x,y+1) est le `N` de (x,y+1) ; entre (x,y) et (x+1,y) le `E` de (x,y). */
export function edgeOf(ax: number, ay: number, bx: number, by: number): { x: number; y: number; side: 'N' | 'E' } | null {
  if (by === ay && bx === ax + 1) return { x: ax, y: ay, side: 'E' };
  if (by === ay && bx === ax - 1) return { x: bx, y: by, side: 'E' };
  if (bx === ax && by === ay + 1) return { x: bx, y: by, side: 'N' };
  if (bx === ax && by === ay - 1) return { x: ax, y: ay, side: 'N' };
  return null;
}

/** Un mur sépare-t-il deux cases adjacentes du même étage ? (bloque le passage, pas la case). Un mur
 *  plein bloque toujours ; une PORTE bloque seulement si elle est FERMÉE, une STRUCTURE seulement tant
 *  qu'elle TIENT — les deux modes d'ouverture sont réunis par `wallIsOpen`. */
export function wallBetween(scene: Scene, ax: number, ay: number, bx: number, by: number, z = 0): boolean {
  if (!scene.walls?.length) return false;
  const e = edgeOf(ax, ay, bx, by);
  if (!e) return false;
  return scene.walls.some(
    (w) => w.x === e.x && w.y === e.y && w.side === e.side && (w.z ?? 0) === z && !wallIsOpen(scene, w),
  );
}

export function emptyScene(w = 20, h = 15): Scene {
  return {
    id: `scene-${Date.now()}`,
    nom: 'Nouvelle scène',
    description: '',
    dimensions: { w, h },
    ambiance: 'exterieur',
    levels: [{ z: 0, tiles: new Array(w * h).fill('herbe') }],
    entities: [],
    buildings: [],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}

/** `ambiance` ne distingue qu'intérieur vs extérieur (le jour/nuit vient de l'horloge). Absent → extérieur. */
export function normalizeAmbiance(a: Scene['ambiance']): 'interieur' | 'exterieur' {
  return a === 'interieur' ? 'interieur' : 'exterieur';
}

/** Scène en intérieur (éclairée — l'obscurité de l'horloge ne s'y applique pas). */
export function isIndoor(scene: Pick<Scene, 'ambiance'>): boolean {
  return normalizeAmbiance(scene.ambiance) === 'interieur';
}
