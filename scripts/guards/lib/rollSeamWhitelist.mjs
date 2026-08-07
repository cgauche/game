// Whitelist PARTAGÉE du garde « exclusivité du seam de jet » (#274) — SOURCE UNIQUE consommée par
// `src/state/roll-seam-exclusivity-guard.test.ts` (Vitest) ET `scripts/git-hooks/pre-commit.mjs`
// (double détente). Deux listes DISJOINTES, de nature différente :
//
//  1. `ROLL_SEAM_CORE` — exclusion de PRINCIPE : ces fichiers SONT le seam (la porte, la fabrique, le
//     séquenceur, les résolveurs de spec, le pont de Test déclenché en combat). Leur `rollTest(`/
//     `TestOutcome.seal(` est le foyer que le garde protège, pas un contournement : les exclure n'est
//     pas une exemption mais la définition du périmètre. Aucun compte : cette liste ne décroît pas.
//  2. `ROLL_SEAM_PHASE2_STOCK` — stock MESURÉ de sites restant à router par le seam (#918 phase 2),
//     fichier → nombre de sites. Le compte est VÉRIFIÉ par le test : un site de plus dans un de ces
//     fichiers est rouge, et un site migré exige de mettre le compte à jour ICI. Cette liste décroît
//     jusqu'à disparaître ; on n'y ajoute pas de fichier.
//     DEUX sorties LÉGITIMES du stock, pas une seule : (a) `openRoll` — le jet est SURFACÉ (policy
//     M/V/I) ; (b) `rollSansPilote` (`rollSeam.ts`) — le call-site a DÉJÀ établi qu'aucun humain ne
//     contrôle l'acteur, le jet reste inline mais l'invariant (« pas de jet silencieux d'un acteur
//     `humanControlled` ») est asserté dans le noyau au lieu d'être bricolé au call-site. La phase 2a
//     a fait 51 → 39 par la voie (b) sur 12 sites (roundHooks 4→1, turnHooks 1→0, combatFlow 10→5,
//     shipwreck 2→0, travelFlow 7→6).
//
// Les formes (S) « position de spec » et (M) « dé de monde » ne sont PLUS des entrées de liste : elles
// sont reconnues STRUCTURELLEMENT par le scanner (cf. en-tête de `rollSeamExclusivity.mjs`). C'est ce
// qui a retiré `src/data/mutations.ts`, `landMarketFlow.ts`, `shipCrew.ts` (tous leurs sites sont des
// dés de monde) ; `rollFlowFactory.ts` a rejoint le noyau, et `encounterPsychFlow.ts`/`restFlow.ts`
// n'avaient plus AUCUN site (leurs occurrences vivaient dans des commentaires).

/** Le seam lui-même — exclusion de principe, sans compte. @type {Set<string>} */
export const ROLL_SEAM_CORE = new Set([
  'src/state/rollSeam.ts',
  'src/state/rollFlowFactory.ts',
  'src/state/cascade.ts',
  'src/state/rollFlowSpecs.ts',
  'src/state/combat/triggeredTest.ts',
]);

/** Stock à résorber (#918 phase 2) : fichier → nombre de sites MESURÉ. @type {Map<string, number>} */
export const ROLL_SEAM_PHASE2_STOCK = new Map([
  ['src/state/combat/roundHooks.ts', 1],
  ['src/state/combatEffects.ts', 1],
  ['src/state/combatFlow.ts', 5],
  ['src/state/combatManeuvers.ts', 4],
  ['src/state/corruptionFlow.ts', 1], // 2 → 1 (#942 L5 : le d100 « corps ou esprit » passe par l'étape à table)
  ['src/state/interludeFlow.ts', 3], // 4 → 3 (#942 L7 : le d100 d'Événement passe par l'étape à table)
  ['src/state/massBattleFlow.ts', 1],
  ['src/state/pursuitFlow.ts', 1],
  ['src/state/riverVoyageFlow.ts', 4],
  ['src/state/seaVoyageFlow.ts', 4],
  ['src/state/shipManeuver.ts', 2],
  ['src/state/travelFlow.ts', 6],
  ['src/state/travelPostes.ts', 1],
  ['src/state/triggeredEffects.ts', 1],
  ['src/state/upkeep.ts', 2],
]);

/** @type {Set<string>} */
export const ROLL_SEAM_FILE_WHITELIST = new Set([...ROLL_SEAM_CORE, ...ROLL_SEAM_PHASE2_STOCK.keys()]);

/** @param {string} rel @returns {boolean} */
export function rollSeamExcluded(rel) {
  return rel.startsWith('src/engine/') || ROLL_SEAM_FILE_WHITELIST.has(rel);
}

// ===========================================================================================
// REGISTRE DES CHEMINS DE JET (#1066) — la POLICY des deux familles neuves scannées par
// `rollSeamExclusivity.mjs` (`scanPendingJetFabrication`, `engineRollerExports` +
// `scanEngineDelegatedRoll`), plus l'énumération des familles CANONIQUES d'ouverture de jet.
// SOURCE UNIQUE : le test Vitest la VÉRIFIE (compte mesuré = compte déclaré, aucune entrée sans
// justification, aucune entrée périmée) et la doc `docs/registre-jets.md` en est DÉRIVÉE.
// ===========================================================================================

/**
 * Entrée de stock : nombre de sites MESURÉ + `kind` + justification ÉCRITE. Le `kind` porte
 * l'INVARIANT de l'entrée — sans lui, « cette liste décroît » (en-tête de `ROLL_SEAM_PHASE2_STOCK`)
 * ne vaut que pour une partie des entrées, et un lot futur ne sait pas laquelle doit tomber à zéro.
 * TROIS états, chacun VÉRIFIÉ par le test — le tri de population est SOLDÉ (#1070) : chaque entrée est
 * qualifiée site par site, et `'tri'` n'est plus une valeur acceptée (contrat POSITIF du garde).
 *  - `'dette'`     — TOUS les sites doivent disparaître ; `why` cite le ticket (`#N`) qui les emporte.
 *  - `'canonique'` — aucun site ne bouge ; `why` COMMENCE par « canonique » et dit la raison mesurée.
 *  - `'mixte'`     — l'entrée porte les deux natures (l'entrée ne tombera pas à 0) ; `why` cite un
 *                    ticket ET le mot « canonique ».
 * @typedef {{ n: number, kind: 'dette'|'canonique'|'mixte', why: string }} StockEntry
 */

/**
 * (F) FABRICATION D'UN PENDING DE JET — fichier → { sites mesurés, kind, justification }.
 * Population figée AVANT le lot d'affichage #1064 : ce qui n'est pas ici est une régression.
 * @type {Map<string, StockEntry>}
 */
export const PENDING_JET_FABRICATION_STOCK = new Map([
  ['src/state/combatEffects.ts', { n: 1, kind: 'canonique', why: 'canonique : le corps d\'`openSkillTest` (combatEffects.ts:308) — LA fabrique du `pendingTest` de la famille Flow authorée, le pending y est monté UNE fois pour tous ses appelants.' }],
  ['src/state/combatFlow.ts', { n: 2, kind: 'mixte', why: '1 gate de main (`pendingHandGate`, `openAttackCascade`) monté à la main -> #1064 ; 1 `PendingReload` d\'ennemi construit APRÈS un `rollSansPilote` déjà scellé — canonique : objet de RENDU (journal/popin), aucun jet à ouvrir.' }],
  ['src/state/combatSlice.ts', { n: 5, kind: 'dette', why: '2 `pendingReload` (pièce servie / poste de navire), 1 `pendingStateRecovery`, 1 `pendingHandGate` (2ᵉ main), 1 `pendingHeal` -> #1064 (le lot d\'affichage les re-route ; 6 -> 5 : le `pendingTest` de `battleGainAdvantage` passe par `openSkillTest`).' }],
  ['src/state/interludeFlow.ts', { n: 1, kind: 'dette', why: '`pendingActivity` du catalogue d\'Activités (`openCatalogActivity`) — fabrique UNIQUE de toutes les Activités à jet d\'interlude -> #1064.' }],
  ['src/state/massBattleFlow.ts', { n: 1, kind: 'dette', why: '`openBattleActivity` — fabrique PARTAGÉE, atteinte par 7 call-sites (inspire/prep ×3/round ×2/resistance) -> #1067 (surfaçage massBattle).' }],
  ['src/state/medicFlow.ts', { n: 2, kind: 'dette', why: '`pendingHeal` et `pendingSurgery` du soigneur PNJ hors combat -> #1064.' }],
  ['src/state/merchantFlow.ts', { n: 1, kind: 'dette', why: '`pendingAppraise` (Évaluation / Intuition de détection) -> #1064.' }],
  ['src/state/seaVoyageFlow.ts', { n: 1, kind: 'dette', why: '`pendingSteamSave` (`openSteamSave`, Test d\'Initiative de l\'ingénieur) -> #1064.' }],
  ['src/state/store.ts', { n: 1, kind: 'canonique', why: 'canonique : re-ciblage d\'un `pendingTest` EXISTANT (`{ ...pt, … }`) sur un autre candidat — `target` recopié du candidat DÉJÀ calculé par la fabrique, aucun jet neuf décrit.' }],
]);

/**
 * (D) ROULAGE DÉLÉGUÉ AU MOTEUR — fichier → { call-sites mesurés, kind, justification }. Un site = un
 * appel, depuis `src/state`/`src/ui`, d'un export de `src/engine` qui roule (liste DÉRIVÉE par
 * `engineRollerExports`, clôture transitive). Les fichiers de `ROLL_SEAM_CORE` sont hors périmètre
 * (ils SONT le seam) ; la forme (S) « position de spec » garde son exclusion structurelle.
 * @type {Map<string, StockEntry>}
 */
export const ENGINE_DELEGATED_ROLL_STOCK = new Map([
  ['src/state/combat/roundHooks.ts', { n: 1, kind: 'dette', why: '`bleedDeathRoll` (Hémorragie mortelle) roulé en fin de ronde -> #1064.' }],
  ['src/state/combat/turnHooks.ts', { n: 6, kind: 'dette', why: 'psychologie de début de tour (`resolveFrenzyEntry`/`resolveTerreurTest`/`resolvePeurTest` ×2/`resolveCalmeSimple` ×2) -> #1064.' }],
  ['src/state/combatEffects.ts', { n: 2, kind: 'mixte', why: 'canonique : `drawWaterDisease` (:1545) tire la maladie sur la table d100 (MSRC 16 p.91) dans l\'applier d\'une étape DÉJÀ surfacée — le jet d\'exposition est imprimé, le tirage n\'est que sa conséquence. Dette : `traumaOnImpossibleAmbition` (:1157) roule un Test de Calme de HÉROS dans le mutateur, 45,09 % de Trauma permanent -> #1103.' }],
  ['src/state/combatFlow.ts', { n: 34, kind: 'mixte', why: 'canonique pour les tirages de TABLE surfacés en étape/reveal (`critWoundLocation`, `rollOups`, `rollCritical`, `rollMiscast`, `applyHullCritical`, `rollStructureCritical`) et pour les confrontations DÉJÀ affichées (`resolveRanged`, `resolveMelee` :761, `rollDisengageAttack`, `rollGrappleForce` :1138, `rollMeleeAttacker` :2693, `rollRangedAttacker`, `resolveCounterspell`, `resolveRun`). Dettes : bouclier (`rollMeleeAttacker` :2630) -> #1093 ; attaque gratuite (`resolveMelee` :3151) et 2ᵉ main (`rollMeleeDefender` :787) -> #1094, surface du dual-wield -> #998 ; amputations post-rencontre (:5398) -> #1095 ; `rollGrappleForce` :1166 et `opposedTest` :6779 -> #1096.' }],
  ['src/state/combatSetup.ts', { n: 1, kind: 'dette', why: '`initiativeOrder` — l\'Initiative de mise en place roule la ligne entière d\'un coup -> #1064.' }],
  ['src/state/combatSlice.ts', { n: 9, kind: 'mixte', why: 'canonique pour 7 sites : la Volée en table (`resolveVolley` :208), le Test d\'équipage d\'un navire piloté par l\'IA (`resolveCrewTestByRoles` :1378), et les jets affichés (`rollDisengageAttack` :727, `rollGrappleForce` :792, `rollOups` :2433, `resolveMagicMissile` :2945, `resolveCasting` :2946). Dettes : `rollMeleeDefender` :560 (défense au désengagement) -> #1097 ; `animositeOrHaine` :130 (Animosité acquise sur un Destin dépensé) -> #1098.' }],
  ['src/state/devtools.ts', { n: 1, kind: 'canonique', why: 'canonique : `tickDisease` appelé par l\'outil de DEV (avance forcée d\'une maladie) — hors partie jouée, aucune surface de jet à offrir.' }],
  ['src/state/landMarketFlow.ts', { n: 5, kind: 'mixte', why: 'canonique pour 4 sites : `rollFindMerchant`/`rollCargoQuantity`/`rollRandomLandCargo` sont des dés de MONDE et des tables (MSRC 13 l.22-42/l.129-160), et `rollTradeRumour` tire sa rumeur dans l\'applier d\'un `openPartyTest` DÉJÀ surfacé (MSRC 13 l.176-180). Dette : le Marchandage opposé n\'a plus qu\'UN site physique, `bargainOpposed` (:222) — source unique achat + vente, ordre RNG inchangé -> #1099.' }],
  ['src/state/massBattleFlow.ts', { n: 1, kind: 'dette', why: '`resolveClash` (massBattleFlow.ts:845) → `rollMightTest` (engine/massBattle.ts:124) → `rollTest` : LE site fondateur du trou engine-délégué -> #1067.' }],
  ['src/state/merchantFlow.ts', { n: 1, kind: 'canonique', why: 'canonique : `rollStock` (:208) est le Test de DISPONIBILITÉ de l\'étal (LDB 59 l.50) — un dé d\'ÉTAL sur RNG seedé, sans valeur de PJ à influencer, et sa révélation passe déjà par la porte MJ `openStockRevealCascade`.' }],
  ['src/state/outOfCombatUpkeep.ts', { n: 1, kind: 'dette', why: '`bleedDeathRoll` hors combat (entretien quotidien) -> #1064.' }],
  ['src/state/portFlow.ts', { n: 3, kind: 'mixte', why: 'canonique : `rollRandomCargo` (:118) est un tirage de TABLE de cargaison. Dettes : les 2 `rollMerchantOpposition` (:228, :305) sont des Marchandages opposés résolus en silence -> #580.' }],
  ['src/state/restFlow.ts', { n: 2, kind: 'dette', why: 'les 2 sites du chemin EAGER de la nuit (`sleepParty`) : `restRecovery` (:163, Test de Résistance Accessible +20, LDB 18 l.296) et `rollContraction` (:203, contagion de promiscuité, LDB 20 l.206) — 118 Tests silencieux mesurés sur une nuit de groupe, `rollContraction` sans même un dé rendu ; le chemin à cascade passe déjà par `onDeferTest` -> #1101.' }],
  ['src/state/riverVoyageFlow.ts', { n: 2, kind: 'canonique', why: 'canonique : les 2 `resolveRiverImpact` tirent les dégâts d\'un péril sur d100 (MSRC 7 l.138-144), le pilote humain ayant DÉJÀ joué son `riverPerilDetect`. Le redressement d\'un chavirage est passé en étapes Round par Round (#1104a) : plus aucun Test de HÉROS roulé en boucle ici.' }],
  ['src/state/seaVoyageFlow.ts', { n: 5, kind: 'mixte', why: 'canonique pour 4 sites : `rollBoardEvent` (événement de bord, MDG 15 l.89), `rollSteamBreakdown` (MDG 12 l.313, tiré APRÈS un Test surfacé), `rollDebrisEntangle` et `rollStranding` (périls de mer, MDG 13 l.485-499). L\'Exposition du jour est passée en étapes influençables (#1104b). Dette restante : `rollWeeklyFouling` (40,22 % sans trace) -> #1105.' }],
  ['src/state/shipBattery.ts', { n: 1, kind: 'dette', why: '`resolveCrewTestByRoles` — Test d\'équipage de la batterie -> #1067 (même famille navale qu\'`openCrewTestPending`).' }],
  ['src/state/tavernFlow.ts', { n: 2, kind: 'canonique', why: 'canonique : `rollTavernTest` est la primitive `roll*` à UN SEUL jet extraite en #370 — appelée en POST-COMMIT par l\'applier (patron `portFlow.ts`), le jet du joueur passant, lui, par le seam.' }],
  ['src/state/travelFlow.ts', { n: 3, kind: 'mixte', why: 'canonique : `rollStageWeather` (:610) est un d100 de MONDE sur la table de saison (EDOC 8 l.42) — aucun acteur ne le porte. Dettes : `forcedMarchTest` (:712, marche forcée) -> #1102 ; `resolveMountedDay` (:863, journée en selle EDOC 07 l.142-146 dont le Test de Chevaucher du CAVALIER l.165-174, rendu en lecture seule, 69,96 % d\'échecs) -> #1106.' }],
  ['src/state/upkeep.ts', { n: 4, kind: 'canonique', why: 'canonique : `dailyFoodUpkeep`/`dailyWaterUpkeep`/`dailyDiseaseUpkeep`/`tickTraumaRecovery` reçoivent `onDeferTest`, qui transforme chaque Test d\'entretien en étape de cascade influençable sur les chemins principaux (store.ts:2564, :2570) ; le seul appelant sans defer est le chemin eager de `restFlow.ts` (:154), ticketé #1101 côté restFlow.' }],
]);

/**
 * Les familles CANONIQUES d'ouverture de jet — l'énumération que le registre publie. Chaque entrée est
 * VÉRIFIÉE par le test : le symbole existe, à ce fichier, avec ce statut d'export. `exported: false`
 * n'est pas un défaut à corriger en douce, c'est un FAIT mesuré qui explique pourquoi la famille était
 * hors registre (un symbole module-local ne se cherche pas depuis l'extérieur).
 * @type {{ name: string, file: string, exported: boolean, role: string }[]}
 */
export const SEAM_CALLERS = [
  { name: 'openRoll', file: 'src/state/rollSeam.ts', exported: true, role: 'LA porte déclarative : le call-site DÉCRIT un `RollRequest`, la porte résout la policy de surfaçage M/V/I.' },
  { name: 'openPartyTest', file: 'src/state/rollSeam.ts', exported: true, role: 'Porte du jet de GROUPE (meilleur / assisté) — même policy, acteur choisi dans le groupe.' },
  { name: 'openWorldTest', file: 'src/state/rollSeam.ts', exported: true, role: 'Porte du jet de MONDE (aucun acteur porteur) — propriétaire = le siège MJ via `worldOwner`.' },
  { name: 'makeRollFlow', file: 'src/state/rollFlowFactory.ts', exported: true, role: 'La FABRIQUE de flux de jet : une spec (`resolve`/`reresolve`/`rollActor`…) devient un flux à modale.' },
  { name: 'FLOWS', file: 'src/state/rollFlowSpecs.ts', exported: true, role: 'Le CATALOGUE des specs de flux montées par `makeRollFlow` — position (S) du garde d\'exclusivité.' },
  { name: 'openSkillTest', file: 'src/state/combatEffects.ts', exported: true, role: 'Ouvre le `pendingTest` d\'un nœud `test` de Flow AUTHORÉ (donnée : sorts, effets déclenchés, consommables).' },
  { name: 'rollTableStep', file: 'src/state/cascade.ts', exported: true, role: 'Étape de cascade « à table » : le dé est lu en table (d100 → fourchette), surfacé comme une étape.' },
  { name: 'openCrewTestPending', file: 'src/state/combatSlice.ts', exported: false, role: '3ᵉ famille NAVALE (Test d\'équipage : manœuvre, batterie, type libre) — MODULE-LOCALE, 3 call-sites internes ; sa localité est exactement ce qui l\'a tenue hors registre jusqu\'ici (-> #1067).' },
];
