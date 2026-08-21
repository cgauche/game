# Registre des chemins de jet — GÉNÉRÉ

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-registre-jets.mjs` (`npm run docs:registre-jets`) — NE PAS ÉDITER À LA MAIN.
> Source : le module de gardes `scripts/guards/lib/rollSeamWhitelist.mjs` (listes + justifications) et
> `scripts/guards/lib/rollSeamExclusivity.mjs` (scanners AST). Les comptes ci-dessous sont ceux du garde
> `src/state/roll-seam-exclusivity-guard.test.ts` — un seul comptage, jamais deux.

## À quoi ça sert

Répondre à « **par où passe ce jet ?** » sans relire les flux. Trois populations coexistent :
les familles CANONIQUES d'ouverture (un jet décrit à une porte), et deux populations de DETTE que
les gardes d'exclusivité laissaient passer par construction — un pending de jet monté à la main au
call-site, et un roulage délégué à un export de `src/engine`. Ce registre les FIGE : un site de plus,
une entrée devenue vide ou une entrée sans justification échouent la garde.

## Périmètre mesuré et angles morts (à dire pour ne pas se lire comme exhaustif)

- **(F)** ne voit qu'un **littéral d'objet** : un pending assemblé par spread depuis un helper, ou monté champ
  par champ, échappe. La conjonction `skillValue` + (`target` \| `roll: null`) est un resserrement DÉLIBÉRÉ —
  `skillValue:` seul remonte 200+ faux positifs (types, paramètres de résolveur, patches de champ).
- **(D)** résout par **nom appelé**, sans suivi de liaison : un import renommé (`import { resolveClash as x }`)
  ou un appel indirect (référence passée en callback) échappe. Même angle mort que le garde d'exclusivité.
- **(D)** indexe les fonctions de `src/engine` par nom **à plat** : deux homonymes dans deux modules se
  confondent, et un homonyme local d'un rouleur peut faire entrer un export au titre de la transitivité.
- **(D)** ne scanne que `src/state` et `src/ui` (les consommateurs de flux) ; **(F)** scanne tout `src`.
- **Un tirage qui n'appelle ni `rollTest` ni `d100` n'est vu par AUCUN des trois scanners** — ex. le `d10` de
  `massBattleFlow.ts:834` (`massBattleSetHazard`, facteur environnemental du Round, `ADE II 8 l.309`) : un jet du
  RAW résolu en silence, hors de tout registre. Le surfaçage vit sur #1067, qui le nomme déjà.
- Les formes **(S)** « position de spec » et **(M)** « dé de monde » restent des exclusions par FORME du garde
  d'exclusivité (critères et angles morts : en-tête de `scripts/guards/lib/rollSeamExclusivity.mjs`).
- La population authorée ne compte que `src/data/spells.json` — les autres porteurs de `FlowTest` (traits,
  talents, États, consommables) ne sont pas dénombrés ici.
- Les **justifications** sont écrites à la main : ce sont des engagements, pas des mesures. Le registre garantit
  qu'elles EXISTENT et que les comptes sont exacts, pas qu'elles disent vrai.

## Familles CANONIQUES d'ouverture de jet

| Famille | Site | Exportée | Rôle |
|---|---|---|---|
| `openRoll` | `src/state/rollSeam.ts` | oui | LA porte déclarative : le call-site DÉCRIT un `RollRequest`, la porte résout la policy de surfaçage M/V/I. |
| `openPartyTest` | `src/state/rollSeam.ts` | oui | Porte du jet de GROUPE (meilleur / assisté) — même policy, acteur choisi dans le groupe. |
| `openWorldTest` | `src/state/rollSeam.ts` | oui | Porte du jet de MONDE (aucun acteur porteur) — propriétaire = le siège MJ via `worldOwner`. |
| `makeRollFlow` | `src/state/rollFlowFactory.ts` | oui | La FABRIQUE de flux de jet : une spec (`resolve`/`reresolve`/`rollActor`…) devient un flux à modale. |
| `FLOWS` | `src/state/rollFlowSpecs.ts` | oui | Le CATALOGUE des specs de flux montées par `makeRollFlow` — position (S) du garde d'exclusivité. |
| `openSkillTest` | `src/state/combatEffects.ts` | oui | Ouvre le `pendingTest` d'un nœud `test` de Flow AUTHORÉ (donnée : sorts, effets déclenchés, consommables). |
| `rollTableStep` | `src/state/cascade.ts` | oui | Étape de cascade « à table » : le dé est lu en table (d100 → fourchette), surfacé comme une étape. |
| `openCrewTestPending` | `src/state/combatSlice.ts` | **non** (module-locale) | 3ᵉ famille NAVALE (Test d'équipage : manœuvre, batterie, type libre) — MODULE-LOCALE, 3 call-sites internes ; sa localité est exactement ce qui l'a tenue hors registre jusqu'ici (-> #1067). |

_8 familles énumérées — chacune VÉRIFIÉE (le symbole existe, à ce fichier, avec ce statut d'export)._

## (F) Fabrication d'un pending de jet au call-site

Signature AST discriminante : un littéral d'objet portant `skillValue:` **et** (`target:` **ou** `roll: null`)
— l'objet décrit DÉJÀ la cible du jet ou son emplacement de dé vide, donc un jet décrit hors de la porte.
Le roulage, lui, arrive plus tard et passe par le seam : rien ne le signalait. Les fichiers du noyau du
seam (`ROLL_SEAM_CORE`) sont hors périmètre — leur pending EST le foyer.

| Fichier | Sites | Nature | Lignes | Justification |
|---|---|---|---|---|
| `src/state/combatEffects.ts` | 1 | canonique | 471 | canonique : le corps d'`openSkillTest` (combatEffects.ts:308) — LA fabrique du `pendingTest` de la famille Flow authorée, le pending y est monté UNE fois pour tous ses appelants. |
| `src/state/combatFlow.ts` | 2 | mixte | 3070, 7318 | 1 gate de main (`pendingHandGate`, `openAttackCascade`) monté à la main -> #1064 ; 1 `PendingReload` d'ennemi construit APRÈS un `rollSansPilote` déjà scellé — canonique : objet de RENDU (journal/popin), aucun jet à ouvrir. |
| `src/state/combatSlice.ts` | 5 | dette | 1944, 1990, 2097, 2546, 2946 | 2 `pendingReload` (pièce servie / poste de navire), 1 `pendingStateRecovery`, 1 `pendingHandGate` (2ᵉ main), 1 `pendingHeal` -> #1064 (le lot d'affichage les re-route ; 6 -> 5 : le `pendingTest` de `battleGainAdvantage` passe par `openSkillTest`). |
| `src/state/interludeFlow.ts` | 1 | dette | 749 | `pendingActivity` du catalogue d'Activités (`openCatalogActivity`) — fabrique UNIQUE de toutes les Activités à jet d'interlude -> #1064. |
| `src/state/massBattleFlow.ts` | 1 | dette | 369 | `openBattleActivity` — fabrique PARTAGÉE, atteinte par 6 call-sites (prep ×3/round ×2/resistance) -> #1067 (surfaçage massBattle). |
| `src/state/medicFlow.ts` | 2 | dette | 175, 201 | `pendingHeal` et `pendingSurgery` du soigneur PNJ hors combat -> #1064. |
| `src/state/merchantFlow.ts` | 1 | dette | 879 | `pendingAppraise` (Évaluation / Intuition de détection) -> #1064. |
| `src/state/seaVoyageFlow.ts` | 1 | dette | 2081 | `pendingSteamSave` (`openSteamSave`, Test d'Initiative de l'ingénieur) -> #1064. |
| `src/state/store.ts` | 1 | canonique | 2531 | canonique : re-ciblage d'un `pendingTest` EXISTANT (`{ ...pt, … }`) sur un autre candidat — `target` recopié du candidat DÉJÀ calculé par la fabrique, aucun jet neuf décrit. |

_15 sites mesurés dans 9 fichiers — par nature : 11 dette, 2 canonique, 2 mixte._

## (D) Roulage délégué à un export de `src/engine`

`rollSeamExcluded` exempte `src/engine/**` de principe (le moteur reçoit un rng, il ne décide pas du
surfaçage) — ce qui suppose que l'APPELANT passe par le seam. Un export d'engine qui roule, appelé par un
flux, rend donc le call-site invisible aux deux gardes. La liste des rouleurs est **dérivée** (corps appelant
`rollTest`/`d100`, puis clôture TRANSITIVE — sans elle, `resolveClash` (qui ne roule qu'à travers
`rollMightTest`) reste invisible), `rollTest`/`d100` eux-mêmes exclus (population du garde d'exclusivité).
La forme (S) « position de spec » garde son exclusion structurelle.

| Fichier | Sites | Nature | Rouleurs appelés | Justification |
|---|---|---|---|---|
| `src/state/combat/roundHooks.ts` | 1 | dette | `bleedDeathRoll` | `bleedDeathRoll` (Hémorragie mortelle) roulé en fin de ronde -> #1064. |
| `src/state/combat/turnHooks.ts` | 6 | dette | `resolveCalmeSimple`, `resolveFrenzyEntry`, `resolvePeurTest`, `resolveTerreurTest` | psychologie de début de tour (`resolveFrenzyEntry`/`resolveTerreurTest`/`resolvePeurTest` ×2/`resolveCalmeSimple` ×2) -> #1064. |
| `src/state/combatEffects.ts` | 2 | mixte | `drawWaterDisease`, `traumaOnImpossibleAmbition` | canonique : `drawWaterDisease` (:1545) tire la maladie sur la table d100 (MSRC 16 p.91) dans l'applier d'une étape DÉJÀ surfacée — le jet d'exposition est imprimé, le tirage n'est que sa conséquence. Dette : `traumaOnImpossibleAmbition` (:1157) roule un Test de Calme de HÉROS dans le mutateur, 45,09 % de Trauma permanent -> #1103. |
| `src/state/combatFlow.ts` | 34 | mixte | `applyHullCritical`, `critWoundLocation`, `opposedTest`, `resolveCounterspell`, `resolveMelee`, `resolvePostEncounterAmputations`, `resolveRanged`, `resolveRun`, `resolveTrample`, `rollCritical`, `rollDisengageAttack`, `rollGrappleForce`, `rollMeleeAttacker`, `rollMeleeDefender`, `rollMiscast`, `rollOups`, `rollRangedAttacker`, `rollStructureCritical` | canonique pour les tirages de TABLE surfacés en étape/reveal (`critWoundLocation`, `rollOups`, `rollCritical`, `rollMiscast`, `applyHullCritical`, `rollStructureCritical`) et pour les confrontations DÉJÀ affichées (`resolveRanged`, `resolveMelee` :761, `rollDisengageAttack`, `rollGrappleForce` :1138, `rollMeleeAttacker` :2693, `rollRangedAttacker`, `resolveCounterspell`, `resolveRun`). Dettes : bouclier (`rollMeleeAttacker` :2630) -> #1093 ; attaque gratuite (`resolveMelee` :3151) et 2ᵉ main (`rollMeleeDefender` :787) -> #1094, surface du dual-wield -> #998 ; amputations post-rencontre (:5398) -> #1095 ; `rollGrappleForce` :1166 et `opposedTest` :7033 (récupération d'État jouée par l'IA, résolue sans modale) -> #1096. |
| `src/state/combatSetup.ts` | 1 | dette | `initiativeOrder` | `initiativeOrder` — l'Initiative de mise en place roule la ligne entière d'un coup -> #1064. |
| `src/state/combatSlice.ts` | 9 | mixte | `animositeOrHaine`, `resolveCasting`, `resolveCrewTestByRoles`, `resolveMagicMissile`, `resolveVolley`, `rollDisengageAttack`, `rollGrappleForce`, `rollMeleeDefender`, `rollOups` | canonique pour 7 sites : la Volée en table (`resolveVolley` :208), le Test d'équipage d'un navire piloté par l'IA (`resolveCrewTestByRoles` :1378), et les jets affichés (`rollDisengageAttack` :727, `rollGrappleForce` :792, `rollOups` :2433, `resolveMagicMissile` :2945, `resolveCasting` :2946). Dettes : `rollMeleeDefender` :560 (défense au désengagement) -> #1097 ; `animositeOrHaine` :130 (Animosité acquise sur un Destin dépensé) -> #1098. |
| `src/state/devtools.ts` | 1 | canonique | `tickDisease` | canonique : `tickDisease` appelé par l'outil de DEV (avance forcée d'une maladie) — hors partie jouée, aucune surface de jet à offrir. |
| `src/state/interludeFlow.ts` | 3 | canonique | `deMonde` | canonique : les 3 `deMonde` (:1048-1050) tirent le Générateur de mission du contremaître (AA 12 l.63-144) dans l'applier d'un Test de Ragot DÉJÀ surfacé — contenu de CONSÉQUENCE, porte SILENCIEUSE du canal (#1426) ; visibles ici depuis leur migration, là où la forme (M) les blanchissait. |
| `src/state/landMarketFlow.ts` | 5 | mixte | `opposedTest`, `rollCargoQuantity`, `rollFindMerchant`, `rollRandomLandCargo`, `rollTradeRumour` | canonique pour 4 sites : `rollFindMerchant`/`rollCargoQuantity`/`rollRandomLandCargo` peuplent la HALLE à l'arrivée (`openLandMarket`, MSRC 13 l.22-42) et passent par le CANAL des dés de monde — la fenêtre de LOT (#1426, `etalLotFlow`) : chaque dé y est une rangée posable, nommée par ce qu'elle décide. `rollTradeRumour` tire sa rumeur dans l'applier d'un `openPartyTest` DÉJÀ surfacé (MSRC 13 l.176-180). Dette : le Marchandage opposé n'a plus qu'UN site physique, `bargainOpposed` — source unique achat + vente, ordre RNG inchangé -> #1099. |
| `src/state/massBattleFlow.ts` | 1 | dette | `resolveClash` | `resolveClash` (massBattleFlow.ts:845) → `rollMightTest` (engine/massBattle.ts:124) → `rollTest` : LE site fondateur du trou engine-délégué -> #1067. |
| `src/state/merchantFlow.ts` | 1 | canonique | `rollStock` | canonique : `rollStock` (:208) est le Test de DISPONIBILITÉ de l'étal (LDB 59 l.50) — un dé d'ÉTAL sur RNG seedé, sans valeur de PJ à influencer, et sa révélation passe déjà par la porte MJ `openStockRevealCascade`. |
| `src/state/outOfCombatUpkeep.ts` | 1 | dette | `bleedDeathRoll` | `bleedDeathRoll` hors combat (entretien quotidien) -> #1064. |
| `src/state/portFlow.ts` | 3 | mixte | `rollMerchantOpposition`, `rollRandomCargo` | canonique : `rollRandomCargo` peuple l'ÉTAL à l'arrivée (`openPort`) et passe par le CANAL des dés de monde — la fenêtre de LOT (#1426, `etalLotFlow`) : ses tirages sont posables d'un bloc avant l'écran quand l'option « Dés fixés » est active, et strictement identiques sinon. Dettes : les 2 `rollMerchantOpposition` sont des Marchandages opposés résolus en silence -> #580. |
| `src/state/restFlow.ts` | 2 | dette | `restRecovery`, `rollContraction` | les 2 sites du chemin EAGER de la nuit (`sleepParty`) : `restRecovery` (:163, Test de Résistance Accessible +20, LDB 18 l.296) et `rollContraction` (:203, contagion de promiscuité, LDB 20 l.206) — 118 Tests silencieux mesurés sur une nuit de groupe, `rollContraction` sans même un dé rendu ; le chemin à cascade passe déjà par `onDeferTest` -> #1101. |
| `src/state/riverVoyageFlow.ts` | 3 | canonique | `deMonde`, `resolveRiverImpact` | canonique : les 2 `resolveRiverImpact` tirent les dégâts d'un péril sur d100 (MSRC 7 l.138-144), le pilote humain ayant DÉJÀ joué son `riverPerilDetect`. Le redressement d'un chavirage est passé en étapes Round par Round (#1104a) : plus aucun Test de HÉROS roulé en boucle ici. 3ᵉ site (#1426) : `deMonde` (:677) rejoue la chance du péril dans l'applier de l'étape `riverPerilCheck` DÉJÀ posée — porte SILENCIEUSE du canal, rendue VISIBLE ici par sa migration. |
| `src/state/seaVoyageFlow.ts` | 4 | mixte | `rollDebrisEntangle`, `rollSteamBreakdown`, `rollStranding`, `rollWeeklyFouling` | canonique pour 3 sites : `rollSteamBreakdown` (MDG 12 l.313, tiré APRÈS un Test surfacé), `rollDebrisEntangle` et `rollStranding` (périls de mer, MDG 13 l.485-499). L'événement de bord a QUITTÉ ce stock : il est une étape à TABLE de monde (`sea-board-events`, `mod` = Humeur de Manann), poussée dans la cascade du jour après les périls d'auteur. L'Exposition du jour est passée en étapes influençables (#1104b). Dette restante : `rollWeeklyFouling` (40,22 % sans trace) -> #1105. |
| `src/state/shipBattery.ts` | 1 | dette | `resolveCrewTestByRoles` | `resolveCrewTestByRoles` — Test d'équipage de la batterie -> #1067 (même famille navale qu'`openCrewTestPending`). |
| `src/state/shipCrew.ts` | 1 | canonique | `deMonde` | canonique : `deMonde` (:479) rejoue la désertion à la relâche, un dé par membre présent (MDG 14 l.192-202), dans l'applier de l'étape `sea-desertion` que `seaVoyageFlow` a DÉJÀ ouverte par `openWorldTest` — porte SILENCIEUSE du canal (#1426), le site est visible ici au lieu d'être blanchi par la forme (M). |
| `src/state/tavernFlow.ts` | 2 | canonique | `rollTavernTest` | canonique : `rollTavernTest` est la primitive `roll*` à UN SEUL jet extraite en #370 — elle ne roule QUE le côté ADVERSAIRE ABSTRAIT (la salle), et seulement quand aucun héros ne tient ce camp : deux héros ouvrent une BANDE où chacun joue SON jet par le seam (#1279 S1). Deux sites : le gel à l'ouverture de la manche (fabrique du socle de séquence) et son repli dans le réducteur de clôture si le gel manque. |
| `src/state/travelFlow.ts` | 2 | dette | `forcedMarchTest`, `resolveMountedDay` | la Météo d'Étape a QUITTÉ ce stock : elle est une étape à TABLE de monde (`stage-weather-<saison>`, posable), son applier insérant ce qui dépend du temps qu'il fait. Restent deux dettes : `forcedMarchTest` (marche forcée) -> #1102 ; `resolveMountedDay` (journée en selle EDOC 07 l.142-146 dont le Test de Chevaucher du CAVALIER l.165-174, rendu en lecture seule, 69,96 % d'échecs) -> #1106. |
| `src/state/upkeep.ts` | 4 | canonique | `dailyDiseaseUpkeep`, `dailyFoodUpkeep`, `dailyWaterUpkeep`, `tickTraumaRecovery` | canonique : `dailyFoodUpkeep`/`dailyWaterUpkeep`/`dailyDiseaseUpkeep`/`tickTraumaRecovery` reçoivent `onDeferTest`, qui transforme chaque Test d'entretien en étape de cascade influençable sur les chemins principaux (store.ts:2564, :2570) ; le seul appelant sans defer est le chemin eager de `restFlow.ts` (:154), ticketé #1101 côté restFlow. |

_87 call-sites mesurés dans 21 fichiers, pour 81 exports rouleurs dérivés de `src/engine` — par nature : 57 mixte, 15 dette, 15 canonique._

> **Nature** (`kind`) : `dette` = tous les sites doivent disparaître · `canonique` = aucun site ne bouge ·
> `mixte` = l'entrée porte les deux natures. Sans ce discriminant, « cette liste décroît » ne veut rien dire.
> Le tri de population est SOLDÉ (#1070) : `tri` n'est plus une valeur acceptée — chaque entrée est qualifiée site par site.

## Population AUTHORÉE (donnée, pas code)

**46** nœuds `test` (`FlowTest`) dans `src/data/spells.json`. Ce n'est pas un stock : la donnée
n'a pas de call-site à router. Son chemin de résolution est unique et à DEUX routeurs mesurés :

- `resolveFlowTest` (`src/state/combat/triggeredTest.ts`) — voie CADENCE-AWARE : ouvre `openSkillTest` (modale influençable) quand l'acteur est piloté.
- `resolveInlineFlowTest` (`src/state/triggeredEffects.ts`) — jumeau store-free de la branche NON-interactive du précédent (jet résolu inline, journalisé).

Le premier ouvre `openSkillTest` (famille canonique) ; le second est sa branche non-interactive. Un nœud
`test` enfoui sans routeur cadence-aware lève (`resolveInlineFlowTest` : « un test enfoui exige un routeur
cadence-aware ») — c'est le fail-closed de la donnée.

## Rappel — stock du garde d'exclusivité (`rollTest`/`d100`/`TestOutcome.seal` bruts)

Population historique (#918 phase 2), listée ici pour que le registre soit la vue COMPLÈTE ; sa source
reste `ROLL_SEAM_PHASE2_STOCK`. 35 sites dans 15 fichiers.

| Fichier | Sites |
|---|---|
| `src/state/combat/roundHooks.ts` | 1 |
| `src/state/combatEffects.ts` | 1 |
| `src/state/combatFlow.ts` | 3 |
| `src/state/combatManeuvers.ts` | 4 |
| `src/state/corruptionFlow.ts` | 1 |
| `src/state/interludeFlow.ts` | 3 |
| `src/state/massBattleFlow.ts` | 1 |
| `src/state/pursuitFlow.ts` | 1 |
| `src/state/riverVoyageFlow.ts` | 4 |
| `src/state/seaVoyageFlow.ts` | 4 |
| `src/state/shipManeuver.ts` | 2 |
| `src/state/travelFlow.ts` | 6 |
| `src/state/travelPostes.ts` | 1 |
| `src/state/triggeredEffects.ts` | 1 |
| `src/state/upkeep.ts` | 2 |

