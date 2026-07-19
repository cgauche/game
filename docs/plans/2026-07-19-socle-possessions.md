# Spec — SOCLE « POSSESSIONS » (2026-07-19)

> Plan DATÉ (`docs/plans/`, supprimé une fois exécuté — git porte l'historique). Livrable du chantier
> de design du 2026-07-19 : cette spec + le jeu de tickets GitHub autoporteurs qui l'exécutent.
> Méthode : grounding par 2 agents (code + RAW) + 1 audit dotations + 3 audits adversariaux
> (inventaire, catalogues, coutures) + 3 juges adversariaux (implémentation, scénarios joués,
> fidélité RAW au `Source/`) + 5 passes de démolition utilisateur sur le modèle. Les verdicts
> confirmés sont intégrés.

## 1. Vision et arbitrages utilisateur (verbatims)

Objectif (user, 2026-07-19) : « ce qui m'intéresse est le sujet global : la gestion de toutes les
possessions des joueurs (que ce soit leur équipement, les gens à leur service, et ainsi de suite),
car tout est lié. Il faut une base solide pour que les autres tickets puissent suivre. »

Arbitrages rendus (à reporter tels quels dans les tickets) :
- **2026-07-13 (#395)** : « Personnellement, si une personne a une mule, une charette, un cheval, ce
  n'est pas qu'un simple item, c'est une vraie unité, ça ne se met pas dans un sac » — et « ça sert à
  quoi qu'on puisse pas en acheter d'ailleurs ? ». Précision : « La mule lui appartient certes, mais
  ça doit être géré autrement qu'un objet comme un vêtement qui se porte. »
- **2026-07-16 (#531)** : « Pour la bourse, c'est personnel et par défaut ça doit être dans… la
  bourse du personnage. Oui c'est un trapping. »
- **2026-07-19 (session de design)** :
  - Persistance : « état d'instance + projection » choisi explicitement contre le « tout-Combatant
    persisté » (l'édition Codex doit rester vivante pour toutes les instances).
  - Stats aléatoires : « Elles seront relancées à chaque combat ? Pas fou. » → tirage figé à
    l'acquisition, seedé par l'uid d'instance.
  - Périmètre : « Penser à l'équipement des mules (selle, harnais, armure je crois), des
    bateaux/commerces (qui ont des améliorations, de l'équipage) ainsi que leur inventaire propre
    (marchandise, cargaison…) ».
  - Propriété : « Chaque héros vient avec ce qu'il possède. […] tout nouvel achat demande à
    sélectionner un héros qui sera le propriétaire. » (Une vue de groupe reste permise.)
  - Résolution par libellé : « Du parsing text ? » → REFUSÉ. La donnée migre, le schéma s'étend.
  - Scénario-étalon (persistance/localisation) : « une partie de mon équipement dans ma maison dans
    la ville X, une autre dans mon magasin dans la ville Y, ma charette et mes chevaux dans une
    écurie dans la ville Z, mes bateaux qui transportent une cargaison de chevaux portant des
    harnais + selle, et des mules avec des marchandises dans le port de la ville A ».
  - **Porteur unique** : « un héros, un mercenaire, ou une mule, c'est la même chose ? […] on a une
    gestion de l'équipement, un système de sac, on peut équiper une pièce d'armure ou la mettre dans
    un de nos sacs » → une possession PORTE avec le MÊME système d'items que le héros — jamais un
    2e système de poches parallèle.
  - **Pas de God-object** : « jamais de la vie il récupère 10 000 propriétés qui ne le concernent
    pas » → tronc commun + UNION DISCRIMINÉE par nature.
  - **Identité unique du vivant** : « "bete" qui est à la fois un trapping et une creature, ça a
    toujours été [étrange] pour moi » → l'identité d'un être vivant est le BESTIAIRE ; le prix est
    une facette de commerce ; les bêtes quittent trappings.json.
  - **PNJ custom donnable** : « je ne peux pas créer un vrai PNJ custom comme le permet l'éditeur et
    le donner à un joueur, c'est encore plus absurde » → la réf vivante porte la dualité du spawn
    (`creatureId` | `custom: CustomStatblock`) ; scénario validé sur pièces : dialogue à choix
    payant (`DialogueChoice.cost`, scene.ts:243) + nouvel effet `givePossession`.
  - Marchand mixte confirmé : un maquignon vend mules ET selles/harnais ; la selle s'équipe sur le
    cheval ; les biens achetés se rangent au choix (mule, chariot, inventaire) dans la limite des
    capacités.
  - **Coop — cap structurel** (2026-07-19, verbatim) : « l'hôte ne doit pas pouvoir tout faire au
    marchand. Chacun gère SON inventaire au marchand. Un jour en mode coop l'hôte perdra son
    autorité et les personnages seront dissociés, donc pense dans cette optique dès maintenant,
    comme dans BG3. » → les surfaces de possession/inventaire se conçoivent PAR PROPRIÉTAIRE
    (intents par siège), jamais en miroir-hôte de plus.

## 2. État des lieux mesuré (2026-07-19)

### 2.1 Six représentations parallèles d'un même actif
1. `ItemInstance` (`src/engine/types.ts:836`) — bêtes et véhicules = items de sac
   (`subType:"animaux-et-vehicules"`), champs greffés `mountInjury`/`cargo`/`aboard`.
2. `MountProfile` (`src/engine/mountTravel.ts`, `montures.json`) — stats de voyage ; `heroMount`
   scanne les sacs ; 2 profils morts (`cheval-de-trait-lourd`, `boeuf` : `trappingIds: []`).
3. `CampaignVessel` singleton (`src/state/store.ts:1338`) — le navire de campagne, hors registre.
4. Combatant-coque projeté (`src/engine/vehicle.ts:29`) — véhicule/navire/structure en combat.
5. `CargoCarrier` (`src/engine/cargo.ts` + `src/state/carriers.ts`) — seul tronc unifié (capacité,
   lots, transfert co-localisé) ; ne modélise QUE l'axe Enc.
6. Texte libre — 614 dotations de carrière `{"text"}` jamais instanciées (`careerLevels.json`).

La monture de VOYAGE (item) et la monture de COMBAT (`SceneEntity` authorée, `mountId`/`riderId`,
`combatSlice.ts:2486`) ne se référencent jamais. S'y ajoute la **double identité du vivant** (vice
constaté par l'utilisateur) : un cheval existe en trapping (prix) ET en créature (stats), sans lien.

### 2.2 Catalogue véhicules à deux têtes (audit adversarial)
- 9 entrées `type:"vehicle"` restées dans `trappings.json` (ids renommés `-2` : `charrette-2`,
  `diligence-2`, `chariot-leger`…) dupliquent `vehicles.json`. Donnée éclatée : l'`enc` RAW (EDOC)
  d'un côté, `chargement`+`hull` de l'autre — aucun enregistrement complet.
- Stubs morts `barque`/`chaland` (vehicles.json) : leur **Contenu RAW 60/300 (LDB 70 l.9-10)** est
  PERDU ; doublons de `barque-fluviale`/`barge-fluviale` (T2C).
- `barge` mal sourcée `livre-de-base` alors que son profil = MDG 12 (« Barge » 225 CO) ; triplon
  chaland/barge/barge-fluviale (même bateau 225 CO / cap 300).
- `chaise` : `enc: 51` — le RAW (EDOC 07 l.236) dit **5**.
- Pont `itemFromVehicleById` (`src/engine/items.ts:161`) cassé sur 4 canaux : label = id brut,
  revente 0 (`sellGain`), zéro capacité (`itemCapability`), `subType` forcé.
- 23/26 véhicules sans facette `travel` ; `charrette` sans `travel` alors que son desc exige un
  attelage ; une seule variante de chariot sur les 3 RAW (EDOC 07 l.241-243).

### 2.3 Bêtes et créatures
- Trappings RAW MANQUANTS : Bœuf 15 CO, Cheval de trait lourd 8 CO, Mouton 3/–, Cochon 4/–
  (EDOC 07 l.100-107) — cause racine des 2 profils morts de `montures.json`.
- Créatures frenchy.bzh polluées : doublon `destrier` (E65, gonflé, non-officiel) vs
  `destrier-cheval-de-guerre-lourd` (EDOC-exact E50) ; `palefroi` avec compétences humanoïdes
  (Escalade 55, Discrétion…). Mule/poney/âne/bœuf/cheval-de-trait SANS créature — bloquant
  désormais : la créature devient l'IDENTITÉ de la bête.
- `cheval` (creatures.json:748) tagué `bestial` : FAUX au Source — en EDOC les chevaux portent
  **Nerveux**, seul le Bœuf est Bestial (EDOC 07 l.59).
- Traits Dressé : la donnée porte 8 `dresse-*` ; **le RAW en liste 9** (Divertir, Dompté, Garder,
  Guerre, Magie, Monture, Rapporter, Revenir à la maison, Trait — LDB 85 l.104-118) et la liste est
  **OUVERTE**. Manquent `dresse-divertir` et `dresse-trait` ; `dresse-cavalerie-de-choc` vient d'AA.

### 2.4 Inventaire (bugs indépendants confirmés)
- Une mule (`enc:null`→0) se RANGE dans un sac à dos (`canStow`, items.ts:387) ; une diligence de
  dotation = 100 Enc dans l'inventaire personnel.
- `isWearable(misc)` (items.ts:369) : on peut « porter » une diligence (−1 Enc), slots illimités.
- `transferItem` (partyFlow.ts:165-189) corrompt les contenants : `inside` fantôme chez le receveur
  (objet impondérable), contenu orphelin chez le donneur.
- `wornArmourPoints` (items.ts:725) ignore `destroyed`.

### 2.5 Monnaie (#531, état mesuré sur le ticket)
Bourse de GROUPE unique `GameState.money` (store.ts:338) + 5 pistoles HARDCODÉES sans réf RAW à
startScene (store.ts:1649) ; une primitive de crédit, ≥22 débits inline ; le trapping `bourse`
existe (trappings.json:2713) ; Enc de monnaie (1 Enc/200 pièces, LDB 61 l.29) et passager (~10 Enc,
LDB 61 l.17) non implémentés (#470).

### 2.6 Dotations de carrière (audit exhaustif)
614 grants `{"text"}` (445 distincts, 315/384 niveaux). Classification : (a) bêtes 11 ·
(b) véhicules 8 · (c) bateaux 20 · (d) serviteurs 47 · (e) immeubles 46 · (f) unités militaires 57 ·
(g) **équipement ordinaire 344** · (h) choix « X ou Y » 36 · (i) quantités/bourse 19 ·
(j) intangibles 19 · « Arme (Au choix) » ×7. `TrappingRef` (common.ts:292) n'a QUE
`{id,count?}`/`{text,count?}` — pas de `{choice}`. « Arme (Au choix) » est résolu par MATCH DE
CHAÎNE EN DUR (character.ts:392, CharacterCreator.tsx:1948). `buildInventory` ignore les `{text}`
(character.ts:387-395).

### 2.7 Coutures périphériques
- Coop hors-combat = miroir hôte (`src/net/intents.ts:7`).
- Carriers force-co-localisés au lieu courant (carriers.ts:29) — aucun « laissé à un lieu ».
- Canal d'entretien en or : seul précédent = paie d'équipage navale (`tickCampaignVesselWeek`,
  wagesOwed + Conseil de bord, shipCrew.ts:388).
- Butin : aucune capture de bête ennemie ; patrons existants : reddition à seuil (#215, fermé),
  prises navales (#267).
- Naufrage : purge `vessel:null` SEULE (shipwreck.ts:97). Mort de bête en voyage : cargo détruit
  silencieusement (travelFlow.ts:880-884). Vente : canal `Combatant.items` uniquement
  (merchantFlow.ts:501).
- `SAVE_VERSION = 9` (saves.ts:38) ; 5 fixtures golden dont `v4-convoi-terrestre` qui porte un
  `caravanCargo` racine SANS porteur.
- Roster localStorage = snapshot de CRÉATION (`rosterAdd` : création/import seulement ;
  `rosterUpdate` appelé uniquement par `setHeroBackground`, partyFlow.ts:464 — borne : la
  propagation de bio ne doit pas écraser les items du snapshot).
- 3 heuristiques par label hors socle : `weaponMatchesFamily`, `isCavalryLance`,
  `creatureAttackKind` (angle mort de la garde labelLogic).
- `state/spawn.ts` : `SpawnExtras` sans override de caractéristiques ; `randomChars` re-randomise à
  CHAQUE spawn (spawn.ts:122-230) ; `statblockToCombatant` (spawn.ts:291) et la dualité
  ref/statblock de `spawnEnemy` (spawn.ts:347-381) EXISTENT.
- Recrutement par dialogue : `SceneEntity.statblock?: CustomStatblock` (scene.ts:75),
  `SceneEntity.dialogueId`, `DialogueChoice.cost` (précédent : chambre d'auberge, scene.ts:243),
  effets sur choix via l'union `Effect` (scene.ts:154) — tous les rails existent, il manque
  l'effet `givePossession`.

## 3. Ancrages RAW (vérifiés au Source FR par juge)

| Sujet | Réf | Statut |
|---|---|---|
| Bêtes de somme : MÊMES règles d'Enc, capacité listée par bête (« Contenu » défini LDB 70 l.5) au lieu de BF+BE | LDB 61 l.17 + LDB 70 l.5 | confirmé |
| Passager ≈ 10 Enc | LDB 61 l.17 | confirmé |
| Monnaie : 1 Enc / 200 pièces | LDB 61 l.29 | confirmé |
| Prix/Contenu bêtes & véhicules (mule 5 CO/14, destrier 230/20, charrette 20/25, diligence 150/80, barque 6/60, chaland 225/300…) | LDB 70 l.9-27 | confirmé |
| Attelages requis (« Charrette : nécessite un conducteur et un animal de trait » ; chariot = 2 chevaux ; diligence = 2 conducteurs + 4 chevaux) | LDB 70 l.33-41 | confirmé |
| Mercenaires : tarif = Statut (rapide), ×3 journée, ×2 danger sauf Commandement ; **colonne « Coût à la semaine »** (3e régime) ; Hommes de main ½ PX | LDB 75 l.5-22 | confirmé |
| Caractéristiques aléatoires : −10 + 2d10 (cas « vaut 5 » : 1d10) ; RAW muet sur le « quand » | LDB 77 l.108 | confirmé |
| Dressage : Test Dressage Accessible (+20) → « ajoutez une Compétence… choisie parmi les Traits de créature Dressé » | LDB 23 l.130 | confirmé |
| Dressé : 9 spécialisations nommées, liste OUVERTE | LDB 85 l.100-118 | confirmé |
| Écurie/nuit : 10 sc (Commune), sans mention du fourrage | LDB 66 l.14 | confirmé |
| **Écurie AVEC fourrage : « 1/– par cheval et par jour, fourrage compris »** — prix citable par PASSAGE (arbitrage sources 2026-07-10 ; à documenter dans `docs/sources-vf.md`) | **PDT 03 l.251** | confirmé |
| Les tarifs de trajet EXCLUENT le fourrage | LDB 51 l.170 | confirmé |
| Disponibilité (Commune/Limitée/Rare/Exotique × taille de colonie, système optionnel) | LDB 59 l.7-34 | confirmé |
| Profils de monture (8), coûts des bêtes (bœuf 15 CO, trait lourd 8 CO, mouton, cochon), Enc véhicules (chaise 5), traction 1/10, boiteux (« ni monté, ni porter ou tirer de charge » l.159), 3 chariots | EDOC 07 | confirmé |
| Contenance + surcharge navale ; gages d'équipage ; parts de prise 50/10/40 | MDG 12 l.66-77, MDG 14 l.291-301 | confirmé |
| Entretien naval : 2 Enc de pièces / 5 Blessures | **MDG 15** l.306 | confirmé |
| « Les Intérimaires de l'aventure » : embauche, réputation, responsabilité, profils, désertion+VOL si impayé (l.240), zélotes gratuits (l.228-230), infiltré (l.261), tables d'individuation propres | AA 09 l.191-501 (#453) | confirmé |
| MUET → maison éditable : fourrage acheté SEUL en pleine nature (calé sur le 1/– PDT) ; TOUT l'immobilier (#356) | — | confirmé muet |

## 4. Le modèle — porteur unique, identité unique, tronc + union discriminée

### 4.1 Principes

**Un héros, un mercenaire, une mule : le MÊME portage.** Une possession PORTE des `ItemInstance[]`
avec exactement les sémantiques du héros — `equipped` (selle harnachée, barde), `inside` et les
contenants (les fontes = un sac), le même outillage d'Enc (LDB 61 : mêmes règles, seule la SOURCE de
capacité change — Contenu/chargement/Contenance au lieu de BF+BE). Les flux existants (équiper,
ranger, transférer) et l'UI d'inventaire existante servent tous les porteurs — AUCUN deuxième
système. Le héros partage ces interfaces mais reste dans `party` : il n'est pas possédé, ses stats
sont pleines et persistées, il n'entre pas dans le registre.

**L'identité d'un être vivant est le BESTIAIRE.** Les bêtes SORTENT de `trappings.json` (il n'y
reste que le harnachement — selle, collier, barde : de vrais objets). Le prix et la Disponibilité
deviennent une facette `purchase` sur l'entrée créature — symétrique de `VehicleData.purchase`.
`montures.json` se re-keye par `creatureId` (règle par la racine les 2 profils morts). Un marchand
vend l'union des trois catalogues selon son archétype.

**Frontière unité/item** : a un statbloc/profil (existant ou créé) → possession ; sinon → reste un
item (poulet, vers à pêche). La frontière est déplaçable en DONNÉE (le bestiaire est éditable),
jamais en code.

**Pas de God-object.** Tronc commun minimal + union discriminée par `nature`.

### 4.2 Types (`src/engine/possession.ts`, moteur pur testé)

```ts
export type PossessionLocation =
  | { kind: 'avec-le-groupe' }
  | { kind: 'au-lieu'; placeId: string }
  | { kind: 'embarquee'; hostUid: string };

/** Réf du VIVANT — la même dualité que le spawn (spawnEnemy ref|statblock, spawn.ts:347). */
export type LivingRef =
  | { creatureId: string }              // bestiaire (édition Codex vivante)
  | { custom: CustomStatblock };        // PNJ/bête custom de l'éditeur — le snapshot EST son identité

/** TRONC — toute possession : une identité possédée, localisée, qui PORTE. */
interface PossessionCommon {
  uid: string;              // pos-N, anti-collision par scan du registre (jamais un compteur module)
  ownerId: string;          // héros propriétaire — OBLIGATOIRE à l'acquisition ; succession si mort/retiré
  name?: string;            // nom d'instance (« Marguerite »), affichage pur
  location: PossessionLocation;
  items: ItemInstance[];    // LE système de sac unique — equipped/inside/contenants, primitives du héros
  cargo?: CargoLot[];       // vrac (tronc CargoCarrier)
  destroyed?: boolean;      // perdue/morte — journal, filtrée partout
}

/** CORPS — union discriminée : zéro champ étranger à sa nature. */
export type Possession = PossessionCommon & (
  | { nature: 'bete';
      ref: LivingRef;
      charsRolled?: Characteristics;    // LDB 77 l.108 — tiré UNE fois, seedé sur l'UID, FIGÉ
      appearanceSeed?: string;
      wounds?: { current: number; max: number };  // max re-dérivé à chaque projection (clamp)
      mountInjury?: MountInjury;        // EDOC 07 Incidents de Monte
      learnedTraits?: string[] }        // dresse-* appris (LDB 23 → LDB 85)
  | { nature: 'serviteur';              // T3 (LDB 75 + AA 09, #453 prérequis)
      ref: LivingRef;                   // dont statblocs GÉNÉRÉS carrière+espèce (le générateur produit un CustomStatblock)
      charsRolled?: Characteristics; appearanceSeed?: string;
      wounds?: { current: number; max: number } }
  | { nature: 'vehicule';
      vehicleId: string;                // vehicles.json (catalogue UNIFIÉ post T0-a)
      wounds?: { current: number; max: number } }
  | { nature: 'navire';                 // T2 (#267/#250)
      vehicleId: string;
      wounds?: { current: number; max: number };
      upgrades?: NavalTraitRef[];       // MDG 12, T2C ch.10
      crew?: CrewHire[];                // marins nommés #250 (individuation)
      naval: NavalPossessionState }     // ex-champs CampaignVessel
  | { nature: 'immeuble';               // T4 (#356) — location contrainte à au-lieu (fixe)
      buildingId: string }
);
```

Helpers purs : `possessionCapacity` (source par nature : Contenu / chargement / Contenance),
`possessionRideable`, `possessionLabel`, `possessionTotalEnc` (§5). La couture de promotion
`extractPossessionFromItem` n'existe que pour la **MIGRATION de save** (les vieilles mules-items →
possessions) — aucun chemin de jeu vivant ne passe par elle : les catalogues étant disjoints, un
grant de bête est un grant de possession dès la source.

### 4.3 Effets d'authoring — `givePossession` à côté de `giveTrapping`

Deux effets, périmètres DISJOINTS (validé user) :
- `giveTrapping` = un OBJET (ItemInstance chez un porteur). Son périmètre rétrécit : plus aucun
  animal/véhicule déguisé.
- **`givePossession`** (NOUVEAU membre de l'union `Effect`, scene.ts:154) = une UNITÉ au registre :
  `{ type: 'givePossession'; nature; ref (creatureId | statblock inline | vehicleId | entité de la
  scène — snapshot de son profil) ; heroId? (absent = picker par portrait, comme giveTrapping) }`.
  Scénario canonique validé sur pièces : PNJ custom (`SceneEntity.statblock`) + dialogue « vend ses
  services » (`DialogueChoice.cost` = ses gages) + effet `givePossession` → il rejoint le groupe.
  Détail d'authoring au ticket : le sort de l'entité de scène recrutée (retrait/flag).
  Champ d'éditeur requis (#592) dans `EffectList`/`FlowEditor`.

### 4.4 Registre et flux
- `GameState.possessions: Possession[]` (sérialisé d'office par `snapshotSave`).
- `src/state/possessionsFlow.ts` (patron `merchantFlow` — actions store hôte-autoritaires) :
  `addPossession`, `renamePossession`, `transferPossession` (succession comprise),
  `learnPossessionTrait`, `stablePossession`/`retrievePossession`, `embark`/`disembark`,
  `abandonPossession`, sélecteurs (filtres par location/owner). **Équiper/ranger/transférer un item
  = les flux d'items EXISTANTS généralisés au PORTEUR** (héros OU possession) — pas d'actions
  parallèles ; corollaire : les bugs de `transferItem` (T0-c) sont un prérequis de qualité.

### 4.5 Projections (jamais de Combatant persisté pour une réf catalogue)
- **Voyage** : `heroMount`/`partyMounts`/`landCarriers` lisent le registre FILTRÉ par location
  (`avec-le-groupe`) — ⚠ signatures engine changent (appelants `travelFlow.ts:860/876`). Profils
  d'allures : `montures.json` re-keyé `creatureId`. Une bête `custom` (LivingRef statbloc) sans
  profil de monture n'est PAS montable/bâtable en voyage — dégradation propre, affichée sur sa
  fiche ; si le besoin émerge, le profil rejoindra le statbloc custom (donnée, pas code).
- **Combat** : `possessionSpawn.ts` — vivant : `creatureToCombatant` (réf bestiaire) OU
  `statblockToCombatant` (custom) + overlay (NOUVEAU champ `SpawnExtras` : override `charsRolled` +
  union `learnedTraits`), report clampé de `wounds`, `mountable`, id `pos-${uid}` (préfixe FORCÉ
  par garde), kind allié ; les items ÉQUIPÉS suivent. Véhicule : `vehicleCombatant` existant. Spawn
  UNIQUEMENT aux rencontres de VOYAGE (flag d'opts) ou scène qui l'autorise. Writeback
  `finalizeBattle` : NOUVEAU bloc keyé `pos-` (blessures → `wounds`, mort → §6).
- **Fiche** : catalogue/snapshot + overlay ; l'onglet inventaire d'une possession EST l'UI
  d'inventaire existante pointée sur son `items`. La fiche AFFICHE tout ; les ACTIONS se gatent par
  co-localisation (§6).

## 5. Localisation et contenance récursive

Persistance PAR CONSTRUCTION : registre plat, sérialisé, hors des scènes — le scénario-étalon est
autant d'entrées du même tableau avec leurs `location`, items et cargo.

⚠ Verdict juge : la sommation transitive est du **code NEUF**. `carrierUsedEnc` (cargo.ts:148) ne
somme jamais une possession embarquée ; `itemCarrier` pose `discreteEnc:0` ; `transferCargo` est
mono-niveau. À écrire : `possessionTotalEnc(p)` = enc propre (catalogue) + items (règles LDB 61) +
cargo, replié dans la capacité de l'hôte pour chaque embarquée. Garde-fous : chaîne `embarquee`
bornée par nature (bête/véhicule sur navire : oui ; navire sur navire : non), anti-cycle, capacité
vérifiée à l'embarquement. **Scénario-étalon = test d'invariant committé, ÉTAGÉ par tranche** :
T1 couvre le volet terrestre (charrette+chevaux à l'écurie de Z, mule chargée, save/load, porteurs
= groupe seul) ; T2 y ajoute le navire au port de A avec bêtes embarquées ; T4 la maison/le magasin
— le test GRANDIT avec le programme, il ne promet jamais plus que la tranche livrée.

## 6. Cycle de vie — les cascades d'écriture (verdict juge : LE trou du design initial)

- **Destruction d'un hôte** (naufrage, coque détruite) : cascade sur les possessions embarquées et
  leur contenu — le naufrage actuel ne purge que `vessel:null` (shipwreck.ts:97). Défaut : corps et
  biens (destroyed en cascade + journal), la séquence de survie (#244) pouvant en sauver.
  [décision produit №2]
- **Mort d'une bête** (combat ou voyage) : items et `cargo` tombent CO-LOCALISÉS, récupérables dans
  la limite des porteurs restants ; jamais d'évaporation silencieuse (remplace
  travelFlow.ts:880-884).
- **Succession** : `ownerId` mort / retiré (`partyRemoveHero`) / invité définitivement parti → les
  possessions ET la bourse passent à un héros vivant désigné. Jamais d'orphelin gelé.
  [décision produit №3]
- **Liquidation (vente)** : canal du SOCLE (T1-d) : prix = catalogue (facette `purchase`) ; les
  items portés se DÉTACHENT et se vendent séparément ; une charrette pleine se vend VIDÉE d'abord
  (gate) ; une possession distante ne se vend pas à distance — elle se récupère sur place.
- **Abandon** : action explicite « laisser sur place » — couvre le soft-lock d'attelage (cheval de
  trait boiteux, EDOC 07 l.159 → la charrette s'abandonne ou change de bête ; jamais un voyage
  bloqué sans issue). [décision produit №4]
- **Co-localisation des actions** : dresser, atteler, charger, équiper — `GatedAction` avec raison.

## 7. Acquisition, achat, vente

- **Stock marchand = union des trois catalogues** (trappings ∪ vehicles-à-`purchase` ∪
  créatures-à-`purchase`), filtrée par archétype (`merchantArchetype` — le maquignon vend mules ET
  selles/harnais). **Disponibilité LDB 59 honorée** pour toutes les lignes.
- **Répartition à l'achat** : `pendingDistribution` (merchantFlow.ts:434/480) généralisé — chaque
  ligne route selon sa nature : unité → registre avec PROPRIÉTAIRE choisi ; objet → un PORTEUR
  présent au choix (sac du héros, fontes de la mule, caisse du chariot — jauges d'Enc, gate de
  capacité) ; vrac → le tronc carriers existant (`carrierCanLoad`). Bourse PAYEUSE choisie
  (T-bourse).
- Tirage LDB 77 à l'acquisition si la règle optionnelle (nouvelle entrée `policy.ts`) est active —
  seed = uid (3 mules d'un lot = 3 tirages distincts).
- Acquisitions sans achat (butin, dotation, `givePossession`, zélote AA 09) : désignent aussi leur
  propriétaire.
- Capture de bêtes vaincues : BACKLOG (patrons #215/#267). [décision produit №5]

## 8. Bourse personnelle (T-bourse — exécute #531 + volet monnaie de #470)

Montant porté par l'instance bourse-trapping de chaque héros (patron `ItemInstance.qty`) ; Enc
dérivé par `totalEncumbrance` (1 Enc/200 pièces) ; primitives débit/crédit UNIQUES (≥22 sites) ;
surfaces de groupe dérivées (somme) ou par-héros ; purge du hardcode 5 pistoles (store.ts:1649) ;
recâblage `partyAddHero` (richesse initiale → bourse du héros, partyFlow.ts:602) ; questions
ouvertes de #531 (répartition des gains de groupe, « Argent à gaspiller ») tranchées AU ticket.
[décision produit №6] Le volet PASSAGER de #470 (~10 Enc) part en T1-c3.

## 9. Dotations de carrière — migration de DONNÉE (jamais de résolution par libellé)

- Extension de schéma : `TrappingRef` gagne `{choice: Array<{id; count?}>}` (patron
  `AdvancementRef.choice`) — le match en dur « Arme (Au choix) » est PURGÉ (ses 7 occurrences
  deviennent des `{choice}` sur ids d'armes). **Les grants de BÊTES/VÉHICULES deviennent des grants
  de POSSESSION** (nouvelle variante typée référencant creatureId/vehicleId — plus jamais des refs
  d'items) ; champ d'éditeur requis (#592).
- La donnée migre À LA MAIN (careerLevels.json = source canonique curée), vérifiée au RAW carrière
  par carrière ; script jetable = rapport de correspondance seulement.
- Périmètre T1 : catégories (a)(b)(c) + les (h) qui portent une possession. Sans cible bestiaire
  (Rhinox, Blaireau apprivoisé, Voilier) : curation `creer-une-creature` sourcée OU `raw.manifest`.
- Résolution des `{choice}` : à la CRÉATION (slot du créateur) ET à l'ENTRÉE EN PARTIE d'un héros
  rejoignant en cours de campagne (même UI). Les grants de possession se matérialisent au registre
  à l'entrée en partie (le roster reste un snapshot de création).
- (d)(e)(f) migrent à leur tranche ; (g) 344 équipements ordinaires = ticket de dette dédié hors
  socle (palier « de qualité » via qualités de Fabrication LDB 60, typos, anglais) ; (i) tranché au
  ticket (g) ; (j) reste de la saveur.
- Garde-cliquet : snapshot committé des `{text}` restants — tout NOUVEAU texte échoue, le compte
  décroît de tranche en tranche.

## 10. Serviteurs (design posé — implémentation T3)

- **TROIS régimes LDB 75** : ponctuel (transaction) ; **salarié à la semaine** (gages récurrents,
  canal `wagesOwed`/`tickCampaignVesselWeek` généralisé) ; Homme de main permanent (½ PX).
- **AA 09 l.191-501 (#453 = PRÉREQUIS : topic d'Atlas avant tout code)** — un serviteur a de
  l'AGENCE : gages impayés → départ ET vol (l.240) ; zélotes gratuits par réputation (l.228-230) ;
  infiltré/trahison (l.261) ; individuation par les tables propres d'AA 09.
- Profil : réf bestiaire OU `CustomStatblock` — le générateur carrière+espèce (LDB 75) PRODUIT un
  CustomStatblock ; un PNJ custom de l'éditeur se donne par `givePossession` (dialogue à choix
  payant — scénario canonique §4.3). **Portage : comme un héros, rien de neuf.** Recoupe #436
  (Faveurs). Marins nommés #250 (T2) = même individuation.

## 11. Tranches, tickets et migrations

Ordre : **T0 assainissement → T-bourse (v10) → T1 socle + bêtes & attelages (v11) → T2
navire/flotte → T3 serviteurs → T4 immeubles.** T-bourse développable en parallèle de T0 mais
mergée AVANT la bascule (versions ASSIGNÉES — verdict juge : collision sinon). Heuristique
déterministe pour le legacy sans porteur (`caravanCargo` racine de `v4-convoi-terrestre`) :
affectation aux bêtes/véhicules du convoi par capacité décroissante, surplus au premier héros
porteur — testée sur la fixture.

La chaîne de tickets (contenus détaillés dans les tickets, gabarit #101+) :
- **T0-a Catalogue véhicules unifié** : fusion des 9 `type:"vehicle"` (ids canoniques sans `-2`,
  enc RAW + chargement + hull réunis) ; stubs barque/chaland restaurés (Contenu 60/300 = LDB 70
  l.9-10) ; `barge` re-sourcée MDG 12 + dédoublonnage ; `chaise` enc 5 ; 3 variantes de chariot ;
  re-pointage consommateurs. Débloque T1-c1.
- **T0-b Le vivant au bestiaire** : les bêtes QUITTENT trappings.json (harnachement seul y reste) ;
  facette `purchase` sur les créatures (prix/Dispo LDB 70 + EDOC) ; créatures manquantes CRÉÉES
  (mule, poney, âne, bœuf, cheval-de-trait, trait-lourd, mouton, cochon — skill
  `creer-une-creature`, sinon raw.manifest) ; purge destrier doublon + palefroi frenchy ;
  `bestial`→`nerveux` sur cheval ; `montures.json` re-keyé `creatureId` ; curation Dressé
  (+`dresse-divertir`, +`dresse-trait`, liste ouverte éditable) ; garde collision d'ids
  inter-catalogues. Débloque T1-b.
- **T0-c Bugs d'inventaire** (transferItem contenants, isWearable/equipConflicts,
  wornArmourPoints) — PRÉREQUIS de qualité (les mêmes flux servent les possessions).
- **T0-d Poison par libellé hors socle** (weaponMatchesFamily, isCavalryLance, creatureAttackKind
  + extension garde labelLogic). Non bloquant.
- **T-bourse** (#531 + monnaie #470) : v10. Débloque T1-d, T1-h. Recoupe #530.
- **T1-b Moteur possession** : engine/possession.ts (tronc + union + LivingRef) + tests +
  OptionalRule tirage-à-l'acquisition (seed uid) + overlay de spawn (nouveau champ SpawnExtras).
  Bloqué par T0-b.
- **T1-c1 Registre + migration v11** : GameState.possessions + possessionsFlow (dont
  laisser/reprendre, embarquer/débarquer, succession, abandon) + migration (5 fixtures chaînées +
  heuristique caravanCargo + mapping trappingId→creatureId + fixture golden neuve +
  `extractPossessionFromItem` : helper de migration UNIQUEMENT). Bloqué par T0-a, T1-b, T-bourse.
- **T1-c2 Contenance récursive** : `possessionTotalEnc` + repli dans l'hôte + garde-fous + test
  scénario-étalon. Bloqué par T1-c1.
- **T1-c3 Re-sourçage voyage/carriers** : heroMount/partyMounts (⚠ signatures engine),
  landCarriers/bulkCarriers/persistCarriersCargo/applyLandCargoRaid + consommateurs
  (landMarketFlow.ts:204/256, portFlow), passager ~10 Enc (LDB 61 l.17), perte de monture (items +
  vrac co-localisés), attelage `team` + fallback boiteux/abandon. Bloqué par T1-c2.
- **T1-c4 Bascule des producteurs + suppression des champs** : suppression
  ItemInstance.mountInjury/cargo/aboard (verrou tsc — y compris les 13 UI qui affichent des items
  animaux/véhicules) + effet **`givePossession`** (union Effect + EffectList/FlowEditor, sort de
  l'entité recrutée) + `giveTrapping` rétréci aux objets + généralisation des flux d'items au
  PORTEUR + promotion des dotations à l'entrée en partie (+ résolution {choice} pour un héros
  rejoignant ; borne rosterUpdate=bio) + cascades (naufrage, mort de bête — writeback NOUVEAU bloc
  `pos-`). Bloqué par T1-c3.
- **T1-d Achat & VENTE** : stock union 3 catalogues par archétype (Dispo LDB 59), répartition
  généralisée aux PORTEURS (jauges d'Enc), tirage à l'acquisition, bourse payeuse, canal de
  liquidation (§6), **intents marchand PAR SIÈGE** (décision №1 : chaque joueur achète/vend pour SON
  héros avec SA bourse — patron INTERLUDE_INTENTS de intents.ts, gate `intentAllowedFor` par
  propriétaire). Bloqué par T1-c4, T-bourse.
- **T1-e Fiche UI** (PossessionsScreen : primitives composées, onglet inventaire = UI existante,
  actions gatées par co-localisation ; recette navigateur) · **T1-f Combat chevauchable** (spawn
  gated + writeback + scénario ; vérif LDB 85 Dressé (Monture) ; ouvre #449 ; poison mount.ts:200
  corrigé) · **T1-g Dotations a/b/c + `{choice}` + grants de possession + purge « Arme (Au
  choix) »** · **T1-h Économie + gardes + docs** (écurie LDB 66 10 sc/nuit + fourrage PDT 03 l.251
  1/–/jour ; fourrage-en-nature maison ; débits par bourse ; cliquet dotations ; garde
  anti-7e-modèle + préfixe pos- ; systemes.manifest + architecture.md + sources-vf.md pour le
  passage PDT). Bloqués par T1-c4.
- Dettes parallèles : (g) équipements texte · écurie au hub (UI service) · capture (patrons
  #215/#267) · intents coop complets. Contrainte transversale #592 : tout nouveau champ de schéma
  reçoit son champ d'ÉDITEUR.

Preuve d'accueil des tranches suivantes (sans fork) : chaque champ de `CampaignVessel` a sa case
dans la variante `navire` ; les seams nommés (réconciliation combatSlice.ts:2472, writeback,
`tickCampaignVesselWeek`, `vesselCarrier`, `ShipDossierView`) passent de `vessel` à
`possessionByUid` ; T2 migre le singleton → la FLOTTE (#267) avec marins nommés (#250). Immeuble
(#356) = variante `immeuble` + `au-lieu` fixe + items/cargo. Serviteur = §10.

## 12. Gardes et tests

- **Anti-7e-modèle** : verrou type (suppression des 3 champs d'ItemInstance) + invariant fixture
  (aucun item de party résolvant un profil de monture/chargement) + scan statique ALLOWLIST +
  préfixe `pos-` interdit aux ids de scène + garde donnée : plus AUCUN trapping à profil de
  monture/statbloc (les bêtes n'existent qu'au bestiaire).
- Overlay : « deux projections successives = mêmes stats » ; « 3 mules d'un lot = 3 tirages
  distincts ».
- Cascades : naufrage avec possessions embarquées ; mort de bête → items/vrac co-localisés.
- Scénario-étalon : test d'invariant (éparpillement X/Y/Z/A, save/load, porteurs = groupe seul).
- Recrutement : test du scénario canonique (dialogue à coût + givePossession → possession au
  registre, entité de scène réglée).
- Monnaie : seuils 199/200/201 pièces (DoD #531).
- Dotations : cliquet snapshot décroissant ; `refs-migrated` étendu aux `{choice}` et aux grants de
  possession.
- Garde labelLogic étendue à la classe « heuristique par sous-chaîne de label » (T0-d).

## 13. Décisions produit

| № | Sujet | Décision |
|---|---|---|
| 1 | Coop | [entériné 2026-07-19] Seul le PROPRIÉTAIRE aliène (vendre/abandonner/transférer) sa possession — dès T1. ET : « Chacun gère SON inventaire au marchand » (verbatim) — intents marchand PAR SIÈGE dès T1-d (un invité achète/vend pour SON héros, avec SA bourse). Cap structurel : concevoir vers la dissociation des personnages (« comme dans BG3 » — l'hôte perdra son autorité) : toute nouvelle surface possession/inventaire = intents par propriétaire, jamais un miroir-hôte de plus. |
| 2 | Cascade de naufrage | [entériné 2026-07-19] Corps et biens (destroyed en cascade + journal), la séquence de survie peut sauver une partie. |
| 3 | Succession | [entériné 2026-07-19] Choix du joueur ; défaut = plus ancien héros vivant. |
| 4 | Abandon en pleine nature | [entériné 2026-07-19] Perdue (destroyed) avec confirmation ; « au-lieu » seulement dans un lieu. |
| 5 | Capture de bêtes vaincues | [entériné 2026-07-19, périmètre] Backlog (patrons #215/#267). |
| 6 | Répartition des gains de groupe | [entériné 2026-07-19, périmètre] Tranchée au ticket T-bourse (questions ouvertes de #531). |
