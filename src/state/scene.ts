/**
 * Schéma de Scène/Niveau — contrat UNIQUE partagé par :
 *  - l'éditeur de niveau (lecture/écriture),
 *  - le runtime (exploration + combat),
 *  - le contenu de campagne (livré comme documents de scène à ce format).
 *
 * Aucune scène n'est codée « en dur » : la campagne est de la donnée.
 */
import { CharKey, Difficulty } from '../engine/types';
import type { AuthoredShipPoste, NavalTraitRef } from '../engine/types';
import type { EntityAppearance } from '../engine/authoringAppearance';
import { sanitizeFlow, type Flow, type Condition, type EffectOp } from './flow';
import { type DayPhaseKey, type ScheduleSpec } from '../engine/clock';
import type { ThreatTier } from '../engine/advantagePool';
import type { Dir8 } from './dir8';
import { terrainWalkable } from './terrain';
import { entityBlockedAt } from './sceneRules';
import { type Grade, gradeBetween } from './relief';

/** Un terrain est un id de catalogue (cf. src/state/terrain.ts). */
export type Terrain = string;

export type Facing = 'N' | 'S' | 'E' | 'O';

/**
 * Rôle d'une entité de scène. `personnage` = tout être animé (apparence libre
 * via `ref` + dialogue/quête optionnel) — fusion des anciens `pnj`/`ennemi`,
 * que le combat (encounters) et l'interaction (dialogueId) ne distinguaient pas.
 */
export type EntityKind = 'heroStart' | 'personnage' | 'prop';

/** Statbloc personnalisé (PNJ/bête custom d'éditeur) — moteur pur, `engine/statblock.ts` (#614) :
 *  `LivingRef` (`engine/possession.ts`) porte la même dualité bestiaire|custom que ce type. */
import type { CustomStatblock } from '../engine/statblock';
import type { LivingRef } from '../engine/possession';
export type { CustomStatblock };

export interface SceneEntity {
  id: string;
  kind: EntityKind;
  pos: { x: number; y: number };
  /** Couche d'empilement (cf. `layers`). 0 ou absent = couche de base ; >0 = posée sur une couche
   *  supérieure, rendue soulevée à la hauteur métrique de sa case, triée par-dessus la couche inférieure. */
  z?: number;
  /** Orientation MONDE (8 directions) — éditable, projetée au rendu (project + camRot). */
  facing?: Dir8;
  label?: string;
  /** Référence au bestiaire (personnage) ou au catalogue de décor (prop, cf. PROPS). */
  ref?: string;
  /** Profil personnalisé (sinon on utilise `ref`). */
  statblock?: CustomStatblock;
  /** Id d'un preset de PNJ nommé du bloc `narratif.presetsPnj` (#671). Présent = l'entité est
   *  INSTANCIÉE « base globale + surcharges embarquées » (le preset porte `base`/`profil`/`apparence`),
   *  et non depuis `ref`/`statblock` — frontière RÉFÉRENCE vs NARRATIF (le PNJ nommé vit dans le
   *  paquet de campagne, réfère la règle globale par id). Résolu par `resolvePresetCreature`. */
  presetId?: string;
  /** Coque/navire : `id`s des entités d'ÉQUIPAGE exposées à bord (MDG 14) — posés sur le Combattant au spawn. */
  crewIds?: string[];
  /** Coque/navire : pièces d'artillerie MONTÉES (postes AUTHORÉS par réf catalogue, MDG 12-13) —
   *  HYDRATÉES au spawn (`hydratePoste`) sur le Combattant-coque, puis `applyShipPostes` sert chaque poste
   *  à son chef de pièce. La base n'est PAS matérialisée dans la scène (#222). */
  postes?: AuthoredShipPoste[];
  /** Coque/navire : **Améliorations d'INSTANCE** (MDG 12, réfs par id ex. `{ id: 'blindage-fer' }`) —
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
  /** Arme ÉQUIPÉE : `trappingId` STABLE du catalogue d'armes — affichée par le rig (tenue prête si à
   *  distance). Ex. `'arbalete'`. Résolue par `weaponFromId` (lookup exact, warn si hors catalogue). */
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
  /** OVERRIDES par-entité des 3 règles maison Marché (LDB 59/60, `market-guild`/`market-mode`/
   *  `market-tenir-comptes`) — mêmes domaines de valeurs que la règle globale correspondante. Absent =
   *  HÉRITAGE du global (`engine/policy` `rule(...)`), jamais un 3ᵉ état ambigu. Lus par `marketRule`
   *  (state/merchantFlow, couture UNIQUE). */
  merchant?: { archetype: string; settlement?: import('../engine/disponibilite').Settlement; resaleRate?: number; buyMarkup?: number; restockDays?: number;
      guild?: boolean; marketMode?: 'complet' | 'sans-disponibilite' | 'sans-marchandage' | 'simplifie'; tenirComptes?: boolean };
  /** RÔLE combat optionnel (au même titre que dialogue/marchand) : présent = ce personnage peut être
   *  enrôlé dans une rencontre (cf. EncounterMember). Porte les choix d'auteur qui DÉCRIVENT la
   *  personne au combat — son profil (ref/statblock) et son apparence vivent déjà sur l'entité. */
  combat?: {
    /** OPTIONNELS choisis (LDB 76 l.45) : `TraitInstance` fusionnés au spawn OU notes composées
     *  (joker « tous les traits », variante « swap » retirant des Traits + octroyant un bonus, ZI). */
    optionals?: import('../engine/statEntry').OptionalEntry[];
    /** Sorts connus (ids de spells.json, créature `ref`) — choix d'auteur (la donnée bestiaire n'en liste pas). */
    spells?: string[];
    /** Caractéristiques aléatoires au spawn (LDB 77 l.108 : −10 + 2d10, graine stable par id). */
    randomChars?: boolean;
    /** Compétences d'AUTEUR ajoutées (réfs `SkillRef`) — fusionnées par-dessus celles du bestiaire au spawn.
     *  Qualifie p.ex. un servant de pièce pour le Groupe de Projectiles APPROPRIÉ à son engin (AA 10 p.122 l.3900). */
    skills?: import('../data').SkillRef[];
    /** Invisible en EXPLORATION (embuscade) : n'apparaît qu'au combat. `false`/absent = PNJ visible
     *  qui devient hostile au déclenchement. */
    hiddenUntilCombat?: boolean;
  };
}

/** Couverture d'un bâtiment composé (matériau du toit). */
export interface RoofParams {
  roofMaterial?: 'tuile' | 'chaume' | 'ardoise';
}

/** TOIT d'un bâtiment COMPOSÉ — la structure réelle est faite de murs d'arête (`WallSeg`, destructibles
 *  via `structure`) sur un sol de terrain ; ce `Roof` n'est qu'une pièce de RENDU couvrant l'empreinte
 *  enclose. PAS un combattant : « bâtiment détruit » = ses murs abattus. Intérieur TOUT-EN-SCÈNE (cutaway) :
 *  le toit se lève quand un allié est dans l'empreinte (`roofHidden`) — plus aucune scène-intérieur séparée. */
export interface Roof {
  id: string;
  foot: { x: number; y: number; w: number; h: number };
  /** Couche couverte (défaut 0). */
  z?: number;
  /** Preset de style (toit + façade), ex. 'maison' | 'taverne' | 'forge' — catalogue des presets de toit. */
  style: string;
  params?: RoofParams;
  label?: string;
}

export type Effect =
  | { type: 'setFlag'; flag: string; value?: boolean }
  /** Pose/met à jour un OBJECTIF courant (surface « je fais quoi maintenant ? », #238) sur la pile
   *  `store.objectives`, keyé par `id` STABLE : re-poser le même `id` MET À JOUR son `text`. Le HUD
   *  affiche le plus récent. Archivé aussi au journal. Échéance optionnelle (même `ScheduleSpec` que
   *  `delayedEffect`) → pose `Objective.deadline` (minute absolue) → compte à rebours dans le bandeau. */
  | ({ type: 'setObjective'; id: string; text: string } & ScheduleSpec)
  /** Retire un objectif de la pile : `id` précis, ou TOUS si absent (fin d'acte). */
  | { type: 'clearObjective'; id?: string }
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
  /** Donne une POSSESSION (bête/serviteur/véhicule — le SOCLE POSSESSIONS #615, registre
   *  `GameState.possessions`) à un héros propriétaire (défaut : le premier — même patron que
   *  `giveTrapping.heroId`, §4.3). `ref` réutilise `LivingRef` (bête/serviteur, bestiaire OU statbloc
   *  custom) ou `{vehicleId}` (véhicule, catalogue `vehicles.json`). */
  | { type: 'givePossession'; nature: 'bete' | 'serviteur' | 'vehicule'; ref: LivingRef | { vehicleId: string }; heroId?: string }
  | { type: 'giveMoney'; gold?: number; silver?: number; brass?: number }
  /** Octroie des Points d'Expérience à TOUT le groupe (XP de session, identique pour tous). Support
   *  générique de l'attribution événementielle par scénario (PDT 13 l.5) : chaque scénario/campagne
   *  authore ses propres octrois via cette action, à tout point narratif (victoire, objectif, dialogue…). */
  | { type: 'giveXp'; amount: number }
  | { type: 'startCombat'; encounter: string }
  /** Combat de masse / Puissance de Bataille (ADE II 8) : ouvre l'écran de bataille sur le
   *  `MassBattleSpec` AUTHORÉ (armées, Rounds prévus, situations de Scènes par Round, rencontres des
   *  Scènes de combat, modificateur permanent). Appliqué par le store `startMassBattle` (state/massBattleFlow). */
  | { type: 'startMassBattle'; battle: import('./massBattleFlow').MassBattleSpec }
  | { type: 'transition'; scene: string; entry?: string }
  /** Retour à la scène précédente (sortie d'intérieur), à la case d'entrée. */
  | { type: 'transitionBack' }
  /** Ouvre le dialogue scripté `dialogue`. `speakerId` (optionnel) = id d'une `SceneEntity` de la
   *  scène courante → son PORTRAIT et son NOM (label) pour toute la session de dialogue, tant qu'un
   *  nœud ne porte pas son propre `speakerId` (cf. `DialogueNode.speakerId`). */
  | { type: 'startDialogue'; dialogue: string; speakerId?: string }
  | { type: 'journal'; text: string }
  | { type: 'document'; title: string; text: string }
  /** Mécanique MAISON du carnet d'enquête (#670, aucune règle RAW) : révèle/avance un `Indice` de
   *  `campaignNarratif`. `stade` omis → premier stade si l'indice est encore caché, sinon no-op. */
  | { type: 'revealClue'; indiceId: string; stade?: string }
  /** Écarte un indice comme fausse piste (barré, relisible au carnet) — mécanique MAISON (#670). */
  | { type: 'discreditClue'; indiceId: string }
  /** Test ÉTENDU (LDB 12 l.172-174) : un acteur cumule des DR Round par Round jusqu'à `targetDR`
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
  /** Effet PROGRAMMÉ (Lot 0, étendu #668) : `flow` est appliqué quand l'horloge atteint l'échéance,
   *  résolue par `scheduleAt` (`engine/clock`) selon la `ScheduleSpec` fournie — priorité `atDate`
   *  (date impériale absolue) > `afterDays` (« J+N », à `atHour:atMinute`, défaut minuit) >
   *  `afterMinutes` (compte à rebours relatif : mèche de bombe) > `atHour`/`atMinute` seuls (prochaine
   *  occurrence de cette heure du jour). Annulé si `cancelFlag` est posé avant l'échéance
   *  (désamorçage). Déclenché au FRANCHISSEMENT dans `advanceTime` (le temps avance par actions
   *  discrètes : un événement programmé entre deux pas se déclenche dès le pas qui le dépasse). */
  | ({ type: 'delayedEffect'; flow: Flow; cancelFlag?: string } & ScheduleSpec)
  /** Ouvre la boutique d'une entité marchande (par son id) — permet d'inclure le Marchand dans un
   *  dialogue (ex. choix « Montrez-moi vos marchandises »). L'entité doit porter `merchant` (#2). */
  | { type: 'openMerchant'; entityId: string }
  /** Ouvre le PORT d'un lieu de la carte du monde (MDG 15) — SCRIPTÉ (arrivée mise en scène, cinématique
   *  de quête) sur le MÊME chemin que l'accostage en mer (`openPortAt`, state/seaVoyageFlow) : avec profil
   *  de port → relâche à terre en attente de décision (`pendingShoreLeave`) ; sans profil → transition
   *  directe. `placeId` = id d'un `MapPlace` de `state.worldMap`. */
  | { type: 'openPort'; placeId: string }
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
   *  pitance, prix RAW calculés (LDB 66 : commune 10 sc, privée 10 pa pour 2, repas 1 pa —
   *  débit dans la modale), puis bilan globalisé (Exposition dehors, récupération, cauchemars,
   *  contagion). `lodging` : contexte du lieu (auberge/chez soi/campement) ; `quality: 'pietre'`
   *  = ½ prix mais nourriture à risque (Courante galopante 10 %, ch.66 l.51). LEGACY : sans
   *  `lodging`, contexte « maison » (gratuit — prix porté par le choix de dialogue). */
  | { type: 'rest'; days?: number; lodging?: 'auberge' | 'maison' | 'camp'; quality?: 'normale' | 'pietre' }
  /** Repas (#T2 — auberge, hôte généreux…) : nourrit TOUT le groupe pour la journée SANS consommer de
   *  ration — remet les compteurs/malus de Faim à zéro (LDB 18 l.337-343). Le prix éventuel (« Repas,
   *  auberge », LDB 66 p.302) est porté par le CHOIX de dialogue (`DialogueChoice.cost`), pas par l'effet. */
  | { type: 'mealParty' }
  /** Inflige le trauma « Cauchemars » (LDB 21 l.92) à un héros (défaut : le premier) après une scène
   *  marquante : chaque nuit, Test de Calme Facile (+40) ou Exténué. L'auteur l'assigne (pas inventé). */
  | { type: 'inflictNightmares'; heroId?: string }
  /** Trauma (ADE II Annexe I « Troubles psychologiques », règle facultative `psych-acquisition-optional`) :
   *  un héros TÉMOIN d'un événement rendant une de ses Ambitions complètement irréalisable → Test de Calme
   *  Accessible (+20) ; échec → Trait psychologique *Trauma*. Déclencheur NARRATIF (aucun hook mécanique),
   *  donc posé par l'auteur (défaut : le premier héros). Inerte si la règle facultative est éteinte. */
  | { type: 'ambitionLost'; heroId?: string }
  /** Source de PEUR/TERREUR scénique (LDB 21) — une apparition, un présage, une vision d'horreur mise en
   *  scène par l'auteur (PAS un PNJ de la scène : hors combat, la Peur/Terreur de créature ne se teste QUE
   *  scriptée, cf. `engine/encounterPsych`). Ouvre la MÊME cascade de Tests de Calme que la Psychologie de
   *  rencontre (`openScriptedPsych`, applier `'encounterPsych'` partagé) — jamais un jet silencieux. Cible :
   *  `party` ou `hero` (+`heroId`, défaut le premier). */
  | { type: 'inflictPsychology'; kind: 'peur' | 'terreur'; indice: number; label: string; target?: 'party' | 'hero'; heroId?: string }
  /** Inflige une Maladie (LDB 20) à un héros (défaut : le premier) — nourriture avariée, contact infecté,
   *  morsure… L'auteur choisit la maladie (DISEASE_DEFS) ; incubation/durée sont tirées à la contraction. */
  | { type: 'inflictDisease'; disease: string; heroId?: string }
  /** Impose la Faim (LDB 18 l.337-343) : `days` échecs de Test de Faim déjà encaissés — 1ᵉʳ → −10 F/E ;
   *  2ᵉ+ → −10 aux autres Caractéristiques + 1d10 Dégâts (ignore les PA, min 1). Pour scénariser un groupe
   *  affamé (siège, cachot, traversée sans vivres). Cible : `party` ou `hero` (+`heroId`, défaut le premier). */
  | { type: 'inflictHunger'; days?: number; target?: 'party' | 'hero'; heroId?: string }
  /** Impose la Soif (LDB 18 l.340, miroir de la Faim) : `days` échecs de Test de Soif déjà encaissés —
   *  1ᵉʳ → −10 Int/FM/Soc ; 2ᵉ+ → −10 aux autres Caractéristiques + 1d10 Dégâts (ignore les PA, min 1).
   *  Moteur partagé `applySoifTest` (engine/provisions), zéro logique nouvelle. Cible : `party` ou `hero`
   *  (+`heroId`, défaut le premier). */
  | { type: 'inflictThirst'; days?: number; target?: 'party' | 'hero'; heroId?: string }
  /** Exposition au froid ou à la chaleur (LDB 18 l.326-334) : `count` Tests de Résistance (Intermédiaire),
   *  échecs en cascade (froid : −10 CT/Ag/Dex, puis −10 le reste, puis 1d10 Dégâts ignorant les PA, Inconscient
   *  à 0 PB ; chaleur : −10 Int/FM + Exténué, puis −10 le reste + Exténué, puis 1d10). Pour une nuit glaciale,
   *  un désert, une tempête. Cible : `party` ou `hero` (+`heroId`, défaut le premier). */
  | { type: 'exposureNight'; kind: 'froid' | 'chaleur'; count?: number; target?: 'party' | 'hero'; heroId?: string }
  | { type: 'inflictTrauma'; kind: 'dechirure' | 'fracture' | 'amputation'; severity?: 'mineur' | 'majeur'; location: import('../engine/types').HitLocation; heroId?: string }
  /** EFFECTOP — pont UNIQUE entre la logique authorée (Flow) et le moteur mécanique des sorts : applique
   *  des `GameOp` à une cible (`party`/`hero` scène, ou `caster`/`target` incantation). Type défini dans
   *  le noyau engine (`engine/flowCore` — c'est aussi la feuille PAR DÉFAUT du `Flow<E>` générique) ;
   *  l'union `Effect` ci-dessous l'inclut comme l'un de ses membres. */
  | EffectOp
  /** Souffle de ZONE (Lot 3) centré sur une case : tous les combattants à `radius` cases (Chebyshev)
   *  — en combat par position, hors combat le groupe (à partyPos) — subissent les `ops` (vocabulaire
   *  unique `GameOp`, appliquées par `applyOps` cible par cible). Bombe, grenade, piège de zone…
   *  Dégâts BRUTS par défaut (`op:'wounds'` ignore BE+PA) ; mitiger = `{ignoreTB:false, ignoreAP:false}`. */
  | { type: 'zoneBlast'; center: { x: number; y: number }; radius: number; ops: import('../engine/ops').GameOp[] }
  /** Chute (LDB 15 l.80-84) : la cible tombe de `metres` mètres → 3 Dégâts/mètre + 1d10, réduits par
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
  /** Repositionne (ANIMÉ) ou RETIRE une entité de scène posée — mise en scène scriptée (#701 : fuite,
   *  entrée, disparition d'un figurant). `to` = case cible (repositionnement) ; `remove` = l'entité
   *  quitte la scène (après `to` si fourni = fuite-puis-disparition). Entité introuvable = no-op. */
  | { type: 'moveEntity'; id: string; to?: { x: number; y: number }; remove?: boolean }
  /** Son PONCTUEL (cloche de minuit, cri hors-champ…) — id du registre audio (#701). */
  | { type: 'playSfx'; id: string }
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
  /** Exposition HYDRIQUE (MSRC 16 p.91 — « Maladies transmises par l'eau ») : Test de **Résistance
   *  Intermédiaire (+0)** modifié (tableau 1 « Source d'eau » = `source`, choix d'auteur de la zone
   *  d'eau ; tableau 2 « Blessures et États » DÉRIVÉ du héros, immersion seule) ; raté → d100 « +10
   *  pour chaque DR négatif » → maladie CONTRACTÉE directement (le Test d'exposition EST le test —
   *  jamais un second Test de Contraction). `mode` : `ingestion` (boire de l'eau non bouillie, l.5) /
   *  `immersion` (chute/nage, blessures ouvertes, l.7-9). Cible : `party` ou `hero` (+`heroId`). */
  | { type: 'waterExposure'; mode: import('../data').WaterExposureMode; source?: string; target?: 'party' | 'hero'; heroId?: string }
  /** Enseigne un sort SANS coût en PX (trouvaille de campagne : grimoire d'un maître, parchemin…).
   *  Cible : héros désigné, sinon le premier dont un Talent rend le sort apprenable. L'apprentissage
   *  PAYANT passe par l'onglet Avancement (buySpell, LDB 46 l.44-47). */
  | { type: 'learnSpell'; spell: string; heroId?: string }
  /** Incantation SCRIPTÉE (#98) : rituel scénique, piège magique, PNJ qui lance à un beat précis (dialogue,
   *  trigger, effet différé). `casterId`/`targetId` = id STABLE d'un combattant — un combattant EN COMBAT
   *  (`Combatant.id === SceneEntity.id`) ou un héros du GROUPE hors combat (`actorIn`, state/combatOrParty) ;
   *  un PNJ hors combat n'a pas de Combatant à faire incanter — pas de pseudo-combat inventé pour ce cas
   *  (le lanceur doit alors être en combat). `targetId` absent = le lanceur (soi/zone). `mode:'jet'`
   *  (défaut) route par le flux d'incantation STANDARD (`castSpell`, cadence-aware ; modale influençable
   *  si le lanceur est piloté par un humain — jamais un jet silencieux). `mode:'forceSuccess'` = arbitrage
   *  D'AUTEUR explicite (rituel garanti, sans jet) : applique directement les effets du sort (`GameOp`,
   *  `ctx.caster` = le lanceur) — dérogation VOULUE, jamais un défaut. */
  | { type: 'castSpell'; casterId: string; spellId: string; targetId?: string; mode?: 'jet' | 'forceSuccess' }
  /** « Petites Prières » (LDB 25 l.22-24, option `prayer-petites`) : posé sur un SITE SACRÉ (autel,
   *  sanctuaire). Un personnage NON Béni y prie : 1d100 secret, exaucé sur 01 (pourcentage relevé s'il
   *  possède la Compétence Prière). Exaucée → le `reward` (Flow authoré : bonus, don, flag…) s'applique ;
   *  sinon rien. Cible : `heroId`, sinon le premier héros vivant non Béni. Sans effet hors du toggle. */
  | { type: 'petitePriere'; heroId?: string; reward: Flow }
  /** FIN DE SÉANCE (LDB 05 Ambitions l.793-841 + LDB 17 Détermination l.81) : ouvre l'écran de fin de
   *  séance EXISTANT (`SessionEndModal`) où le MJ/les joueurs cochent les Ambitions accomplies et les
   *  Motivations suivies — l'octroi (PX +50/+500, Détermination, Chance restaurée) passe par `endSession`
   *  (state/partyFlow), déjà câblé derrière cette modale. À poser en fin de chapitre par l'auteur (#83). */
  | { type: 'sessionEnd' }
  /** CRÉATION DE PERSONNAGE (#83) : ouvre l'assistant EXISTANT (`src/ui/creator/`) pour un NOUVEAU héros
   *  (comme le bouton « + » de l'écran Groupe) — un remplaçant scénarisé, un compagnon rejoignant le groupe.
   *  Navigue vers l'écran `creator` (`setEditingHero(null)` + `setScreen('creator')`). */
  | { type: 'openCharacterCreator' }
  /** « Entre deux aventures » (LDB 22-23, Jalon 5) : ouvre l'interlude — Événement d100 par héros,
   *  min(3, semaines) Activités chacun, puis Argent à gaspiller et le temps passe. À poser en fin
   *  de chapitre par l'auteur de campagne. */
  | { type: 'interlude'; weeks?: number }
  /** Faveur (LDB 23 l.139-153, #509) : contrepartie future acceptée en échange d'une aide
   *  immédiate — Faveur de départ de campagne, ou octroi narratif hors flux d'Activité. Cible :
   *  héros désigné, sinon le premier héros vivant du groupe (la source parle au singulier « vous »,
   *  l.141 « votre Niveau » : la Faveur est due par UN héros, pas le groupe). */
  | { type: 'grantFavor'; heroId?: string; level: import('./favorFlow').FavorLevel; owedTo: string; desc: string }
  /** Poursuite TERRESTRE jouable (LDB 15 l.87-109) — à poser sur un trigger/dialogue (« ils prennent la
   *  fuite », « rattrapez-les ! »). `partyRole` : le groupe FUIT (défaut) ou POURSUIT ; l'autre camp est
   *  décrit par `foes` (Mouvement + valeur de Test de Mouvement de chaque adversaire). `distance` de départ
   *  (1-8, l.500-504), `escapeAt` = seuil d'évasion (défaut 10, l.520). `skill` = Compétence de Mouvement
   *  testée (id : Athlétisme à pied / Chevaucher / Conduite d'attelages). `encounter` = rencontre ouverte au
   *  RATTRAPAGE (Distance ≤ 0 → combat). Jouée manche par manche par la cascade influençable (state/pursuitFlow),
   *  MÊME dramaturgie que la poursuite navale (MDG 13). */
  | { type: 'startPursuit'; partyRole?: 'fleeing' | 'pursuing'; distance: number; escapeAt?: number; skill: string; foes: import('./pursuitFlow').PursuitFoe[]; encounter?: string }
  /** Ouvre les JEUX DE TAVERNE (NADJ 16, option `tavern-games`) — à poser sur un choix de dialogue
   *  d'aubergiste (« Une partie ? ») ou une entité de taverne. Sans effet si l'option est éteinte. */
  | { type: 'openTavernGames' }
  /** Ouvre la CARTE DU MONDE (#T2) — à poser sur la porte/route d'un lieu (« partir en voyage »).
   *  Sans effet si le projet n'a pas de carte ou en combat. */
  | { type: 'openWorldMap' }
  /** Dote le groupe d'un NAVIRE DE CAMPAGNE (`state.vessel`, MDG 13-15) — à poser quand le groupe
   *  reçoit/achète un bateau (don d'un patron, chantier). `vehicleId` = un navire de `vehicles.json`
   *  (facette `ship`) ; Moral et Blessures de coque INITIAUX authorés (coque neuve = pas de `wounds`).
   *  Le navire survit aux jours et aux combats (le voyage maritime et le Port en repartent). */
  | { type: 'setVessel'; vehicleId: string; label?: string; morale?: number; hullCurrent?: number; hullMax?: number; saboteurDR?: number; waterLitres?: number; provisions?: number; crew?: import('../engine/crewMorale').CrewHire[] }
  /** Fait varier l'HUMEUR DE MANANN du navire de campagne (MDG 15 l.83-125) — à poser sur une
   *  bénédiction de prêtre, un sacrifice ou tout événement narratif d'auteur. `factorId` = un facteur
   *  du tableau « EFFET SUR L'HUMEUR DE MANANN » (`sea-events.json`, appliqué UNE SEULE FOIS par
   *  navire — `applyManannFactor`, l.85) ; `delta` = un ajustement chiffré libre hors-tableau (ex.
   *  « Fête de Manann » 2d10) — mutuellement exclusifs, `factorId` prioritaire si les deux sont posés.
   *  Sans navire de campagne → no-op journalisé. */
  | { type: 'adjustManann'; factorId?: string; delta?: { flat: number; d10: number; sign: 1 | -1 } }
  /** AJUSTE le navire de campagne EXISTANT (#233) — patch des SEULS champs fournis, contrairement à
   *  `setVessel` (remplacement total : effacerait Humeur de Manann/dégâts/Moral accumulés). À poser
   *  sur un événement narratif qui touche PARTIELLEMENT le navire (ex. démasquage d'un saboteur qui
   *  remet `saboteurDR` à 0 sans réinitialiser le reste). Sans navire de campagne → no-op journalisé. */
  | { type: 'adjustVessel'; label?: string; morale?: number; hullCurrent?: number; hullMax?: number; saboteurDR?: number; waterLitres?: number; provisions?: number; crew?: import('../engine/crewMorale').CrewHire[] }
  | { type: 'endDialogue' };

export interface DialogueChoice {
  text: string;
  /** Icône d'affordance (registre `src/ui/icons/`, rendue par `<Icon>` dans `DialogueBox`) — jamais
   *  un emoji collé au `text` (#290, doctrine anti-emoji). Id de string brute (couture UI hors de
   *  `src/state`, cf. CLAUDE.md : la logique reste pure, `<Icon>` valide l'id au rendu). */
  icon?: string;
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
  /** Id d'une `SceneEntity` de la scène courante → son PORTRAIT et son NOM (label) pour CE nœud.
   *  Permet d'alterner les interlocuteurs dans une même conversation. À défaut, l'interlocuteur de
   *  SESSION (`state.dialogue.speakerId`, posé par `interactEntity` ou `startDialogue.speakerId`). */
  speakerId?: string;
  text: string;
  choices: DialogueChoice[];
}

export interface Dialogue {
  id: string;
  start: string;
  nodes: DialogueNode[];
}

/** Nom AFFICHÉ du locuteur d'un nœud : override par nœud puis speaker de session, résolu en label
 *  d'entité de la scène (jamais un nom en clair stocké, #669). `undefined` si aucun speaker. */
export function speakerLabel(
  entities: SceneEntity[],
  node: { speakerId?: string },
  dialogue: { speakerId?: string }
): string | undefined {
  const id = node.speakerId ?? dialogue.speakerId;
  return id ? entities.find((e) => e.id === id)?.label : undefined;
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
  /** PNJ allié piloté par l'IA (`Combatant.aiControlled`) : un allié qui AGIT SEUL (défenseur de siège,
   *  équipage d'une pièce…) au lieu d'être contrôlé par le joueur. Sans effet sur un membre 'enemy'. */
  ai?: boolean;
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
  /** Objectif de victoire (#197). Absent = `allEnemiesDead` (défaut historique). */
  victoryCondition?: VictoryCondition;
  /** Surprise (LDB 13 l.52-81) : camp pris en EMBUSCADE au début du combat. Les combattants de ce camp
   *  font un Test opposé de Perception vs la meilleure Discrétion des embusqueurs ; les vaincus gagnent
   *  l'État `Surpris`. Absent = personne n'est surpris. */
  surprise?: 'party' | 'enemies';
  /** Avantage initial — Manœuvrabilité (AA 11 l.53-65) : le camp indiqué possède un avantage de
   *  mouvement au début du combat (monté, terrain arboricole/aérien favorable…) → +2 à sa réserve
   *  d'Avantage en mode « Avantage de groupe » (`startAdvantagePools`). Absent = pas de circonstance. */
  maneuverability?: 'party' | 'enemies';
  /** Avantage initial — Menace (AA 11 l.53-65) : le camp `camp` représente une menace notoire pour
   *  l'autre camp (`tier` : dangereuse +1, très dangereuse +3, extrême +5) → crédite sa réserve
   *  d'Avantage en mode groupe. Absent = pas de circonstance. */
  threat?: { camp: 'party' | 'enemies'; tier: ThreatTier };
  /** Avantage initial — Terrain (AA 11 l.53-65) : le camp `camp` tient une position avantageuse
   *  (fortification/couvert léger/hauteur → +1 ; `heavy` : couvert lourd/position décisive type pont
   *  → +2) → crédite sa réserve d'Avantage en mode groupe. Absent = pas de circonstance. */
  terrain?: { camp: 'party' | 'enemies'; heavy?: boolean };
  /** Restriction d'armes à DISTANCE (#471) — Duel judiciaire (NADJ 06 l.181) : « les parties concernées
   *  […] ont normalement le libre choix des armes bien que la plupart des lois locales interdisent de
   *  faire appel à des projectiles. » DÉFAUT SÉMANTIQUE (#471 défaut 1) : « la plupart » = interdit PAR
   *  DÉFAUT quand `victoryCondition.type === 'firstBlood'` — champ ABSENT sur un duel = armes à distance
   *  INTERDITES ; l'auteur DÉROGE explicitement en posant `banRanged: false` (« pas toutes »). Champ
   *  SÉPARÉ de `victoryCondition` (une variante locale peut l'imposer à une rencontre qui n'est pas un
   *  `firstBlood`, valeur explicite `true`). Hors `firstBlood`, champ absent = armes à distance autorisées
   *  (défaut historique). Défaut résolu par `banRangedActive` (SEUL point), consommé par
   *  `resolveAttack`/`firedAttackBlock` (joueur ET IA). */
  banRanged?: boolean;
}

/** Une COUCHE d'empilement de la scène : son index discret `z` (0 = couche de base) — identité
 *  d'empilement, clé de pathfinding ET clé de tri de profondeur — et sa grille de tuiles (w×h aplatie).
 *  `height[]` est PARALLÈLE à `tiles` (indexation y·w+x) : la hauteur RÉELLE de la surface, en MÈTRES
 *  (échelle RAW 2 m/case, LDB 15 l.12). Absent = tout à 0 m. PORTEUSE (plus cosmétique) : pilote la
 *  marchabilité (rampe/falaise via `surfaceLink`), la distance/−10 en combat et la chute. Le RENDU pose
 *  la tuile au lift métrique (`metricToLift(height)`) ; le TRI garde `z` (occlusion dessus/dessous). */
export interface Layer {
  z: number;
  tiles: Terrain[];
  height?: number[];
  /** CRÉNELURE (RENDU PUR) : parallèle à `tiles` (`y·w+x`). `null` = pas de crénelure ; une chaîne = id de
   *  structure crénelée (`structureAppearance.json`) → le crest builder (`crestEls`) en dérive des MERLONS
   *  sur le PÉRIMÈTRE (arête dont le voisin même-z n'est pas crénelé) — jamais à l'intérieur. Marqueur de
   *  DÉCORATION seulement (comme un toit auto-dessiné) : n'affecte NI la passabilité NI la LdV plongeante. */
  crenellated?: (string | null)[];
}

/** Aire d'une zone d'effet : rectangle (`rect`) ou disque de Chebyshev (`disc`, rayon en CASES). */
export type ZoneArea =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'disc'; cx: number; cy: number; radius: number };

/** ZONE D'EFFET authorée (piège/hasard/aura environnementale). Payload = `GameOp[]` partagé avec les
 *  zones de Sort (vocabulaire unique, appliqué par `applyOps`). `onCross` se déclenche à la TRAVERSÉE
 *  (une case du chemin est dans l'aire), `perRound` au franchissement de Round pour qui STATIONNE dedans.
 *  Tous les champs mécaniques (`onCross`/`perRound`/`crossTest`/`barrier`/`blocksLoS`) sont OPTIONNELS —
 *  une zone `{id,label,area}` sans aucun d'eux est DESCRIPTIVE (nom de pièce, #782) : inerte au combat,
 *  affichée seulement (`isDescriptiveZone`). */
export interface SceneEffectZone {
  id: string;
  label: string;
  area: ZoneArea;
  blocksLoS?: boolean;
  onCross?: import('../engine/ops').GameOp[];
  perRound?: import('../engine/ops').GameOp[];
  /** GATE de Test à la traversée (cf. `BattleZone.crossTest`, zones.ts) — même sémantique pour une
   *  zone authorée (piège/hasard de scène). */
  crossTest?: import('../engine/flowCore').FlowTest;
  /** BARRIÈRE infranchissable : aucune créature ne peut PÉNÉTRER dans l'aire (mur magique, cercle de
   *  ward). `blockGroups` vide/absent = bloque TOUT le monde ; sinon ne bloque que les créatures dont
   *  un Groupe correspond (ids, ex. `['demon', 'mort-vivant']` = barrière sacrée, profanes tenus à l'écart —
   *  Protection de Phâ / Octogramme). Une créature DÉJÀ à l'intérieur peut sortir, pas re-rentrer. */
  barrier?: { blockGroups?: string[] };
  /** Étage de la zone — défaut 0 (plan de combat). Les zones DESCRIPTIVES de pièce portent le z de leur
   *  étage pour l'affichage/atteignabilité par niveau ; le combat (2D) l'ignore. */
  z?: number;
}

/** Une zone d'effet est DESCRIPTIVE (nom de pièce) quand elle ne porte AUCUN champ mécanique — filtre
 *  UNIQUE (#782) partagé par `sceneZonesToBattle` (zones.ts) et `buildZoneLabels` (zoneLabels.ts). */
export function isDescriptiveZone(ez: SceneEffectZone): boolean {
  return !ez.onCross && !ez.perRound && !ez.crossTest && !ez.barrier && !ez.blocksLoS;
}

export interface Scene {
  id: string;
  nom: string;
  description: string;
  dimensions: { w: number; h: number };
  /** Échelle métrique d'une CASE (m/case) — défaut 2 (person-scale). Une Scène MER (combat naval, MDG 13)
   *  vaut ~10 (1 pt de Distance = 10 m, `ch.13 l.362`) → le M des navires et les portées canon (50/75/150 m)
   *  tombent en nombres de cases jouables. Lue via `sceneMetresPerTile` ; consommée par les bandes de portée
   *  (`rangeBandAt`, engine/combat.ts, #249) et l'avance des navires. N'altère AUCUNE géométrie de rendu —
   *  seul le SENS d'une case change. */
  metresPerTile?: number;
  /** Décor : 'interieur' (éclairé en permanence, l'horloge ne l'assombrit pas) vs 'exterieur'
   *  (jour/nuit = horloge). Absent = extérieur. */
  ambiance?: 'interieur' | 'exterieur';
  /** Classification écologique de la Scène (éditable) — lue par les attributs de Domaine liés à
   *  l'environnement (LDB 48 l.690 : la Vie/Ghyran gagne +10 à Incanter/Focaliser en zone rurale ou
   *  sauvage). Absent = non spécifié (aucun bonus d'environnement). */
  environment?: 'rural' | 'urbain' | 'sauvage';
  /** Météo (LDB 14 l.94-116) — orthogonal à `ambiance`. Défaut 'clair'. Pénalise le combat
   *  (brouillard/tempête/neige) ; lu par `sceneCombatModifiers`. */
  weather?: 'clair' | 'pluie' | 'brouillard' | 'neige' | 'tempete';
  /** Niveau de lumière ambiante (brouillard de guerre) : `id` d'un `lightLevels` (jour/nuit/ténèbres…)
   *  ou `'auto'`/absent = suit l'horloge via `ambiance` (extérieur de nuit = sombre). Lu par `ambientScalar`. */
  ambientLight?: string;
  /** OFFRE DE REPOS de la scène (bouton de Repos en exploration → modale de Repos) : lieux disponibles
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
  /** Couches d'empilement de la scène. Au moins une ; `z:0` = couche de base. Chaque couche a sa propre
   *  grille aplatie w×h + ses hauteurs métriques (`Layer.height`). Les couches z>0 sont des surfaces
   *  superposées (ponts, passerelles, étages) : on marche DESSUS et DESSOUS. Le franchissement vertical
   *  s'auto-dérive du delta de hauteur entre voisines (`surfaceLink`) — aucun escalier explicite. */
  layers: Layer[];
  /** Murs sur ARÊTES de case (cloisons fines entre deux cases adjacentes) — bloquent le passage sans
   *  occuper de tuile, contrairement au terrain `mur`. Forme canonique : `side:'N'` = arête entre (x,y)
   *  et (x,y-1) ; `side:'E'` = arête entre (x,y) et (x+1,y). `door` = arête franchissable (porte). */
  walls?: WallSeg[];
  entities: SceneEntity[];
  /** Toits des bâtiments COMPOSÉS (murs d'arête + sol terrain + ce toit). Optionnel → [] par défaut. */
  roofs?: Roof[];
  dialogues: Dialogue[];
  triggers: Trigger[];
  encounters: EncounterDef[];
  /** Ancres AUTHORÉES des Scènes de bataille sur le plan (S2) — chaque `sceneId` de la pioche de
   *  Puissance de Bataille (`MassBattleState.pool`) reçoit un emplacement sur la carte. La PUISSANCE
   *  des armées reste une abstraction NON rendue ; seul l'emplacement de l'ACTION cinématique (la
   *  Scène du moment que résout un PJ) est posé, pour que `battleScenesToStations` en fasse des
   *  Stations spatiales. Non peuplé = repli déterministe (le consommateur étale les Scènes). */
  stations?: SceneStationAnchor[];
  flags: Record<string, boolean>;
  /** Points d'arrivée nommés (pour les transitions depuis une autre scène). */
  entryPoints?: Record<string, { x: number; y: number }>;
  /** Scène de départ pour la campagne enchaînée. */
  startMessage?: string;
}

/** Ancre AUTHORÉE d'une Scène de bataille sur le plan (S2) : `sceneId` (une entrée de
 *  `MassBattleState.pool` = l'id d'une Scène de bataille, `ActivityDef` contexte 'bataille-round') posée
 *  sur une case de la carte. La Puissance des
 *  armées reste une abstraction NON rendue — seul l'emplacement de l'ACTION est posé. Consommé par
 *  `battleScenesToStations` (state/stations.ts) ; absence d'ancre → repli déterministe côté consommateur. */
export interface SceneStationAnchor {
  sceneId: string;
  pos: { x: number; y: number; z?: number };
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

/** Grille de tuiles d'une couche (défaut z=0 = base). Repli sur la 1ʳᵉ couche si `z` absent. */
export function layerTiles(scene: Scene, z = 0): Terrain[] {
  return (scene.layers.find((l) => l.z === z) ?? scene.layers[0]).tiles;
}

/** Ids des `SceneEntity` ENRÔLÉES dans une rencontre (membres d'un `EncounterDef`) — une entité enrôlée
 *  est un combattant : elle affiche son équipement de combat. SOURCE UNIQUE (rendu iso ET POV). */
export function enrolledEntityIds(scene: Scene): Set<string> {
  return new Set(scene.encounters.flatMap((e) => (e.members ?? []).map((m) => m.entityId)));
}

export function tileAt(scene: Scene, x: number, y: number, z = 0): Terrain {
  if (x < 0 || y < 0 || x >= scene.dimensions.w || y >= scene.dimensions.h) return 'mur';
  return layerTiles(scene, z)[y * scene.dimensions.w + x] ?? 'sol';
}

/** Hauteur RÉELLE (mètres) de la surface de la case (x,y) sur la couche `z` : >0 surélevée, <0 en
 *  contrebas. Hors-grille ou sans tableau `height` → 0. Repli sur la 1ʳᵉ couche si `z` absent, comme
 *  `tileAt`. PORTEUSE : pilote rampe/falaise (`surfaceLink`), distance verticale et chute. */
export function heightAt(scene: Scene, x: number, y: number, z = 0): number {
  if (x < 0 || y < 0 || x >= scene.dimensions.w || y >= scene.dimensions.h) return 0;
  const layer = scene.layers.find((l) => l.z === z) ?? scene.layers[0];
  return layer.height?.[y * scene.dimensions.w + x] ?? 0;
}

/** Id de structure crénelée d'une case de chemin de ronde (couche `z`), ou `null`. Marqueur de RENDU PUR
 *  (le crest builder `crestEls` en dérive les merlons de PÉRIMÈTRE) — n'affecte NI passabilité NI LdV. PUR. */
export function crenellatedAt(scene: Scene, x: number, y: number, z = 0): string | null {
  if (x < 0 || y < 0 || x >= scene.dimensions.w || y >= scene.dimensions.h) return null;
  const layer = scene.layers.find((l) => l.z === z) ?? scene.layers[0];
  return layer.crenellated?.[y * scene.dimensions.w + x] ?? null;
}

/** La case (x,y,z) porte-t-elle une crénelure (marqueur de rendu) ? */
export function isCrenellated(scene: Scene, x: number, y: number, z = 0): boolean {
  return crenellatedAt(scene, x, y, z) !== null;
}

export function isWalkable(scene: Scene, x: number, y: number, z = 0, swim?: ReadonlySet<string>): boolean {
  if (z > 0 && tileCollapsed(scene, x, y, z)) return false; // passerelle effondrée → plus marchable
  if (entityBlockedAt(scene, x, y, z)) return false; // empreinte multi-cases d'un décor (foot {w,h}), SA couche seulement
  // Impassabilité de la MASSE = le TERRAIN (bloc plein `mur` = walkable:false) ; le sol du TUNNEL (`pierre`)
  // reste marchable, la herse INTACTE barrant la bouche via `wallBetween`. Aucune règle « rempart » ici.
  // `swim` : terrains d'ÉLECTION du mover (op passive `offTerrainMod` — `eau` pour Aquatique/Amphibie/
  // Créature marine) qu'il TRAVERSE bien que globalement `walkable:false` (RAW « se déplace à sa pleine
  // vitesse dans l'eau ») ; absent (exploration/décor) → walkabilité de terrain nue, byte-identique.
  const t = tileAt(scene, x, y, z);
  return terrainWalkable(t) || (swim !== undefined && swim.has(t));
}

/** Lien vertical entre deux cases ADJACENTES (Chebyshev : cardinale OU diagonale, grille 8-connexe cf.
 *  `path.ts` NEIGHBORS ; couches possiblement différentes) : compare leurs hauteurs métriques et classe
 *  le franchissement à pied — `flat`/`ramp` marchable, `cliff` infranchissable horizontalement (on y
 *  descend en chutant, on y monte par Escalade). SOURCE UNIQUE de l'auto-connexion du relief : remplace
 *  les escaliers explicites ET la machinerie de rempart. `drop` = hauteur de `b` moins celle de `a`
 *  (>0 = `b` plus haut). Renvoie null si `a` et `b` ne sont pas adjacentes en (x,y) (distance Chebyshev ≠ 1
 *  → même case ou ≥ 2). La marchabilité du terrain/des murs reste séparée (`isWalkable`/`wallBetween`). */
export function surfaceLink(
  scene: Scene,
  a: { x: number; y: number; z?: number },
  b: { x: number; y: number; z?: number },
): { grade: Grade; drop: number } | null {
  if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) !== 1) return null; // adjacent (cardinal ou diagonal)
  const ha = heightAt(scene, a.x, a.y, a.z ?? 0);
  const hb = heightAt(scene, b.x, b.y, b.z ?? 0);
  return { grade: gradeBetween(ha, hb), drop: hb - ha };
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
  /** DÉCORATIF uniquement : l'arête porte une FENÊTRE (croisée vitrée) au rendu. Un mur fenêtré reste un
   *  mur PLEIN (vitre SERTIE, pas une ouverture) — il bloque passage/vue/vision/marchabilité EXACTEMENT
   *  comme un mur nu (`window` n'est lu par AUCUNE règle de combat : ni `wallIsOpen`, ni `vision`, ni
   *  `isWalkable`). N'affecte que l'apparence iso + POV (nuit : vitre ambrée émissive). */
  window?: boolean;
  /** ESCALADABLE (LDB 15 l.52-57) : l'arête sépare deux surfaces de hauteurs différentes (une FALAISE au
   *  sens `surfaceLink` — infranchissable à pied) qu'un Personnage peut GRIMPER. `ladder` = échelle ou
   *  surface facile (pas de Test, LDB 15 l.53) ; `surface` = paroi à prises (Test d'Escalade, l.57).
   *  Bloque toujours passage+vue comme un mur PLEIN (une falaise n'est pas une ouverture) : la grimpe est
   *  un geste EXPLICITE, pas un franchissement de pathfinding. Résolu par `state/climbMove`. */
  climb?: WallClimb;
}

/** Nature d'une arête grimpable (`WallSeg.climb`). */
export interface WallClimb {
  kind: 'ladder' | 'surface';
  /** Surface uniquement — difficulté du Test d'Escalade. LDB 15 l.57 la laisse « définie par le MJ » ;
   *  sans MJ (règle 7) c'est un arbitrage ÉDITABLE par arête. Absent = `intermediaire` (défaut moteur). */
  difficulty?: import('../engine/types').Difficulty;
  /** Surface uniquement — paroi « bien trop compliquée » sans le Talent Grimpeur (LDB 15 l.57). */
  requiresGrimpeur?: boolean;
}

/** Le segment ESCALADABLE sur l'arête (x,y,side,z), ou undefined. */
export function climbAt(scene: Pick<Scene, 'walls'>, x: number, y: number, side: WallSide, z = 0): WallSeg | undefined {
  return scene.walls?.find((w) => !!w.climb && w.x === x && w.y === y && w.side === side && (w.z ?? 0) === z);
}

/** Segment ESCALADABLE sur l'arête CANONIQUE (cardinale) séparant deux cases adjacentes `a`/`b`, ou
 *  undefined (non adjacentes cardinales, ou pas de grimpe posée). Réutilise `edgeOf` (arête canonique
 *  partagée avec `wallBetween`). PUR. */
export function climbEdgeBetween(
  scene: Pick<Scene, 'walls'>,
  a: { x: number; y: number; z?: number },
  b: { x: number; y: number; z?: number },
): WallSeg | undefined {
  const e = edgeOf(a.x, a.y, b.x, b.y);
  if (!e) return undefined;
  return climbAt(scene, e.x, e.y, e.side, a.z ?? 0);
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

/** OBJECTIF de victoire d'une rencontre (#197) — AUTHORABLE en donnée, lu par `checkBattleOver`.
 *  Absent = `allEnemiesDead` (comportement HISTORIQUE, tous les scénarios existants inchangés).
 *  `destroyStructure` référence l'arête par son identifiant STABLE (x/y/side/z), le même couple que
 *  `structureIsDown`/`Combatant.structureEdge` (bélier-porte, AA 10 p.120-121) — la victoire se déclenche
 *  à la BRÈCHE, indépendamment du sort des combattants. `surviveRounds` : victoire posée au début du
 *  Round `rounds + 1` (le groupe a tenu N Rounds complets). `reachZone` réutilise le rectangle de zone
 *  des `Trigger`/`SceneEffectZone` (`inRect`, `combatGeometry.ts`) — aucun 2e mécanisme de zone.
 *  `woundsThreshold` (#215) : REDDITION à seuil de dommage partiel — `targetId` référence l'id
 *  STABLE d'une entité de scène (`SceneEntity.id` = `Combatant.id` au spawn, identité unifiée).
 *  Le RAW ne chiffre AUCUN seuil de reddition (silence confirmé) ; seul précédent chiffré, la
 *  reddition d'un monstre marin à mi-Blessures (MDG 15 l.143, l.166-168). `belowPercent` reste
 *  une valeur ÉDITABLE par rencontre, sans seuil RAW imposé (CLAUDE.md règle 7).
 *  `firstBlood` (#471) : DUEL JUDICIAIRE — « le premier sang est la première attaque qui cause une
 *  perte de plus de 3 Blessures […] ; un adversaire est incapable de continuer lorsqu'il est réduit
 *  à 0 Blessure » (NADJ 06 l.175-177) — les DEUX fins restent actives en parallèle, la seconde étant
 *  la fin standard (0 Blessure, `isOutOfAction`) déjà couverte hors `VictoryCondition`. `threshold`
 *  reste ÉDITABLE (défaut 3, seule valeur chiffrée par le RAW) — sévérité de la charge, CLAUDE.md
 *  règle 7. Testé PAR-COUP (`resolveFirstBlood`, combatFlow.ts) — pas un seuil cumulatif comme
 *  `woundsThreshold`. */
export type VictoryCondition =
  | { type: 'allEnemiesDead' }
  | { type: 'destroyStructure'; edge: { x: number; y: number; side: WallSide; z?: number } }
  | { type: 'surviveRounds'; rounds: number }
  | { type: 'reachZone'; rect: { x: number; y: number; w: number; h: number }; camp?: 'party' | 'enemies' }
  | { type: 'woundsThreshold'; targetId: string; belowPercent: number }
  | { type: 'firstBlood'; threshold?: number };

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

/** Clé de flag d'effondrement d'une TUILE d'étage (`scene.flags`) — présent & `true` = la passerelle de
 *  la case (x,y,z) s'est effondrée (z>0). Absent = intacte. Calque le patron flag des portes/structures. */
export function collapsedTileKey(x: number, y: number, z: number): string {
  return `__tile_down_${x}_${y}_${z}`;
}

/** La tuile (x,y,z) est-elle EFFONDRÉE ? (passerelle d'étage abattue après destruction de la structure
 *  qui la portait). Flag runtime ; absent = intacte (false). */
export function tileCollapsed(scene: Pick<Scene, 'flags'>, x: number, y: number, z: number): boolean {
  return scene.flags?.[collapsedTileKey(x, y, z)] === true;
}

/** Marque la tuile (x,y,z) comme EFFONDRÉE (flag runtime) — renvoie une NOUVELLE Scène (réf changée →
 *  recompute de la vue + re-rendu). PUR. */
export function setTileCollapsed<S extends Pick<Scene, 'flags'>>(scene: S, x: number, y: number, z: number): S {
  return { ...scene, flags: { ...scene.flags, [collapsedTileKey(x, y, z)]: true } };
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

/** Tuiles de PASSERELLE (z=1) marchables situées « au-dessus » d'une arête de structure de sol — la case
 *  porteuse `(seg.x,seg.y)` et sa voisine à travers l'arête (`N` → (x,y-1), `E` → (x+1,y)), prises à z=1
 *  et filtrées sur la marchabilité du terrain (`terrainWalkable`/`tileAt`). Quand la structure portant la
 *  passerelle est abattue, ces tuiles s'effondrent (cf. `collapseStructure`). Ne renvoie QUE celles
 *  réellement praticables (la passerelle réelle) ; les arêtes obliques (`\\`,`/`) n'ont pas de voisine. */
export function parapetTilesAbove(scene: Scene, seg: { x: number; y: number; side: WallSide; z?: number }): { x: number; y: number; z: number }[] {
  const z = 1; // une passerelle au-dessus d'une structure de sol est au 1ᵉʳ étage
  const cells = [{ x: seg.x, y: seg.y }];
  if (seg.side === 'N') cells.push({ x: seg.x, y: seg.y - 1 });
  else if (seg.side === 'E') cells.push({ x: seg.x + 1, y: seg.y });
  return cells
    .filter((c) => terrainWalkable(tileAt(scene, c.x, c.y, z)))
    .map((c) => ({ x: c.x, y: c.y, z }));
}

export function emptyScene(w = 20, h = 15): Scene {
  return {
    id: `scene-${Date.now()}`,
    nom: 'Nouvelle scène',
    description: '',
    dimensions: { w, h },
    ambiance: 'exterieur',
    layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }],
    entities: [],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}

/** Assainit une feuille `Effect` d'un Flow de scène : recurse dans le Flow imbriqué d'un
 *  `delayedEffect` (le seul cas d'un Flow porté par une feuille, plutôt qu'un nœud de structure —
 *  `sanitizeFlow` de l'engine ne connaît que la forme générique `Flow<E>`, pas cette feuille state). */
function sanitizeEffectLeaf(e: Effect): Effect {
  return e.type === 'delayedEffect' ? { ...e, flow: sanitizeFlow(e.flow, sanitizeEffectLeaf) } : e;
}

/** Assainit un Flow de scène (purge des nœuds `null` inexprimables, cf. `sanitizeFlow`) — `undefined`
 *  passe tel quel (un Flow requis mais absent sur un document ANCIEN reste à la charge de la
 *  validation, jamais d'une invention silencieuse). */
function sanitizeSceneFlow(flow: Flow | undefined): Flow | undefined {
  return flow == null ? flow : sanitizeFlow(flow, sanitizeEffectLeaf);
}

/**
 * Complète les COLLECTIONS requises d'une Scène absentes sur un document ANCIEN (le schéma de
 * `ProjectDoc` — `worldMap.ts` `PROJECT_MIGRATIONS` — ne bump qu'aux ruptures de FORME du document ;
 * `Scene` a gagné des champs collection non-optionnels au fil du temps sans bump de schéma, un projet
 * sauvegardé avant ne les porte pas). Point d'entrée UNIQUE du chargement de projet (`parseProject`) :
 * jamais un `?? []` saupoudré côté consommateur (`validateScene` et le runtime supposent ces
 * collections présentes). Assainit aussi les FLOWS portés (triggers/dialogues/rencontres/entités) —
 * purge des nœuds `null` inexprimables (`sanitizeSceneFlow`) ; une réf pendante ou un Flow entièrement
 * absent reste rapportée par `validateScene`, jamais réparée en silence. PUR — ne mute pas `s`. */
export function normalizeScene(s: Scene): Scene {
  return {
    ...s,
    layers: s.layers ?? emptyScene(s.dimensions?.w, s.dimensions?.h).layers,
    entities: (s.entities ?? []).map((e) =>
      e.interact ? { ...e, interact: { ...e.interact, flow: sanitizeSceneFlow(e.interact.flow) as Flow } } : e),
    dialogues: (s.dialogues ?? []).map((d) => ({
      ...d,
      nodes: (d.nodes ?? []).map((n) => ({
        ...n,
        choices: (n.choices ?? []).map((c) => (c.flow ? { ...c, flow: sanitizeSceneFlow(c.flow) } : c)),
      })),
    })),
    triggers: (s.triggers ?? []).map((t) => ({ ...t, flow: sanitizeSceneFlow(t.flow) as Flow })),
    encounters: (s.encounters ?? []).map((e) => (e.onVictory ? { ...e, onVictory: sanitizeSceneFlow(e.onVictory) } : e)),
    flags: s.flags ?? {},
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
