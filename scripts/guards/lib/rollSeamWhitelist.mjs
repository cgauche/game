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
 * Quatre états, chacun VÉRIFIÉ par le test :
 *  - `'dette'`     — TOUS les sites doivent disparaître ; `why` cite le ticket (`#N`) qui les emporte.
 *  - `'tri'`       — population NON QUALIFIÉE (tirage de table légitime ⇄ Test à enjeu silencieux) :
 *                    le tri se fait site par site, `why` cite son ticket de tri.
 *  - `'canonique'` — aucun site ne bouge ; `why` COMMENCE par « canonique » et dit la raison mesurée.
 *  - `'mixte'`     — l'entrée porte les deux natures (l'entrée ne tombera pas à 0) ; `why` cite un
 *                    ticket ET le mot « canonique ».
 * @typedef {{ n: number, kind: 'dette'|'tri'|'canonique'|'mixte', why: string }} StockEntry
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
  ['src/state/combatEffects.ts', { n: 2, kind: 'tri', why: 'population NON QUALIFIÉE : 1 tirage de TABLE (`drawWaterDisease`, maladie tirée au sort) et 1 conséquence à enjeu (`traumaOnImpossibleAmbition`) — tri site par site -> #1070.' }],
  ['src/state/combatFlow.ts', { n: 34, kind: 'tri', why: 'population NON QUALIFIÉE : le fichier mêle des tirages de TABLE (`critWoundLocation`, `rollOups`, `rollCritical`, `rollMiscast`) et des confrontations à enjeu (`resolveMelee`/`resolveRanged`, `rollGrappleForce`, `opposedTest`) — tri site par site -> #1070.' }],
  ['src/state/combatSetup.ts', { n: 1, kind: 'dette', why: '`initiativeOrder` — l\'Initiative de mise en place roule la ligne entière d\'un coup -> #1064.' }],
  ['src/state/combatSlice.ts', { n: 9, kind: 'tri', why: 'population NON QUALIFIÉE : tirages de table (`rollOups`) et confrontations à enjeu (`resolveCasting`, `resolveCrewTestByRoles`, `rollMeleeDefender`) dans le même fichier — tri site par site -> #1070.' }],
  ['src/state/devtools.ts', { n: 1, kind: 'canonique', why: 'canonique : `tickDisease` appelé par l\'outil de DEV (avance forcée d\'une maladie) — hors partie jouée, aucune surface de jet à offrir.' }],
  ['src/state/landMarketFlow.ts', { n: 6, kind: 'tri', why: 'population NON QUALIFIÉE : 4 tirages de TABLE (`rollFindMerchant`, `rollCargoQuantity`, `rollRandomLandCargo`, `rollTradeRumour`) et 2 `opposedTest` de marchandage à enjeu — tri site par site -> #1070.' }],
  ['src/state/massBattleFlow.ts', { n: 1, kind: 'dette', why: '`resolveClash` (massBattleFlow.ts:845) → `rollMightTest` (engine/massBattle.ts:124) → `rollTest` : LE site fondateur du trou engine-délégué -> #1067.' }],
  ['src/state/merchantFlow.ts', { n: 1, kind: 'tri', why: 'population NON QUALIFIÉE : `rollStock` est un tirage de disponibilité d\'étal (table), pas un jet à surfacer par le lot d\'affichage — tri site par site -> #1070.' }],
  ['src/state/outOfCombatUpkeep.ts', { n: 1, kind: 'dette', why: '`bleedDeathRoll` hors combat (entretien quotidien) -> #1064.' }],
  ['src/state/portFlow.ts', { n: 3, kind: 'tri', why: 'population NON QUALIFIÉE : 1 tirage de TABLE (`rollRandomCargo`) et 2 `rollMerchantOpposition` (opposition de négoce à enjeu) — tri site par site -> #1070.' }],
  ['src/state/restFlow.ts', { n: 2, kind: 'tri', why: 'population NON QUALIFIÉE : 1 tirage de TABLE (`rollContraction`, contagion au repos) et 1 Test de récupération à enjeu (`restRecovery`) — tri site par site -> #1070.' }],
  ['src/state/riverVoyageFlow.ts', { n: 3, kind: 'tri', why: 'population NON QUALIFIÉE : 2 `resolveRiverImpact` (impact de rive, dégâts tirés) et 1 `resolveCapsizeRighting` (Test de redressement à enjeu) — tri site par site -> #1070.' }],
  ['src/state/seaVoyageFlow.ts', { n: 6, kind: 'tri', why: 'population NON QUALIFIÉE : tirages de TABLE / dés de monde (`rollBoardEvent`, `rollWeeklyFouling`, `rollDebrisEntangle`, `rollStranding`) et périls à enjeu (`exposureNight`, `rollSteamBreakdown`) — tri site par site -> #1070.' }],
  ['src/state/shipBattery.ts', { n: 1, kind: 'dette', why: '`resolveCrewTestByRoles` — Test d\'équipage de la batterie -> #1067 (même famille navale qu\'`openCrewTestPending`).' }],
  ['src/state/tavernFlow.ts', { n: 2, kind: 'canonique', why: 'canonique : `rollTavernTest` est la primitive `roll*` à UN SEUL jet extraite en #370 — appelée en POST-COMMIT par l\'applier (patron `portFlow.ts`), le jet du joueur passant, lui, par le seam.' }],
  ['src/state/travelFlow.ts', { n: 3, kind: 'tri', why: 'population NON QUALIFIÉE : 1 tirage de TABLE (`rollStageWeather`, météo d\'étape) et 2 Tests à enjeu (`forcedMarchTest` marche forcée, `resolveMountedDay` journée montée) — tri site par site -> #1070.' }],
  ['src/state/upkeep.ts', { n: 4, kind: 'tri', why: 'population NON QUALIFIÉE : `dailyFoodUpkeep`/`dailyWaterUpkeep`/`dailyDiseaseUpkeep`/`tickTraumaRecovery` sont des Tests d\'entretien à enjeu résolus en silence, hors du périmètre d\'affichage — tri site par site -> #1070.' }],
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
