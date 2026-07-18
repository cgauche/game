# Conception — LE PORTEUR DE CHARGE (chaîne de charge marchande)

> **Daté 2026-07-11.** Artefact de conception (à supprimer une fois exécuté — git porte l'historique).
> Ticket #327 phase 1. GO user consigné (#327, 2026-07-11) : « Vivement qu'on traite ces écarts par
> manque d'implémentation plutôt que juste l'indiquer. » Ce doc = grounding RAW par maillon + spec du
> modèle générique + arbitrages maison à VALIDER + découpage d'exécution. Rien ne se code avant
> validation des arbitrages maison (§5).

Patron : conception seam/composeur (décisions numérotées, primitives nommées, verrous, lots chiffrés,
hors-périmètre explicite). Contraintes du brief : UN concept générique, réutilisation stricte des
primitives existantes, `CampaignVessel.cargo` DEVIENT un porteur (jamais un 2ᵉ silo), `caravanCargo`
migre du groupe vers le porteur réel, UN mécanisme de transfert entre porteurs co-localisés.

---

## 1. Grounding RAW par maillon (Atlas d'abord, Source pour citer)

### 1.1 Bât des animaux — RAW EXISTE, curation incomplète

- **LDB 61 l.16-19** (Atlas `equipement.md` §Bêtes de somme) : « Les animaux de trait (mules, chevaux,
  charrettes, chariots) **ignorent** la formule BF + BE ; leur capacité est listée dans leur description
  (champ `Contenu`). Chaque passager de taille humaine compte pour **~10 Points d'Enc** (modulable par le MJ). »
- **EDOC ch.4** (Atlas `deplacement.md` §Coût et disponibilité des animaux, l.285-295) — colonne
  **« Enc portée »** verbatim :

  | Animal | Enc portée |
  |---|:--:|
  | Chien | 8 |
  | Poney | 14 |
  | Âne ou mule | 14 |
  | Cheval de trait | 20 |
  | Cheval de trait lourd | 30 |
  | Bœuf | 30 |
  | Cheval de monte (Palefroi) | 16 |
  | Cheval de guerre léger | 18 |
  | Cheval de guerre lourd (Destrier) | 20 |

- **Écart de curation** : `src/data/montures.json` porte `m`/`e`/`trot` par profil (source EDOC compagnon
  p.25) mais **PAS** la charge portée. `MountProfile` (`src/engine/mountTravel.ts:39-50`) n'a pas de champ
  de capacité. VERDICT : donnée RAW à recoller (pas une house-rule) — étendre le schéma.

### 1.2 Contenance des véhicules terrestres — RAW EXISTE, OMISE par la curation

- **EDOC ch.4** (Atlas `deplacement.md` §Tableau des Véhicules de l'Empire, l.309-321) — colonne
  **« Chargement »** verbatim :

  | Véhicule | Enc (à vide, encombre son porteur) | **Chargement** | Animaux/Porteurs |
  |---|:--:|:--:|:--:|
  | Charrette | 10 | **25** | 1 A |
  | Chaise (Bordeleaux) | 5 | **10** | 2 P |
  | Diligence | 100 | **80** | 2-4 A |
  | Charrette à bras | 5 | **50** | 1-2 P |
  | Petite litière | 10 | **10** | 2 P |
  | Grande litière | 20 | **20** | 2-4 P |
  | Chariot léger | 30 | **30** | 2-4 A |
  | Chariot moyen | 50 | **60** | 2-6 A |
  | Chariot lourd | 75 | **100** | 2-8 A |

  + règle de trait (l.321) : « **Tirer un véhicule à roues = 1/10 de son Enc total pour l'animal.** »
- **Écart de curation confirmé** : `src/data/vehicles.json` — les véhicules TERRESTRES (`diligence`,
  `charrette`, `chariot`) n'ont **aucune** `capacity`/`chargement` (seuls les bateaux portent
  `ship.capacity`). Leurs `hull.char` (Endurance/B) proviennent pourtant de la table EDOC (charrette
  E25/B10, diligence E45/B50 = EDOC), donc la ligne a été extraite mais la colonne **Chargement** sautée.
  VERDICT : **trou de curation RAW**, pas une house-rule — recoller les valeurs EDOC ci-dessus.
  Note : nos 3 véhicules terrestres sont tagués `source.book: livre-de-base p.306` (table LDB générique) ;
  la table détaillée à 9 véhicules d'EDOC ch.4 n'est PAS instanciée en donnée (voir Lot A / hors-périmètre).

### 1.3 Vol / pillage en voyage

- **Terrestre — RAW muet en MÉCANIQUE.** La péripétie **« 6 Voleurs ! : les PJ se font dévaliser »**
  (LDB 51, Atlas `deplacement.md` l.409 ; donnée `src/data/peripeties.ts`) est classée `kind: 'narratif'`
  (`peripeties.ts:16`) → journalisée telle quelle, **aucun retrait de cargaison/or**. Les Rencontres
  dangereuses d'EDOC (`travelEncounter.ts`) ne rendent qu'une CATÉGORIE de table, sans effet cargo. Le RAW
  ne chiffre pas une perte de marchandise terrestre → **house-rule paramétrable** si on veut la matérialiser.
- **Fluvial / naval — RAW EXISTE (voie d'eau).** Combat naval MDG/MSRC (Atlas `catalogue-divers.md`) :
  - l.1213 (bateau qui prend l'eau) : « **Si la cargaison n'est pas étanche, elle perd d10 pourcentage de
    sa valeur jusqu'à ce qu'elle soit sauvée.** »
  - l.1178 (bateau ouvert type barque) : « Un coup qui touche l'équipage sur un bateau ouvert […] peut
    aussi atteindre la **cargaison** : les conséquences doivent être improvisées […]. »
  VERDICT : perte de cargaison sur voie d'eau = **RAW à implémenter** (pas encore modélisée hors rats/naufrage).
- **Mer — DÉJÀ implémenté** : rats (`sea-events.json` infestation, `spoilEncPerNight: 1d10`, appliqué
  `seaVoyageFlow.ts:924-928`) ; naufrage (`shipwreck.ts:95-97` purge `vessel: null` → coque + cale perdues).

### 1.4 Cogue pirate — AFFORDANCE PARTIELLEMENT MORTE (écart RAW)

- **Donnée** `src/data/sea-events.json:602-616`, `id: cogue-pirate`, `kind: navire-hostile`,
  `source: mer-des-griffes p.131` (ch.15 « Longs voyages », TABLEAU DES ÉVÉNEMENTS DE BORD). Desc verbatim :
  > « Cogue pirate. Une cogue avec un équipage de 25 personnes et 6 grands canons apparaît à l'horizon. Si
  > votre navire ressemble à une cible vulnérable, les forbans approchent et exigent de pouvoir **fouiller
  > la cale et prendre ce qu'ils veulent**, sinon ils tueront tous ceux qui s'opposent à eux. Même si leurs
  > demandes sont satisfaites, ils réclament ensuite **un prisonnier à sacrifier à Stromfels**. »
- **Couture réelle** : `seaVoyageFlow.ts:1655-1665` — `navire-hostile` est traité IDENTIQUE à `nemesis` :
  il pose une `crisis: { kind: 'poursuite', foeM: 5, … }` (course-poursuite / fuite, MDG ch.13 l.362-370).
  **Aucun** `removeCargo`, aucune branche « se soumettre → cale pillée + prisonnier ». `params.ship`/`crew`/
  `greatGuns` de la donnée ne sont pas lus.
- **VERDICT (écart RAW à consigner)** : la donnée DÉCRIT une extorsion (pillage de cale + prisonnier) que le
  moteur n'offre PAS — seule la fuite/poursuite est jouable. La branche « exiger de fouiller la cale et
  prendre ce qu'ils veulent » et le tribut à Stromfels sont une affordance narrative morte
  (`seaVoyageFlow.ts:1655` vs `sea-events.json:604`). À réparer une fois `removeCargo` routé sur le porteur.

### 1.5 Propriété immobilière — RAW MUET (mécanique) → house-rules

- **Aucune fiche Atlas** sur l'achat de bien / entrepôt / boutique / revenus locatifs (balayage des 27
  fiches + catalogues ; grep `entrepôt|immobil|loyer|propriétaire|rente`).
- Le **Statut** (LDB ch.8, Atlas `carrieres.md`/`activites.md`) régit le **Revenu par échelon** (Activité
  *Revenus*, `activites.md` l.361-384 : Bronze 2d10 sc / Argent 1d10 pa / Or 1 CO par Standing) — c'est du
  standing social, PAS de la propriété.
- Les « **Possessions** » de départ de carrière (Prince Marchand : « hôtel particulier…, entrepôt » ;
  Noble : « domaine, 2 entrepôts » — `catalogue-carrieres.md` l.625/633) sont des trappings de départ
  **sans règle de gestion** (stockage, achat, revenu locatif).
- **MSLRC ch.10 « Personnalisation »** (`sources-vf.md` l.61) = 8 traits d'aménagement de BARGE
  (`naval-traits.json`), pas de la propriété immobilière.
- VERDICT : **RAW MUET en mécanique de propriété** → tout ce maillon est du gameplay **maison paramétrable**
  (règle 7 : arbitrage explicite tagué, jamais « le MJ décide »). Voir §5 pour les arbitrages à valider.
  Ancre naturelle du standing de logement = le Statut social LDB ch.8.

---

## 2. Le modèle générique : `CargoCarrier` (« porteur de charge »)

**Décision 1 — UN concept, quatre attributs.** Un porteur = `{ capacité (Enc), contenu, exposition au
risque, co-localisation }`. On NE crée PAS un type par maillon : héros, bête de bât, véhicule terrestre,
bâtiment, barge, navire sont des INSTANCES du même concept, différant par leur *source de capacité* et leur
*modèle de contenu*.

**Décision 2 — deux modèles de contenu déjà existants, réconciliés, pas fusionnés de force.** Le repo porte
DÉJÀ deux façons de stocker :
- **`ItemInstance[]`** (objets discrets, `Combatant.items`) avec contenants imbriqués — primitive
  `container.capacity` + `containerFillEnc`/`canStow`/`defaultContainerFor` (`engine/items.ts:318-349`,
  `types.ts:867`). C'est le contenu du HÉROS et de tout objet discret.
- **`CargoLot[]`** (marchandise en vrac par Enc, `engine/cargo.ts:43`) : `{ cargoId, enc, basePriceGold }`
  + `cargoTotalEnc`/`removeCargo`. C'est le contenu de la CALE (navire) et du CONVOI (`caravanCargo`).

  → **Le porteur expose les DEUX canaux** : `items?: ItemInstance[]` ET `cargo?: CargoLot[]`. Enc total du
  porteur = `totalEncumbrance(items)` (héros existant) OU `cargoTotalEnc(cargo)` (bulk) OU les deux additionnés
  (une mule peut porter et des lots ET des objets discrets). On NE force PAS le marchand à convertir ses
  fûts de vin en `ItemInstance` ni ses armes en `CargoLot`. Piste ÉCARTÉE : un modèle de contenu unique —
  les deux sites divergent (identité par objet vs fongibilité par Enc), comme le note la doctrine des
  primitives (fusion forcée = poison).

**Décision 3 — la capacité vient de la donnée du maillon, via un résolveur UNIQUE.**
`carrierCapacity(carrier): number` (nouveau, `engine/cargo.ts` — tronc commun déjà partagé) :
- héros → `maxEncumbrance(c)` (existant `items.ts:234`, BF+BE+talents) — **inchangé** ;
- bête de bât → `MountProfile.encPortee` (nouveau champ, §1.1) ;
- véhicule terrestre → `VehicleDef.chargement` (nouveau champ, §1.2) ;
- barge / navire → `ship.capacity` (existant `vehicles.json`, MDG ch.12) ;
- bâtiment → `BuildingDef.storageEnc` (donnée maison, §5).

**Décision 4 — l'exposition au risque et la surcharge sont des VERDICTS purs, keyés par la NATURE du
porteur, pas par un flag ad hoc.** Deux tables de paliers RAW co-existent déjà et NE se confondent pas :
- **porteur à jambes** (héros, bête de bât, litière portée) → paliers LDB 61 l.34-41 (×1/×2/×3 →
  −M/−Ag/+Fatigue) : primitive existante `encumbrancePenalties` (`engine/encumbrance.ts`) ;
- **porteur à coque** (véhicule, barge, navire) → paliers MDG ch.12 l.66-77 (Contenance : >C → −1M/−1DR Man,
  +20 % → −2, +40 % → −3, +50 % → interdit de prendre la mer) : primitive existante `seaVoyage.ts` (surcharge
  testée `sea-cargo-overload.test.ts`).

  → `carrierOverload(carrier)` (nouveau, `engine/cargo.ts`) DISPATCHE vers la bonne table selon
  `carrier.kind`. On NE recopie AUCUN seuil : on route vers la primitive déjà écrite. Le véhicule terrestre
  surchargé emprunte les paliers de la bête de trait qui le tire (règle EDOC « 1/10 de l'Enc total », §1.2) —
  arbitrage §5.

**Décision 5 — co-localisation = un prédicat de LIEU, pas un lien dur.** Deux porteurs sont co-localisés
s'ils sont au même endroit jouable : même `MapPlace` de la carte du monde (`worldMap.ts`), ou embarqués
(mule/chariot chargé sur une barge = `carrier.aboard: string` référençant l'uid du porteur-hôte). Le
transfert (§3) n'est proposé qu'entre porteurs co-localisés. Pas de graphe de possession : la co-localisation
se DÉRIVE (lieu courant du groupe + `aboard`), elle n'est pas un 2ᵉ état à maintenir.

**Décision 6 — où vit un porteur ?** Trois hébergements selon le cycle de vie, sans nouveau silo :
- **héros** = `Combatant` du groupe (inchangé) ;
- **bête / véhicule POSSÉDÉ** = déjà un `ItemInstance` sur un héros (trapping `animaux-et-vehicules` /
  `vehicles.json`, cf. `mountInjury` sur l'instance `types.ts:873`). Son `cargo`/`items` s'accroche à
  l'instance (nouveau champ optionnel sur `ItemInstance`, migration par défaut) ;
- **navire de campagne** = `CampaignVessel` (existant) — `CampaignVessel.cargo` (`store.ts:1248`) EST le
  porteur, on ne le double pas ;
- **bâtiment possédé** = nouvelle entrée d'un registre `properties` au niveau GROUPE (§5, house-rule).

**Décision 7 — `caravanCargo` migre vers le porteur réel.** Aujourd'hui `store.caravanCargo` (`store.ts:1189`)
= cargaison FLUVIALE/TERRESTRE au niveau GROUPE, « information, pas plafond » (`landMarketFlow.ts:76`). Cible :
la cargaison terrestre vit sur le VÉHICULE (chariot/charrette) qui la porte, ou à défaut d'un véhicule sur les
héros/bêtes ; la cargaison fluviale vit sur la `CampaignVessel` fluviale (barge). `caravanCargo` devient un
champ de COMPATIBILITÉ transitoire (convoi sans véhicule matérialisé), retiré une fois la matérialisation
faite — migration de save versionnée (§4).

---

## 3. Le transfert unique entre porteurs co-localisés

**Décision 8 — UN mécanisme `moveCargo(from, to, sel)` (store action), pas N boutons.** Réutilise :
- pour un lot bulk → `removeCargo(from.cargo, cargoId, enc)` (existant) puis push sur `to.cargo` ;
- pour un objet discret → `giveTrapping`/déplacement d'`ItemInstance` (existant, primitive canonique de
  transfert d'objet vers un héros ; à généraliser « vers un porteur ») ;
- garde-fou : le transfert refuse si `carrierFreeEnc(to) < enc` OU signale la surcharge résultante (paliers
  §Décision 4) sans l'interdire pour les porteurs à jambes (RAW autorise le surchargé), l'interdit au-delà de
  +50 % pour une coque (MDG « impossible de prendre la mer »).

**Décision 9 — surface UI = `ScreenShell` à deux volets, PAS une 2ᵉ modale de transfert.** L'écran de
co-localisation (marché/escale/campement) liste les porteurs présents ; sélectionner deux porteurs affiche
leurs contenus côte à côte et route sur `moveCargo`. Réutiliser `ScreenShell` (`src/ui/ScreenShell.tsx`) +
`SearchFilterField` pour filtrer un gros contenu. Le « charger son chariot sur la barge » = `moveCargo` +
positionner `chariot.aboard = barge.uid`.

---

## 4. Verrous (invariants à tenir)

1. **Source unique par porteur.** `vessel.cargo` reste l'UNIQUE cale du navire ; on ne crée jamais un
   `vessel.hold2`. Idem `Combatant.items` reste l'unique inventaire héros. `carrierCapacity`/`carrierOverload`
   LISENT, ne dupliquent pas.
2. **Data-driven.** `encPortee` (montures.json) et `chargement` (vehicles.json) sont de la DONNÉE éditable au
   Compendium, taguée `source` (EDOC ch.4). Les paliers restent dans les primitives moteur existantes.
3. **Pureté engine.** `carrierCapacity`/`carrierOverload`/`moveCargo` (calcul) vivent dans `engine/cargo.ts`
   (pur, testé) ; le store n'orchestre que la persistance (`shipDamage.ts` est le patron : `damageHull`/
   `healHull` routent `applyOps`, la couche state enchaîne la persistance).
4. **Migration de save (#301).** Tout nouvel état persisté (cargo sur `ItemInstance`, registre `properties`,
   `aboard`) entre par le snapshot zéro-maintenance (`saves.ts:76`, clés de `getInitialState` /
   `stateFields.ts`) — un champ absent d'une vieille save garde son défaut, jamais `undefined`. Le RETRAIT de
   `caravanCargo` (restructuration de FORME) exige un bump `SAVE_VERSION` (4→5) + entrée `MIGRATIONS[5]`
   (rehéberge les lots sur le véhicule/navire) + fixture golden `v5-*.json` (cliquet `saves-flow.test.ts`).
5. **Risque à jet = seam/cascade.** Toute perte de cargaison décidée par un Test (voie d'eau d10 % §1.3,
   soumission au pillage §1.4) passe par le système de jet unifié (`rollFlowFactory`/`RollShell`), jamais un
   `rollTest` inline — comme la marche forcée influençable (`travelFlow.ts`).
6. **Labels = affichage.** `carrier.kind`, `cargoId`, ids de porteur sont STABLES ; les libellés (« Le
   Cormoran », « Mule ») restent du `label`/`name` d'affichage.

---

## 5. Arbitrages MAISON à VALIDER par l'utilisateur (règle 7)

> Chaque point ci-dessous est RAW-muet ou une extrapolation ; il ne sera codé qu'après validation, tagué
> maison + paramétrable. Rien n'est présumé « entériné ».

**A5.1 — Perte de cargaison terrestre (embuscade/vol).** RAW muet en mécanique (§1.3, péripétie « Voleurs ! »
narrative). PROPOSITION maison : une péripétie/rencontre dangereuse terrestre peut retirer `X %` d'Enc de
cargaison du porteur (paramètre `landRobberySpoilPct`, défaut 0 = off pour rester conservateur). À VALIDER :
active-t-on un vol terrestre chiffré, et à quel taux ?

**A5.2 — Perte de cargaison fluviale/naval sur voie d'eau.** RAW EXISTE (§1.3, d10 % de VALEUR si non
étanche). Question de MODÈLE, pas d'existence : notre `CargoLot` porte de l'Enc + un prix de base, pas une
« valeur courante ». PROPOSITION : appliquer le d10 % sur l'Enc du lot (proxy de valeur), tagué RAW-dérivé.
À VALIDER : d10 % sur l'Enc (simple) OU sur `basePriceGold` (fidèle mais réduit un lot en Enc de façon non
triviale) ?

**A5.3 — Cogue pirate : branche « se soumettre ».** RAW décrit l'extorsion (§1.4) mais sans chiffrer « ce
qu'ils prennent ». PROPOSITION maison : choix joueur à l'événement — (a) fuir (poursuite actuelle), (b)
combattre, (c) se soumettre → les pirates vident un % de la cale (`piratePillagePct`, défaut 100 % « prennent
ce qu'ils veulent ») + exigent un prisonnier (perte d'1 PNJ d'équipage via `applyVesselCrewLoss`, ou refus →
combat). À VALIDER : offre-t-on la soumission, et le tribut à Stromfels se modélise-t-il en perte d'équipage ?

**A5.4 — Propriété immobilière (magasin/entrepôt/habitation).** RAW MUET (§1.5). PROPOSITION maison
paramétrable, ancrée au Statut LDB ch.8 :
- un bâtiment possédé = porteur `{ storageEnc, placeId, kind: 'batiment' }` — stockage sûr et co-localisé à
  son Lieu (transfert §3 quand le groupe y est) ;
- ACHAT : prix par type de bien (donnée `properties.json` maison, taguée) ;
- REVENU LOCATIF : optionnel, brancher sur l'Activité *Revenus* existante (`activities.ts` `statusIncome`) —
  un bien peut ajouter un revenu forfaitaire par intervalle, PAS une nouvelle économie parallèle.
- À VALIDER en OUVERTURE d'une session dédiée : périmètre (stockage seul ? + revenu ? + entretien/taxes ?),
  barème de prix, et si le logement influe sur le Statut affiché. **C'est le plus gros arbitrage** — il pilote
  le Lot D.

**A5.5 — Capacité de bât d'un passager humain.** LDB 61 l.19 : « ~10 Enc par passager, modulable ». À
confirmer comme paramètre `passengerEnc` (défaut 10).

**A5.6 — Surcharge du véhicule terrestre.** EDOC (§1.2) donne le Chargement mais route la pénalité sur la BÊTE
qui tire (« 1/10 de l'Enc total »). PROPOSITION : au-delà du Chargement, appliquer les paliers de la bête de
trait attelée. À VALIDER : suffit-il de plafonner au Chargement (dur) ou modélise-t-on la pénalité de traction ?

---

## 6. Découpage d'exécution (tickets à ouvrir par #327)

Estimations : S ≤ ½ j, M ≈ 1 j, L ≈ 2-3 j (un agent). Chaque lot = suite verte + fixture/golden si état
persisté touché.

- **Lot A — Curation RAW (trous de donnée) — S.** Ajouter `encPortee` à `montures.json` (9 profils, EDOC
  verbatim §1.1) + champ `chargement` aux véhicules terrestres de `vehicles.json` (§1.2). Étendre les schémas
  `MountProfile` (`mountTravel.ts`) et le type véhicule. Test : valeurs conformes EDOC (patron
  `mountTravel.test.ts`). **Aucune** logique de gameplay encore — juste la donnée + garde. Débloque tout le reste.
  (Hors-périmètre A : instancier les 6 véhicules EDOC manquants — charrette à bras, litières, chaise — est une
  extension de catalogue séparée, pas requise par le porteur.)

- **Lot B — Le tronc `CargoCarrier` — M.** Dans `engine/cargo.ts` : `carrierCapacity`, `carrierFreeEnc`,
  `carrierOverload` (dispatch jambes/coque vers `encumbrancePenalties`/surcharge MDG), pur + testé. Aucune
  UI. Réutilise `maxEncumbrance`/`cargoTotalEnc`/`totalEncumbrance`. Verrou : ne recopie aucun seuil.

- **Lot C — Matérialisation bête/véhicule + transfert — L.** Champ `cargo?`/`items?` + `aboard?` sur
  `ItemInstance` (migration par défaut) ; `moveCargo` (store) sur `removeCargo`/`giveTrapping` ; écran de
  co-localisation en `ScreenShell` (§3). Migre `caravanCargo` → porteur véhicule (bump `SAVE_VERSION` 4→5 +
  `MIGRATIONS[5]` + fixture golden `v5-*.json`). Plafonds réels appliqués partout (Lot B). Répare l'affordance
  au marché terrestre (`landMarketFlow.ts` : la contenance devient un plafond, plus « information »).

- **Lot D — Risque sur marchandise + Cogue pirate — M (après validation A5.1-A5.3).** Voie d'eau d10 %
  (fluvial/naval, seam de jet) ; branche soumission de la Cogue pirate (`seaVoyageFlow.ts` : lire
  `params.ship`/`crew`, offrir fuir/combattre/se soumettre, router `removeCargo` sur `vessel.cargo` +
  `applyVesselCrewLoss`). Vol terrestre si A5.1 validé.

- **Lot E — Propriété immobilière — L (après session dédiée A5.4).** Registre `properties` (house-rule),
  achat, stockage co-localisé, revenu locatif branché sur l'Activité *Revenus*. Le plus incertain — gated par
  l'arbitrage utilisateur.

**Ordre imposé** : A → B → C (fondations data + moteur + matérialisation), puis D et E en parallèle une fois
leurs arbitrages validés.

---

## 7. Hors-périmètre explicite

- Refonte de l'inventaire HÉROS (`Combatant.items`, contenants) — le héros est déjà un porteur conforme, on
  l'expose au concept sans le refondre.
- Combat naval tactique / artillerie / améliorations de navire (chantier séparé, cf. mémoire naval).
- Instanciation des 6 véhicules EDOC absents du catalogue (extension de données indépendante).
- Économie de campagne globale (banque, investissement) — déjà couverte par `activities.ts`, non touchée sauf
  le branchement de revenu locatif A5.4.
- Toute règle non citée en §1 : reste omission assumée jusqu'à grounding.
