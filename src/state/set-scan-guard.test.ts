import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { runSetScan } from '../../scripts/guards/lib/setScan.mjs';

/**
 * Garde-fou « set() bruts des flows » (#321 lentille 3, cliquet baseline patron `scripts/guards/lib/`) :
 * fige l'AGRÉGAT de `set({...})` de `src/state/*.ts` (hors `store.ts`/`stateFields.ts`) qui réinitialisent
 * un champ `STATE_FIELDS` (pending*) DIRECTEMENT, hors `...resetFields(...)`. MESURE globale, PAS un
 * verrou par-fichier : le rapport `docs/plans/2026-07-11-chasse-3-synthese.md` documente que la majorité
 * de ces sites sont des fermetures de modale LÉGITIMES (chaque flow ferme sa propre pending — cf. chasse-2
 * « cœur des set() sains ») ; ce cliquet borne la CROISSANCE non revue plutôt que d'exiger un helper
 * `clearPending` immédiat (aucune correction faite dans cette passe). Baseline gelée au recensement
 * (2026-07-11) : 689 set() / 280 resets ad hoc directs ; +1 set() légitime (voyage : l'applier de poste
 * SCINDÉ en `stagePoste` sans-Test + `stagePosteBatch` pour le pas batch des postes — chacun ré-émet le
 * groupe) ; +2 set() légitimes (#327 lot D : `spoilVesselCargoOnLeak` persiste la voie d'eau sur
 * `vessel.cargo`, et l'applier de soumission de la Cogue pirate y persiste le pillage — SOURCE UNIQUE).
 * +6 set() légitimes (#340 : budget d'heures PAR JOUR CALENDAIRE + portes de départ + nuit forcée —
 * `travelFlow` accumule le budget du jour `addTravelHoursToday`/`markMarchedToday`, pose/lève la porte
 * `pendingDeparture` ; `restFlow` marque la nuit jouée `lastNightDay` ×2) ; +2 resets ad hoc (la porte
 * `pendingDeparture` posée puis effacée à « Attendre l'aube »/au départ diurne — transient de carte).
 * +1 set() légitime (#341 : l'applier `weatherResistance` ré-émet le groupe après l'Exténué de traversée
 * Neige/Blizzard — MÊME patron que `stagePosteBatch`).
 * +3 set() légitimes (#344 : l'Exposition hydrique fluviale surfacée APRÈS le jour DIFFÈRE la halte de
 * nuit — `continueRiverDayAfterCascade` re-tague la cascade en `riverExposure` + fige la progression du
 * jour ; `continueRiverDayAfterExposure` efface ce transient puis reprend la fin du jour) ; +1 reset ad hoc
 * (`travelPlan: null` de garde quand la route/destination a disparu à la reprise post-Exposition).
 * +1 set() légitime (abordage GÉNÉRIQUE dérivé d'un navire hostile : `openGenericBoarding` INTERROMPT la
 * traversée + efface `sea.boarding` avant de transitionner vers la Scène d'abordage construite à la volée).
 * +2 set() légitimes (#341/#253 : `stampEnvWeatherAtCombatStart` estampille la météo du jour sur les
 * combattants à l'ouverture — SOURCE du canal « Tests physiques » ; `openCombatEndCascade` VIDE la file
 * `deferredUpkeepQueue` après consommation des Tests d'entretien différés) ; +1 reset ad hoc (ce
 * `deferredUpkeepQueue: []` = vidage de la file per-combat, jamais rejouée).
 * +1 set() légitime (#351 : `runCascadeImmediate` S'ARRÊTE et SURFACE `pendingCascade` sur un CHOIX sans
 * `defaultChoice` authoré — patron `resolveRemainingCascade`, jamais un `options[0]` silencieux) ; +1 reset
 * ad hoc (même site : pose directe de `pendingCascade`).
 * +1 set() légitime (#474a Se cabrer : `aiCreatureFreeAttacks` dépense l'Action de Mouvement
 * (`movementUsed = mountMovement`) AVANT `applyFreeAttack`, LDB 85 l.314 — coût distinct du `campSpend`
 * d'Avantage porté par `applyFreeAttack`, donc son propre `set()`).
 * +1 set() légitime (#558 : `castSetChosenTableRolls` pose `pendingCast.chosenTableRolls` — le jet sur
 * Tableau est DÉCLINABLE, EDOC 13 l.276 — même patron que `castAllocOvercast` déjà compté).
 * +1 set() légitime (#942 L5 : l'applier `mutationTable` re-émet les acteurs — `touchActors` — quand la
 * mutation est appliquée depuis un dé POSÉ, même patron que `resolveCorruption` pour le chemin inline).
 * +2 set() légitimes (#942 L7 : le dénouement d'un Événement d'interlude est PARTAGÉ par les deux
 * chemins — `finishInterludeEvent` persiste le héros résolu, `finishInterludeDraw` ouvre les Activités
 * après le dernier dé ; l'ouverture n'écrit plus qu'un état de phase `tirage`).
 * +4 resets ad hoc (#1135 / 30614b3b, résolution PARTAGÉE du déplacement) : `hoverDelta` (jauges EN
 * DIRECT du survol, `gameIso/stage/useHoverTargeting.ts`) est un transient de VUE remis à null par le
 * MÊME `set()` qui réécrit `battle.preview` — un seul cadre de rendu, sinon la jauge survit à l'aperçu
 * qu'elle chiffrait. Hors portée de `resetFields(scope)` : ses deux scopes sont des CADRES (`scene`,
 * `combatStart`), et `hoverDelta` porte `resetOn: []` (`stateFields.ts`) — un scope par geste de souris
 * casserait l'invariant du manifeste. Sites : `combatSlice.ts:846` (clic hors de toute portée : purge de
 * l'aperçu), `:883` (tap 1 zone de Course), `:893` (tap 1 aperçu de Marche), `:915` (commit du segment,
 * l'acteur a bougé). Les trois autres sites `hoverDelta` du même commit (`battleRun` 1223, `runConfirm`,
 * `runCancel`) étaient DÉJÀ comptés par leur `pendingRun` : ils n'ajoutent rien.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BASELINE = { totalCalls: 731, totalAdHocResets: 297 }; // +1 (#1117 L3 : `registerNightBandApplier` — le set() de persistance du groupe après la boucle PAR RANGÉE, écrit UNE fois pour les 13 kinds de nuit au lieu d'un par applier) // +1/+1 (#1042/#1059 : `counterspellDeclare` RÉÉCRIT les rangées de `pendingCounterspell` — la déclaration de phase 1 vit sur le participant, comme son `result` ; le « reset » compté est cette repose du pending entier, pas une purge) ; +1/+1 (#1029 : `routeCounterspell` MARQUE le moment du Contre-sort — `pendingCast.counterspellRouted` — pour que la fenêtre s'ouvre UNE fois, au jet ou après le choix de Critique ; le reset compté est la purge de `pendingCounterspell` par `castCancel` pré-jet, #1031 : plus de fenêtre orpheline) ; +4/+3 (#989 surfaçage de la défense : `openSurfacedDefense` POSE la fenêtre — une branche mêlée, une branche tir ; `runCleaveChain` accroche la chaîne de balayage PARQUÉE sur la fenêtre ; `defenseConfirm` rend l'attaque figée à `attackConfirm`) ; +1 (#352 innFlow.ts : set() du party après Exténué) ; +1 (#474a : coût Mouvement Se cabrer, aiCreatureFreeAttacks) ; +1/+1 (#476 : toggle harpoonRopeCut, set + reset du pendingAttack) ; +1/+1 (#558 : castSetChosenTableRolls) ; +1 (#508 : purgeAdventureEffects, upkeep.ts — même patron que purgeClockEffects) ; +1 (#491 : rerollWindsOfMagic, combatFlow.ts) ; +2 (#508/#510 : interludeFlow.ts — débit d'argent des résolveurs Réputation/Punchausen) ; +2 (#508 : interludeFlow.ts entrainementStart — débit du tuteur + application de l'Augmentation) ; +6 (#509 : favorFlow.ts — grantFavor/settleFavorActivity/resetInterruptedFavorProgress/breakFavor, nouveau flux) ; +1 reset ad hoc (#942 L2 : `rollCascadeTable` POSE le tirage sur table de l'étape courante dans `pendingCascade` — jumeau exact de `setCascadeChoice`, déjà compté) ; +1/+1 (#942 L3 : `setCascadeTableForcedRoll` POSE le dé de l'étape à table — seam UNIQUE des deux affordances du mode table, jumeau de `rollCascadeTable`) ; totalCalls RESSERRÉ 722 → 717 au passage de #942 L2 : le juge de design du lot a mesuré 5 de mou (des set() comptés à la pose de la baseline ont disparu depuis) — un cliquet qui garde du mou ne borne plus rien ; resets ad hoc RESSERRÉS à la mesure EXACTE au passage de #1135 (baseline 294 pour 293 réels = 1 de mou, plus les 4 sites `hoverDelta` documentés ci-dessus → 297)
// −1/−1 (#1143 : les DEUX purges du télégraphe d'intention — `set({ actorAim: null })` de
// `attackThenAdvance` et du `case 'cast'` de `runEnemyAI` — sont remplacées par la couture UNIQUE
// `clearActorAim` de `combatFlow.ts`. Elle est désormais ancrée au SEAM de résolution d'attaque
// (entrée d'`applyAttackResult`, où naît la ligne de journal du geste) plus quatre sorties
// d'AVORTEMENT/fin de tour ; le compte de `set()` littéraux n'en bouge pas — mesure exacte 726/296).
// +3/+3 (#1117 L4 : la FILE des Tests de seuil de Corruption — `corruptionFlow`. Le slot
// `pendingCorruption` est UNIQUE et une bande de fin de combat peut faire déborder deux héros d'un
// coup : `gainCorruption` pose le seuil OU le met en file (2 sites au lieu d'1), et
// `releaseCorruptionSlot` le rend au suivant. Ces trois `set()` sont la fenêtre RENDUE à un Test RAW
// qui, avant, se roulait en silence — pas du mou. Mesure exacte 730/299).
// +1 (#1279 Sf : `setCascadeAmount` POSE le nombre saisi de l'étape « quantité » courante — jumeau
// exact de `setCascadeChoice`, 6ᵉ interaction de la coquille. Aucun reset ad hoc de plus : ce `set()`
// réécrit `pendingCascade` sans le vider. Mesure exacte 731/297).
// resets ad hoc RESSERRÉS 299 → 297 au passage de #1279 Sf : la mesure réelle est 297 depuis le
// resserrage de #1135, que le commentaire ci-dessus annonçait déjà — le cliquet gardait 2 de mou
// qu'il condamnait lui-même. Un cliquet qui ne colle pas à sa mesure ne borne plus rien.

describe('garde-fou set() bruts des flows (agrégat)', () => {
  it("le nombre total de set() littéraux détectés dans src/state/*.ts ne dépasse pas la baseline", () => {
    const { totalCalls } = runSetScan(ROOT);
    expect(
      totalCalls,
      `Croissance des set() de src/state/*.ts (${BASELINE.totalCalls} → ${totalCalls}) — revoir le nouveau flux puis AJUSTER la baseline de ce test si légitime`,
    ).toBeLessThanOrEqual(BASELINE.totalCalls);
  });

  it("le nombre de set() qui réinitialisent un champ STATE_FIELDS hors resetFields(...) ne dépasse pas la baseline", () => {
    const { totalAdHocResets } = runSetScan(ROOT);
    expect(
      totalAdHocResets,
      `Croissance des resets ad hoc de champ pending* (${BASELINE.totalAdHocResets} → ${totalAdHocResets}) — un nouveau site direct hors resetFields(...) : envisager le helper partagé, sinon AJUSTER la baseline`,
    ).toBeLessThanOrEqual(BASELINE.totalAdHocResets);
  });
});
