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
| `src/state/combatEffects.ts` | 1 | canonique | 414 | canonique : le corps d'`openSkillTest` (combatEffects.ts:308) — LA fabrique du `pendingTest` de la famille Flow authorée, le pending y est monté UNE fois pour tous ses appelants. |
| `src/state/combatFlow.ts` | 2 | mixte | 2791, 6737 | 1 gate de main (`pendingHandGate`, `openAttackCascade`) monté à la main -> #1064 ; 1 `PendingReload` d'ennemi construit APRÈS un `rollSansPilote` déjà scellé — canonique : objet de RENDU (journal/popin), aucun jet à ouvrir. |
| `src/state/combatSlice.ts` | 5 | dette | 1854, 1900, 1997, 2414, 2812 | 2 `pendingReload` (pièce servie / poste de navire), 1 `pendingStateRecovery`, 1 `pendingHandGate` (2ᵉ main), 1 `pendingHeal` -> #1064 (le lot d'affichage les re-route ; 6 -> 5 : le `pendingTest` de `battleGainAdvantage` passe par `openSkillTest`). |
| `src/state/interludeFlow.ts` | 1 | dette | 731 | `pendingActivity` du catalogue d'Activités (`openCatalogActivity`) — fabrique UNIQUE de toutes les Activités à jet d'interlude -> #1064. |
| `src/state/massBattleFlow.ts` | 1 | dette | 355 | `openBattleActivity` — fabrique PARTAGÉE, atteinte par 7 call-sites (inspire/prep ×3/round ×2/resistance) -> #1067 (surfaçage massBattle). |
| `src/state/medicFlow.ts` | 2 | dette | 153, 179 | `pendingHeal` et `pendingSurgery` du soigneur PNJ hors combat -> #1064. |
| `src/state/merchantFlow.ts` | 1 | dette | 849 | `pendingAppraise` (Évaluation / Intuition de détection) -> #1064. |
| `src/state/seaVoyageFlow.ts` | 1 | dette | 1851 | `pendingSteamSave` (`openSteamSave`, Test d'Initiative de l'ingénieur) -> #1064. |
| `src/state/store.ts` | 1 | canonique | 2421 | canonique : re-ciblage d'un `pendingTest` EXISTANT (`{ ...pt, … }`) sur un autre candidat — `target` recopié du candidat DÉJÀ calculé par la fabrique, aucun jet neuf décrit. |

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
| `src/state/combatEffects.ts` | 2 | tri | `drawWaterDisease`, `traumaOnImpossibleAmbition` | population NON QUALIFIÉE : 1 tirage de TABLE (`drawWaterDisease`, maladie tirée au sort) et 1 conséquence à enjeu (`traumaOnImpossibleAmbition`) — tri site par site -> #1070. |
| `src/state/combatFlow.ts` | 34 | tri | `applyHullCritical`, `critWoundLocation`, `opposedTest`, `resolveCounterspell`, `resolveMelee`, `resolvePostEncounterAmputations`, `resolveRanged`, `resolveRun`, `resolveTrample`, `rollCritical`, `rollDisengageAttack`, `rollGrappleForce`, `rollMeleeAttacker`, `rollMeleeDefender`, `rollMiscast`, `rollOups`, `rollRangedAttacker`, `rollStructureCritical` | population NON QUALIFIÉE : le fichier mêle des tirages de TABLE (`critWoundLocation`, `rollOups`, `rollCritical`, `rollMiscast`) et des confrontations à enjeu (`resolveMelee`/`resolveRanged`, `rollGrappleForce`, `opposedTest`) — tri site par site -> #1070. |
| `src/state/combatSetup.ts` | 1 | dette | `initiativeOrder` | `initiativeOrder` — l'Initiative de mise en place roule la ligne entière d'un coup -> #1064. |
| `src/state/combatSlice.ts` | 9 | tri | `animositeOrHaine`, `resolveCasting`, `resolveCrewTestByRoles`, `resolveMagicMissile`, `resolveVolley`, `rollDisengageAttack`, `rollGrappleForce`, `rollMeleeDefender`, `rollOups` | population NON QUALIFIÉE : tirages de table (`rollOups`) et confrontations à enjeu (`resolveCasting`, `resolveCrewTestByRoles`, `rollMeleeDefender`) dans le même fichier — tri site par site -> #1070. |
| `src/state/devtools.ts` | 1 | canonique | `tickDisease` | canonique : `tickDisease` appelé par l'outil de DEV (avance forcée d'une maladie) — hors partie jouée, aucune surface de jet à offrir. |
| `src/state/landMarketFlow.ts` | 6 | tri | `opposedTest`, `rollCargoQuantity`, `rollFindMerchant`, `rollRandomLandCargo`, `rollTradeRumour` | population NON QUALIFIÉE : 4 tirages de TABLE (`rollFindMerchant`, `rollCargoQuantity`, `rollRandomLandCargo`, `rollTradeRumour`) et 2 `opposedTest` de marchandage à enjeu — tri site par site -> #1070. |
| `src/state/massBattleFlow.ts` | 1 | dette | `resolveClash` | `resolveClash` (massBattleFlow.ts:845) → `rollMightTest` (engine/massBattle.ts:124) → `rollTest` : LE site fondateur du trou engine-délégué -> #1067. |
| `src/state/merchantFlow.ts` | 1 | tri | `rollStock` | population NON QUALIFIÉE : `rollStock` est un tirage de disponibilité d'étal (table), pas un jet à surfacer par le lot d'affichage — tri site par site -> #1070. |
| `src/state/outOfCombatUpkeep.ts` | 1 | dette | `bleedDeathRoll` | `bleedDeathRoll` hors combat (entretien quotidien) -> #1064. |
| `src/state/portFlow.ts` | 3 | tri | `rollMerchantOpposition`, `rollRandomCargo` | population NON QUALIFIÉE : 1 tirage de TABLE (`rollRandomCargo`) et 2 `rollMerchantOpposition` (opposition de négoce à enjeu) — tri site par site -> #1070. |
| `src/state/restFlow.ts` | 2 | tri | `restRecovery`, `rollContraction` | population NON QUALIFIÉE : 1 tirage de TABLE (`rollContraction`, contagion au repos) et 1 Test de récupération à enjeu (`restRecovery`) — tri site par site -> #1070. |
| `src/state/riverVoyageFlow.ts` | 3 | tri | `resolveCapsizeRighting`, `resolveRiverImpact` | population NON QUALIFIÉE : 2 `resolveRiverImpact` (impact de rive, dégâts tirés) et 1 `resolveCapsizeRighting` (Test de redressement à enjeu) — tri site par site -> #1070. |
| `src/state/seaVoyageFlow.ts` | 6 | tri | `exposureNight`, `rollBoardEvent`, `rollDebrisEntangle`, `rollSteamBreakdown`, `rollStranding`, `rollWeeklyFouling` | population NON QUALIFIÉE : tirages de TABLE / dés de monde (`rollBoardEvent`, `rollWeeklyFouling`, `rollDebrisEntangle`, `rollStranding`) et périls à enjeu (`exposureNight`, `rollSteamBreakdown`) — tri site par site -> #1070. |
| `src/state/shipBattery.ts` | 1 | dette | `resolveCrewTestByRoles` | `resolveCrewTestByRoles` — Test d'équipage de la batterie -> #1067 (même famille navale qu'`openCrewTestPending`). |
| `src/state/tavernFlow.ts` | 2 | canonique | `rollTavernTest` | canonique : `rollTavernTest` est la primitive `roll*` à UN SEUL jet extraite en #370 — appelée en POST-COMMIT par l'applier (patron `portFlow.ts`), le jet du joueur passant, lui, par le seam. |
| `src/state/travelFlow.ts` | 3 | tri | `forcedMarchTest`, `resolveMountedDay`, `rollStageWeather` | population NON QUALIFIÉE : 1 tirage de TABLE (`rollStageWeather`, météo d'étape) et 2 Tests à enjeu (`forcedMarchTest` marche forcée, `resolveMountedDay` journée montée) — tri site par site -> #1070. |
| `src/state/upkeep.ts` | 4 | tri | `dailyDiseaseUpkeep`, `dailyFoodUpkeep`, `dailyWaterUpkeep`, `tickTraumaRecovery` | population NON QUALIFIÉE : `dailyFoodUpkeep`/`dailyWaterUpkeep`/`dailyDiseaseUpkeep`/`tickTraumaRecovery` sont des Tests d'entretien à enjeu résolus en silence, hors du périmètre d'affichage — tri site par site -> #1070. |

_87 call-sites mesurés dans 19 fichiers, pour 83 exports rouleurs dérivés de `src/engine` — par nature : 73 tri, 11 dette, 3 canonique._

> **Nature** (`kind`) : `dette` = tous les sites doivent disparaître · `tri` = population non qualifiée
> (tirage de table légitime ⇄ Test à enjeu silencieux), tri site par site · `canonique` = aucun site ne bouge ·
> `mixte` = l'entrée porte les deux natures. Sans ce discriminant, « cette liste décroît » ne veut rien dire.

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
reste `ROLL_SEAM_PHASE2_STOCK`. 37 sites dans 15 fichiers.

| Fichier | Sites |
|---|---|
| `src/state/combat/roundHooks.ts` | 1 |
| `src/state/combatEffects.ts` | 1 |
| `src/state/combatFlow.ts` | 5 |
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

