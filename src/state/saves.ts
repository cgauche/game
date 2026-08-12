/**
 * Sauvegarde / chargement de partie (Jalon 5) — localStorage + export/import JSON.
 *
 * Snapshot ZÉRO-MAINTENANCE : on copie les clés de DONNÉES de `getInitialState()` depuis l'état
 * courant (toute nouvelle donnée d'état future est sauvée gratis — même principe que le reset de
 * partie, cf. game-newgame-reset-pattern) ; les actions (fonctions zustand) sont ignorées.
 * La scène vivante (mutée : fouilles consommées, entités retirées…), les flags, l'inventaire,
 * l'horloge et le groupe voyagent donc dans la save.
 *
 * Sauvegarde HORS COMBAT uniquement (battle non-null refusé par l'action store) : l'état
 * tactique suspendu (IA, modales de combat) n'est pas un point de reprise sûr.
 *
 * Les règles maison (surcharges de `policy.ts`, hors GameState) voyagent à part dans `rules` :
 * une save reste portable d'une machine à l'autre AVEC ses règles (le localStorage ne suffit pas).
 *
 * POLITIQUE DE MIGRATION (#301) — deux filets DISTINCTS et complémentaires :
 * 1. Champs manquants (donnée AJOUTÉE depuis la save) : tolérés gratuitement par le zustand `set`
 *    au chargement (`applyLoadedSave`, `store.ts`) — un champ absent du snapshot chargé garde sa
 *    valeur d'`initialFields` (`stateFields.ts`), jamais `undefined`.
 * 2. Renommage / restructuration (donnée qui a changé de FORME) : `SAVE_VERSION` + `MIGRATIONS`
 *    ci-dessous, chaînées par la primitive générique `migrateDoc` (`migrateDoc.ts` — même mécanique
 *    que `worldMap.ts` ProjectDoc/`schema` et `roster.ts` ROSTER_MIGRATIONS/`EXPORT_VERSION`, à
 *    RÉUTILISER plutôt que réinventer pour tout futur document versionné). Chaque bump de
 *    `SAVE_VERSION` DOIT ajouter l'entrée `MIGRATIONS[N]` correspondante ET une fixture golden
 *    `vN-*.json` sous `__fixtures__/saves/` — le CLIQUET de `saves-flow.test.ts` boucle `v < SAVE_VERSION`
 *    et échoue sinon pour toute version ANTÉRIEURE à la courante (la version courante n'est, elle,
 *    jamais exigée par ce cliquet).
 *    Une version FUTURE (save plus récente que l'app) ou un trou dans la chaîne sont REFUSÉS
 *    (`null`), jamais silencieusement corrompus.
 */
import type { RuleValue } from '../engine/policy';
import type { CargoLot } from '../engine/cargo';
import { findVehicleById } from '../data';
import { itemFromTrappingById } from '../engine/items';
import { add as moneyAdd, toBrass, toMoney, type Money } from '../engine/money';
import { migrateDoc, type MigrationMap } from './migrateDoc';
import { remapCharKeysDeep } from './charKeyMigration';
import { remapInstanceIdsDeep, remapNameToLabelDeep, remapGameOpNameDeep } from './instanceIdMigration';
import type { CodexFocus } from './codexFocus';
import type { PendingCascade, RevealEntry } from './pendings';
import type { BuiltCascadeStep } from './stepBrand';
import { revealToStep } from './revealStep';
import { nightBands } from './nightBands';
import { pursuitBands } from './pursuitFlow';
import { stepReady } from './cascade';
import { combatEndBands } from './combatEndBands';

export const SAVE_VERSION = 21;

export interface SaveMeta {
  version: number;
  /** ISO — horodatage réel de la sauvegarde (méta d'affichage). */
  savedAt: string;
  /** Étiquette du slot (nom de la scène courante). */
  sceneLabel: string;
  /** Horloge de jeu (minutes) au moment de la sauvegarde. */
  gameTime: number;
}

export interface SaveGame extends SaveMeta {
  /** Clés de données de GameState (deep-copiées, JSON-sûres). */
  data: Record<string, unknown>;
  /** Surcharges de règles maison (`policy.ts`) actives à la sauvegarde — optionnel : une save
   *  d'avant ce champ n'en a pas (on garde alors les règles courantes de la machine au chargement). */
  rules?: Record<string, RuleValue>;
}

export type SaveSlot = 1 | 2 | 3;
export const SAVE_SLOTS: SaveSlot[] = [1, 2, 3];
/** Emplacement AUTO (écrit par l'auto-save aux checkpoints ; chargeable, jamais écrit à la main). */
export const AUTO_SLOT = 'auto' as const;
export type AnySlot = SaveSlot | typeof AUTO_SLOT;
// #898 : la clé n'embarque plus la version (un bump de `SAVE_VERSION` rendait toute save existante
// invisible — `readSlot`/`listSaves` sondaient une clé qui n'avait jamais été écrite). La version vit
// SEULE dans le contenu (`SaveGame.version`), déjà migré par `migrateSave`/`MIGRATIONS` — même principe
// que l'export JSON, dont la migration fonctionnait déjà. `LEGACY_KEY` reste pour la migration ponctuelle
// (`migrateLegacyKey`) des clés versionnées écrites par le code D'AVANT ce commit.
const KEY = (slot: AnySlot) => `wfrp4.save.${slot}`;
const LEGACY_KEY = (version: number, slot: AnySlot) => `wfrp4.save.v${version}.${slot}`;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // accès refusé (mode privé strict, iframe sandbox…)
  }
}

/** Snapshot des clés de DONNÉES de l'état courant (les fonctions/actions sont ignorées). */
export function snapshotSave(
  state: Record<string, unknown>,
  initial: Record<string, unknown>,
  savedAt: string,
  rules: Record<string, RuleValue> = {},
): SaveGame {
  const data: Record<string, unknown> = {};
  for (const k of Object.keys(initial)) {
    // `campaignNarratif` (#767) = couche runtime posée par `loadProject`, non embarquée au snapshot :
    // sa persistance (forme + golden + bump `SAVE_VERSION`) est le périmètre de #766.
    if (k === 'campaignNarratif') continue;
    const v = state[k];
    if (typeof v === 'function') continue;
    data[k] = v === undefined ? null : v;
  }
  const scene = state.scene as { nom?: string; id?: string } | null;
  return {
    version: SAVE_VERSION,
    savedAt,
    sceneLabel: scene?.nom ?? scene?.id ?? 'Sans scène',
    gameTime: typeof state.gameTime === 'number' ? state.gameTime : 0,
    data: JSON.parse(JSON.stringify(data)) as Record<string, unknown>, // deep copy JSON-sûre
    rules: { ...rules },
  };
}

// ── Règles maison dans le snapshot COOP (parité hôte/invité) ──────────────────────────────────
// Le snapshot réseau n'a qu'un champ `data` opaque (cf. net/session) : les surcharges de `policy.ts`
// y voyagent sous une clé RÉSERVÉE. Helpers PURS (testés), réutilisés par netFlow.

/** Clé réservée du payload coop transportant les règles maison (hors GameState). */
export const HOUSE_RULES_KEY = '__houseRules';

/** Joint les règles maison au snapshot coop (sous la clé réservée). */
export function packHouseRules(data: Record<string, unknown>, rules: Record<string, RuleValue>): Record<string, unknown> {
  return { ...data, [HOUSE_RULES_KEY]: rules };
}

/** Sépare les règles maison du reste de l'état (clé réservée retirée de `game` → pas de pollution). */
export function unpackHouseRules(data: Record<string, unknown>): { game: Record<string, unknown>; rules?: Record<string, RuleValue> } {
  const { [HOUSE_RULES_KEY]: rules, ...game } = data;
  return { game, rules: rules as Record<string, RuleValue> | undefined };
}

/** Validation de forme d'une save (version + data objet). */
export function isValidSave(s: unknown): s is SaveGame {
  return !!s && typeof s === 'object'
    && (s as SaveGame).version === SAVE_VERSION
    && typeof (s as SaveGame).savedAt === 'string'
    && !!(s as SaveGame).data && typeof (s as SaveGame).data === 'object';
}

/** Migrations SÉQUENTIELLES : la clé N met à niveau une save vN → v(N+1). À CHAQUE bump de
 *  `SAVE_VERSION`, ajouter ici l'entrée correspondante — sinon les saves antérieures seront refusées
 *  (jamais corrompues en silence). Chaînée par `migrateDoc` (primitive générique, `migrateDoc.ts`). */
export const MIGRATIONS: MigrationMap = {
  // v1 → v2 : les saves d'avant la carte de campagne (#T2 / Arène 2.0) portaient une carte VIDE
  // (places: []) — la restaurer écraserait celle du projet courant et ferait DISPARAÎTRE le bouton
  // de carte (recette : « la map n'apparaît pas »). Une carte sans lieux = pas de carte : on laisse
  // la base (état initial = campagne intégrée) la fournir, en supprimant la clé de la save.
  1: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    const wm = data.worldMap as { places?: unknown[] } | null | undefined;
    if (!wm || !wm.places?.length) delete data.worldMap;
    return { ...doc, version: 2, data };
  },
  // v2 → v3 : renommage CharKey → slugs pleins (#311, `CC`/`CT`/`F`/`E`/`I`/`Ag`/`Dex`/`Int`/`FM`/`Soc`
  // → `capacite-de-combat`/… ) — remappe RÉCURSIVEMENT tout l'état (party/vessel/travelPlan/scene…).
  2: (doc) => ({ ...doc, version: 3, data: remapCharKeysDeep(doc.data) as Record<string, unknown> }),
  // v3 → v4 (#275 Ronde 2 cran 3) : voyage MARITIME basculé sur le pipeline cascade — l'ancien FSM
  // `SeaVoyageState.step` et le Test d'équipage de VOYAGE (`PendingCrewTest.voyage`/`.resolved`) MEURENT.
  // `pendingCrewTest` ne sert plus QU'AU COMBAT — or une save est HORS COMBAT (saves.ts l.10, `battle`
  // refusé non-null) : tout `pendingCrewTest` présent dans une save v3 est donc NÉCESSAIREMENT un Test de
  // VOYAGE (le seul chemin hors-combat de l'ancien mécanisme) → toujours DROPPÉ (`null`), jamais réinjecté
  // dans le combat qui n'en a plus l'usage. `travelPlan.sea` EN VOL (une journée déjà entamée, `step` ≠
  // absent) : arbitrage SIMPLE accepté (#275 Ronde 2, cran 3 — migrer le point de reprise EXACT est non
  // trivial, la primitive de reprise est désormais `pendingCascade`, pas une donnée reconstructible hors
  // contexte) — la journée EN VOL est remise à son ÉTAT DE DÉPART (milles/voiles/phare/PV du jour à zéro,
  // `step` supprimé) : rien n'est dupliqué ni corrompu, la traversée reprend proprement au prochain
  // `runSeaDay` (Test de Progression du jour, RAW ch.13/15 inchangé) — au pire une journée « recommencée ».
  3: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    if (data.pendingCrewTest != null) data.pendingCrewTest = null;
    const plan = data.travelPlan as { sea?: Record<string, unknown> } | null | undefined;
    if (plan?.sea) {
      const { step: _step, sailsDown: _sailsDown, lighthouseDR: _lighthouseDR, entries: _entries, paceToday: _paceToday, eventMMod: _eventMMod, minorDrift: _minorDrift, ...seaRest } = plan.sea;
      data.travelPlan = { ...plan, sea: { ...seaRest, milesToday: 0, sailsDown: false, lighthouseDR: 0, entries: [] } };
    }
    return { ...doc, version: 4, data };
  },
  // v4 → v5 (#327 lot C) : le convoi terrestre abstrait `caravanCargo` (cargaison de GROUPE, « information,
  // pas plafond ») est MATÉRIALISÉ sur un porteur RÉEL — `caravanCargo` disparaît. Rehéberge ses lots sur le
  // premier porteur du groupe : VÉHICULE de convoi (chargement EDOC) s'il existe, sinon BÊTE de bât
  // (encPortee), sinon la cale du navire de campagne. Aucun porteur matérialisable (groupe sans bête/
  // véhicule/navire) : le nouveau modèle n'héberge pas de vrac de groupe sans porteur → les lots sont
  // abandonnés (arbitrage : « il faut un chariot pour hâler du vrac », EDOC 7 ; cas hors des saves réelles).
  4: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    rehomeCaravan(data);
    return { ...doc, version: 5, data };
  },
  // v5 → v6 (#349) : `TravelRecapDay.lines` passe de `string[]` (chaîne plate) à `RecapLine[]`
  // (`{ text, icon?, tone?, phase? }`, `state/recapLine.ts`). Normalise les QUATRE emplacements
  // sérialisables d'un `TravelRecapDay` — `travelPlan.recap.days[]`/`travelPlan.log[]` (chronique
  // de voyage), `pendingRest.travelDay`, `pendingSeaActivities.day` — en repli neutre (`{ text }`,
  // ni icône ni ton) : patron `normalizeScene` (jamais un crash sur vieille donnée).
  5: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    normalizeTravelRecapLines(data);
    return { ...doc, version: 6, data };
  },
  // v6 → v7 (#371 lot B) : le focus Codex (`compendiumFocus`/`codexOverlay`) passe de `{category,label}`
  // à `{category,id}` — l'identité est désormais l'`id`. La résolution label→id vit dans `src/ui`
  // (`codexLookup`) et la couche `state` ne peut pas l'importer (règle 3) : un focus label-only non
  // résoluble ici est donc ramené à `null`. C'est un état sain — une save est écrite Codex clos
  // (`compendiumFocus`/`codexOverlay` nuls dans toutes les saves réelles) : `migrateCodexFocus`
  // ramène tout label-only résiduel à `null` sans jamais tenter de le résoudre.
  6: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    data.compendiumFocus = migrateCodexFocus(data.compendiumFocus);
    data.codexOverlay = migrateCodexFocus(data.codexOverlay);
    return { ...doc, version: 7, data };
  },
  // v7 → v8 (#598) : renommage `name` → `id` sur les instances keyées par id d'un `Combatant` —
  // `ConditionInstance` (`conditions[]`) et `Disease` (`diseases[]`). Les deux champs portaient déjà un
  // **id** de catalogue (slug d'`etats.json` / `maladies.json`) sous un nom de libellé, à rebours de la
  // doctrine « la logique est keyée par id, `label`/`name` = affichage ». La VALEUR est inchangée : seule
  // la clé est renommée (`remapInstanceIdsDeep`, même primitive que `remapCharKeysDeep`/#311). Sans cette
  // migration une save portant un État actif (Empêtré, Sonné…) ou une maladie se rechargerait avec
  // `id: undefined` → l'État/la maladie disparaîtrait SILENCIEUSEMENT du combattant.
  7: (doc) => ({ ...doc, version: 8, data: remapInstanceIdsDeep(doc.data) as Record<string, unknown> }),
  // v8 → v9 (#604) : renommage `name` → `label` des porteurs de LIBELLÉ sérialisés — `Combatant`
  // (nom du personnage), `ItemInstance` (nom de l'objet) et `Weapon` (nom de l'arme). Le dépôt ne
  // désigne plus un libellé que par `label` (arbitrage 2026-07-19). Sans cette migration, tout héros,
  // objet et arme d'une save v8 se rechargerait avec `label: undefined` : le nom DISPARAÎT en silence
  // de la fiche, du sac et du journal. Borné par la FORME du porteur (`remapNameToLabelDeep`) — les
  // `name` qui portent un id (GameOp authorés) ne sont jamais touchés.
  8: (doc) => ({ ...doc, version: 9, data: remapNameToLabelDeep(doc.data) as Record<string, unknown> }),
  // v9 → v10 (#608 Lot 6) : renommage `name` → `label` des porteurs de LIBELLÉ sérialisés RESTANTS —
  // `CampaignVessel` (nom d'instance), `CustomStatblock` (statbloc d'auteur en scène), `MedicNpc`
  // (infirmerie, ouvrable hors combat), `ScheduledRespawn.caster` (reconstitution différée),
  // `PendingVictory.defeated[]` (regroupement de l'écran de victoire), `PendingTest.candidates[]`
  // (choix du lanceur hors combat) et `MassBattleArmy` (Puissance de Bataille). MÊME primitive
  // `remapNameToLabelDeep`, étendue de bearers (`isVesselLike`/`isStatblockLike`/`isMedicNpcLike`/
  // `isArmyLike`/`isDefeatedLike`/`isCandidateLike` ; `ScheduledRespawn.caster` retombe sur
  // `isCombatantLike`, déjà actif). Sans cette migration, le nom du navire de campagne, d'un PNJ
  // soigneur, d'une armée de bataille de masse… disparaît en silence au rechargement d'une save v9.
  9: (doc) => ({ ...doc, version: 10, data: remapNameToLabelDeep(doc.data) as Record<string, unknown> }),
  // v10 → v11 (#608 Lot B) : renommage `name` → `label` des 2 DERNIERS porteurs de LIBELLÉ SÉRIALISÉS —
  // `SceneOp` `setVessel`/`adjustVessel` (nom d'instance de navire authoré dans un dialogue/trigger
  // ENCORE non déclenché de la scène vivante, `state.scene`) et `pendingCampaign` (campagne choisie au
  // menu, avant « Commencer »). MÊME primitive `remapNameToLabelDeep`, étendue de 2 bearers
  // (`isSceneVesselOpLike` discriminant `type` EXACT, `isPendingCampaignLike` couple `scenes`+
  // `startSceneId`). Sans cette migration, le nom d'instance d'un navire pas-encore-doté ou le libellé
  // de la campagne en cours de sélection au menu disparaît en silence au rechargement d'une save v10.
  10: (doc) => ({ ...doc, version: 11, data: remapNameToLabelDeep(doc.data) as Record<string, unknown> }),
  // v11 → v12 (#608, ref #603) : renommage du `name` d'un `GameOp` SÉRIALISÉ (`Combatant.activeEffects[].
  // opsPerRound`/`.auraMods`/`recoveryPenalty`/`critTrigger.resist.onFail`…) — `id` pour `condition`/
  // `removeCondition` (index STABLE d'État, jamais un libellé), `label` pour `grantWeapon`/
  // `grantNaturalWeapon` (nom de l'arme invoquée). `engine/ops.ts` (GameOp) ne connaît plus `name` du
  // tout : sans cette migration, un effet actif « État X à chaque Round » ou une arme invoquée encore
  // active au moment de la sauvegarde se rechargerait avec `id`/`label` undefined — l'État cesse de se
  // ré-appliquer, l'arme invoquée perd son nom, en SILENCE. Bornée par la FORME de l'op (`remapGameOpNameDeep`,
  // le SEUL cas où ce module vise un `name` d'op — `isGameOp` les protégeait jusqu'ici dans MIGRATIONS[8-10]).
  11: (doc) => ({ ...doc, version: 12, data: remapGameOpNameDeep(doc.data) as Record<string, unknown> }),
  // v12 → v13 (#531 SOCLE POSSESSIONS §8) : la Bourse de GROUPE (`money` top-level) devient une Bourse
  // PERSONNELLE par héros (`ItemInstance.money` de l'instance `bourse`, LDB 61 l.29) — `money` disparaît
  // de `GameState`. Rehéberge le montant sur la Bourse du DOYEN (1er héros du groupe) puis SUPPRIME la
  // clé — MÊME patron que `rehomeCaravan` (MIGRATIONS[4] : un champ GROUPE rehébergé sur un porteur réel).
  // Sans cette migration, la monnaie d'une save v12 DISPARAÎT en silence (plus aucun champ ne la porte).
  12: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    rehomeGroupMoney(data);
    return { ...doc, version: 13, data };
  },
  // v13→v14 : Objective.deadline (échéance absolue, compte à rebours #668) — champ ADDITIF optionnel,
  // aucun objectif existant à transformer. Bump + golden pour la discipline de compat (saves.ts en-tête).
  13: (doc) => ({ ...doc, version: 14, data: doc.data }),
  // v14→v15 (#766) : `campaignDoc` (document source du paquet, snapshotté pour la re-registration des
  // scènes + re-dérivation du narratif au chargement) — champ ADDITIF. Une save v14 legacy n'en a pas :
  // `null` reproduit le comportement pré-#766 (seule l'Arène + la scène courante connues, pas de crash).
  14: (doc) => ({ ...doc, version: 15, data: { ...(doc.data as Record<string, unknown>), campaignDoc: (doc.data as Record<string, unknown>).campaignDoc ?? null } }),
  // v15→v16 (#942 L8) : la file de révélations `pendingReveals` (`RevealEntry[]`) n'existe plus — une
  // révélation est une ÉTAPE d'affichage de cascade (`CascadeStep.reveal`). Une save v15 écrite avec des
  // révélations en attente (Coup Critique, mutation, entretien, entrée de zone) les perdrait en silence :
  // `snapshotSave` itère les clés de l'état COURANT, qui n'a plus la file. Ici, chaque entrée redevient
  // une étape (`revealToStep`, source unique de la conversion) et rejoint la séquence par la MÊME règle
  // qu'à l'émission : la séquence en vol de la save si elle en porte une (append, `purpose` conservé),
  // sinon une séquence d'affichage qui s'ouvre. La clé disparaît de la donnée.
  15: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    adoptLegacyReveals(data);
    return { ...doc, version: 16, data };
  },
  // v16→v17 (#1117 L1/L2) : la Psychologie — à la RENCONTRE comme en COMBAT — n'est plus une étape PAR
  // HÉROS mais une BANDE par entrée de règle : la déclaration (`encounterPsych`/`combatPsych`) reste sur
  // l'étape, le JET descend sur les RANGÉES (`participants`, `aggregate:'none'`). Les deux appliers
  // exigent `step.participants` et RENONCENT sans lui : une save v16 prise EN PLEINE cascade psy se
  // rechargerait avec une étape MONO dont le Test se lance et la cascade avance, sans que la Peur/le
  // Trait ciblé soit JAMAIS posé ni une ligne de journal écrite. Chaque étape psy MONO — de la cascade
  // ACTIVE (`pendingCascade`) comme de la pile SUSPENDUE (`suspendedCascades`) — devient donc une bande
  // d'UNE rangée : jet posé, Détermination et influences suivent sur la rangée.
  16: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    bandifyPsychSteps(data);
    return { ...doc, version: 17, data };
  },
  // v17→v18 (#1117 L3) : les jets de NUIT (Faim, Soif, Marche forcée, Dessoûlage, maladies, Contagion,
  // Récupération, Cauchemars, Abri, Exposition) ne sont plus des étapes MONO mais des BANDES par entrée
  // de règle et par JOUR (`state/nightBands`). Tous leurs appliers exigent désormais `participants` et
  // RENONCENT sans : une save v17 prise avec des jets de nuit EN ATTENTE se rechargerait avec des étapes
  // dont le jet se lance, la cascade avance, et dont AUCUNE conséquence ne serait appliquée. Les TROIS
  // porteurs d'étapes de la save sont parcourus : la cascade ACTIVE, la pile SUSPENDUE, et la file
  // `deferredUpkeepQueue` (Tests d'entretien mis en file pendant un combat) — que MIGRATIONS[16] avait
  // laissée de côté. Les étapes DÉJÀ VALIDÉES (avant le curseur) restent intactes : elles sont de
  // l'historique inerte, et les re-bander décalerait le curseur.
  17: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    bandifyNightSteps(data);
    return { ...doc, version: 18, data };
  },
  // v18→v19 (#1246) : une manche de POURSUITE terrestre n'est plus N étapes MONO (une par coureur) mais
  // UNE bande (`state/pursuitFlow`, LDB 15 l.92). Son applier exige `participants` et RENONCE sans :
  // une save v18 prise en pleine manche se rechargerait avec des étapes dont le jet se lance, la cascade
  // avance, et dont AUCUN DR n'entrerait dans la comparaison de clôture (LDB 15 l.93) — Distance corrompue.
  // MÊMES porteurs que MIGRATIONS[17] pour les cascades (ACTIVE + pile SUSPENDUE ; la file
  // `deferredUpkeepQueue` ne porte que des jets de nuit) et MÊME conversion par la FABRIQUE du jeu ;
  // la BORNE au curseur, elle, ne s'applique PAS ici (cf. `bandifyPursuitSteps`).
  18: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    bandifyPursuitSteps(data);
    return { ...doc, version: 19, data };
  },
  // v19→v20 (#1117 L4) : les jets de BILAN DE COMBAT (Contraction de maladie LDB 20, Exposition à la
  // Corruption LDB 19) ne sont plus des étapes MONO par personnage mais des BANDES par entrée de règle
  // (`state/combatEndBands`). Leurs deux appliers exigent désormais `participants` et RENONCENT sans :
  // une save v19 prise avec des jets de fin de combat EN ATTENTE se rechargerait avec des étapes dont le
  // jet se lance, la cascade avance, et dont AUCUNE maladie ni AUCUN Point de Corruption ne serait
  // appliqué. MÊMES porteurs que MIGRATIONS[18] (cascade ACTIVE + pile SUSPENDUE) : la file
  // `deferredUpkeepQueue` n'a qu'un producteur (`store.ts`, entretien de FRANCHISSEMENT DE JOUR) et ne
  // porte donc jamais ces `kind`. Les étapes DÉJÀ VALIDÉES (avant le curseur) restent intactes :
  // historique inerte, et les re-bander décalerait le curseur.
  19: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    bandifyCombatEndSteps(data);
    return { ...doc, version: 20, data };
  },
  // v20→v21 (#1262 V2 L4) : `interactive` n'existe plus au niveau ÉTAPE (`CascadeStepBase`) — son
  // unique lecteur (`rollFlowFactory.passive`, cinq verbes d'influence) lit désormais une définition
  // DÉRIVÉE (jet posé + porteur non surfacé), donc plus personne ne consulte le champ. Il se retire des
  // étapes persistées : une save v20 rechargée porterait un champ hors type, que le prochain snapshot
  // re-sérialiserait indéfiniment. Les RANGÉES gardent le leur. MÊMES porteurs d'étapes que
  // MIGRATIONS[17] (cascade ACTIVE + pile SUSPENDUE + file `deferredUpkeepQueue`) — toutes les étapes,
  // avant curseur comprises : le champ n'a aucune valeur historique.
  20: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    dropStepInteractive(data);
    return { ...doc, version: 21, data };
  },
};

/** MIGRATIONS[6] (#371 lot B) : normalise un focus Codex sérialisé vers la forme id-based. Un focus
 *  DÉJÀ id-based (défensif) est conservé ; un focus label-only (toute save v6, pré-lot-B) n'est pas
 *  résoluble sans `src/ui/codexLookup` (interdit à `state`, règle 3) → `null` (Codex clos, sain). */
function migrateCodexFocus(f: unknown): CodexFocus | null {
  if (!f || typeof f !== 'object') return null;
  const old = f as { category?: string; id?: string; label?: string; instance?: string };
  if (old.category && typeof old.id === 'string' && old.id) return old as CodexFocus;
  return null;
}

/** Normalise `days: TravelRecapDay[]` (`lines: string[]` v5 → `RecapLine[]` v6) — MIGRATIONS[5]. */
function normalizeTravelRecapDays(days: unknown): void {
  if (!Array.isArray(days)) return;
  for (const d of days) normalizeTravelRecapDay(d);
}

/** Normalise UN `TravelRecapDay` sérialisé — no-op si `lines` est déjà `RecapLine[]` (élément objet)
 *  ou absent (patron `normalizeScene` : tolérant, jamais de crash sur vieille/forme inattendue). */
function normalizeTravelRecapDay(day: unknown): void {
  if (!day || typeof day !== 'object') return;
  const d = day as { lines?: unknown };
  if (!Array.isArray(d.lines)) return;
  d.lines = d.lines.map((l) => (typeof l === 'string' ? { text: l } : l));
}

/** MIGRATIONS[5] (#349) : les QUATRE emplacements sérialisables d'un `TravelRecapDay` dans l'état
 *  de jeu. Mute `data`. */
function normalizeTravelRecapLines(data: Record<string, unknown>): void {
  const plan = data.travelPlan as { recap?: { days?: unknown }; log?: unknown } | null | undefined;
  if (plan?.recap?.days) normalizeTravelRecapDays(plan.recap.days);
  if (plan?.log) normalizeTravelRecapDays(plan.log);
  const rest = data.pendingRest as { travelDay?: unknown } | null | undefined;
  if (rest?.travelDay) normalizeTravelRecapDay(rest.travelDay);
  const seaActivities = data.pendingSeaActivities as { day?: unknown } | null | undefined;
  if (seaActivities?.day) normalizeTravelRecapDay(seaActivities.day);
}

/** Forme minimale d'un héros sérialisé LUE par la migration v4→v5 (porteurs = items à `trappingId`). */
interface SavedItem { trappingId?: string; label?: string; cargo?: CargoLot[] }
interface SavedHero { id?: string; items?: SavedItem[] }

/** Forme minimale d'un héros sérialisé LUE par la migration v12→v13 (Bourse = item à `trappingId==='bourse'`). */
interface SavedBourseItem { trappingId?: string; money?: Partial<Money> }
interface SavedHeroWithBourse { items?: SavedBourseItem[] }

/** Trappings bête (`animaux-et-vehicules`) de l'ÈRE PRÉ-SOCLE (MIGRATIONS[4], v4→v5) — les mules/chevaux
 *  n'étaient alors QUE des `ItemInstance` de héros, jamais des Possession (`creatures.json`/`montures.json`
 *  re-keyés par `creatureId` depuis #617/#618). Liste FIGÉE (données historiques d'une save gelée à cette
 *  version), jamais réalignée sur le catalogue courant. */
const LEGACY_V4_BEAST_TRAPPING_IDS = new Set(['chien', 'poney', 'mule', 'cheval-de-trait', 'cheval-de-selle', 'cheval-de-guerre-leger', 'destrier']);

/** Rehéberge `caravanCargo` (v4) sur un porteur réel puis SUPPRIME la clé — MIGRATIONS[4]. Mute `data`. */
function rehomeCaravan(data: Record<string, unknown>): void {
  const caravan = (data.caravanCargo as CargoLot[] | undefined) ?? [];
  delete data.caravanCargo;
  if (!caravan.length) return;
  const party = data.party as SavedHero[] | undefined;
  const isVehicle = (t: string): boolean => findVehicleById(t)?.chargement != null;
  const isBeast = (t: string): boolean => LEGACY_V4_BEAST_TRAPPING_IDS.has(t);
  const findItem = (pred: (t: string) => boolean): SavedItem | undefined => {
    for (const h of party ?? []) for (const it of h.items ?? []) if (it.trappingId && pred(it.trappingId)) return it;
    return undefined;
  };
  const target = findItem(isVehicle) ?? findItem(isBeast);
  if (target) { target.cargo = [...(target.cargo ?? []), ...caravan]; return; }
  const vessel = data.vessel as { cargo?: CargoLot[] } | null | undefined;
  if (vessel) vessel.cargo = [...(vessel.cargo ?? []), ...caravan];
}

/** Rehéberge la Bourse de GROUPE (v12) sur la Bourse du DOYEN (1er héros) puis SUPPRIME la clé —
 *  MIGRATIONS[12]. Repli groupe vide (aucun héros) : le montant est abandonné — comme `rehomeCaravan`
 *  sans porteur matérialisable, il n'existe alors aucun porteur réel où le déposer. Mute `data`. */
function rehomeGroupMoney(data: Record<string, unknown>): void {
  const groupMoney = data.money as Partial<Money> | undefined;
  delete data.money;
  const brass = groupMoney ? toBrass(toMoney(groupMoney)) : 0;
  if (brass <= 0) return;
  const party = data.party as SavedHeroWithBourse[] | undefined;
  const doyen = party?.[0];
  if (!doyen) return; // groupe vide : rien à matérialiser
  const items = doyen.items ?? [];
  let bourse = items.find((i) => i.trappingId === 'bourse');
  if (!bourse) {
    const fresh = itemFromTrappingById('bourse');
    if (!fresh) return;
    fresh.money = { gold: 0, silver: 0, brass: 0 };
    doyen.items = [...items, fresh];
    bourse = fresh;
  }
  bourse.money = moneyAdd(toMoney(bourse.money ?? {}), toMoney(groupMoney!));
}

/** Adopte les révélations de la file legacy `pendingReveals` (v15) comme ÉTAPES d'affichage de la
 *  cascade, puis SUPPRIME la clé — MIGRATIONS[15]. Même règle d'accueil qu'à l'émission (`pushReveal`) :
 *  append à la séquence portée par la save si elle en a une, sinon une séquence `'affichage'` titrée par
 *  la première étape. Une save est écrite HORS COMBAT (en-tête de ce module) : la branche `'combat'` de
 *  la règle d'accueil n'a aucun producteur ici. Entrées malformées ignorées (patron `normalizeScene` :
 *  tolérant, jamais un crash sur vieille donnée). Mute `data`. */
function adoptLegacyReveals(data: Record<string, unknown>): void {
  const legacy = data.pendingReveals;
  delete data.pendingReveals;
  if (!Array.isArray(legacy)) return;
  const entries = legacy.filter((e): e is RevealEntry => !!e && typeof e === 'object' && Array.isArray((e as RevealEntry).lines));
  if (!entries.length) return;
  const host = data.pendingCascade as PendingCascade | null | undefined;
  const steps = entries.map((e, i) => revealToStep(e, (host?.participants.length ?? 0) + i));
  data.pendingCascade = host
    ? { ...host, participants: [...host.participants, ...steps] }
    : { title: steps[0].label ?? 'Conséquences', icon: steps[0].icon ?? 'action/attack', purpose: 'affichage', cursor: 0, log: [], participants: steps };
}

/** Clés de DÉCLARATION d'une bande de Psychologie sur une étape de cascade (`CascadeStep`) — celles
 *  dont l'applier exige `participants` depuis #1117 L1/L2. MIGRATIONS[16]. */
const PSYCH_DECL_KEYS = ['encounterPsych', 'combatPsych'] as const;

/** Champs du jet MONO d'une étape psy v16 qui descendent TELS QUELS sur la rangée (influences et
 *  Détermination comprises) puis quittent l'étape — MIGRATIONS[16]. */
const PSYCH_ROW_FIELDS = ['difficulty', 'easedBy', 'mods', 'clamped', 'immune', 'rerolled', 'forced', 'fixed', 'outcome'] as const;

/** Convertit UNE étape psy MONO (v16) en BANDE d'une seule rangée — MIGRATIONS[16]. No-op sur une étape
 *  sans déclaration psy, déjà en bande (`participants`), ou sans `actorId` (rangée impossible à bâtir :
 *  patron `normalizeScene`/`adoptLegacyReveals`, tolérant plutôt qu'un crash sur vieille donnée). Mute
 *  l'étape. */
function bandifyPsychStep(step: Record<string, unknown>): void {
  const declKey = PSYCH_DECL_KEYS.find((k) => !!step[k] && typeof step[k] === 'object');
  if (!declKey || Array.isArray(step.participants) || typeof step.actorId !== 'string') return;
  const decl = { ...(step[declKey] as Record<string, unknown>) };
  const stepMeta = { ...(step.meta as Record<string, unknown> | undefined) };
  const row: Record<string, unknown> = {
    id: step.actorId, interactive: true, label: step.rollLabel,
    base: step.base ?? 0, target: step.target ?? 0, result: step.result ?? null,
  };
  for (const k of PSYCH_ROW_FIELDS) if (step[k] !== undefined) { row[k] = step[k]; delete step[k]; }
  // FORME CIBLE : ce qui DIVERGE d'un héros à l'autre vit PAR RANGÉE — le DR cumulé du Test étendu et
  // l'allègement « Sans Peur » dans `BatchParticipant.meta`, la barre de DR (`extendedDr*`) sur la
  // rangée elle-même. L'entrée de règle mise en jeu — type/source/cible/Indice — est la DÉCLARATION de
  // l'étape. FORME SOURCE (v16) : les deux vivaient sur l'étape (déclaration et `meta` d'étape).
  const rowMeta: Record<string, unknown> = {};
  for (const k of ['prevDR', 'sansPeur'] as const) if (decl[k] !== undefined) { rowMeta[k] = decl[k]; delete decl[k]; }
  if (Object.keys(rowMeta).length) row.meta = rowMeta;
  for (const k of ['extendedDrTarget', 'extendedDrDone'] as const) if (stepMeta[k] !== undefined) { row[k] = stepMeta[k]; delete stepMeta[k]; }
  // Le JET quitte l'étape pour la rangée ; la POSSESSION reste : une bande d'UN porteur EST son porteur
  // (`rollSeam.bandStep`) — sans `actorId`, l'arbitre rendrait la fenêtre à l'hôte seul et le siège du
  // héros ne verrait jamais sa rangée (invariant fermé par `cascade.assertBandeDeclarePossession`).
  for (const k of ['rollLabel', 'base', 'target', 'result'] as const) delete step[k];
  if (Object.keys(stepMeta).length) step.meta = stepMeta; else delete step.meta;
  step[declKey] = decl;
  step.aggregate = 'none';
  step.participants = [row];
}

/** Bandifie les étapes psy MONO des cascades SÉRIALISÉES — la cascade ACTIVE (`pendingCascade`) et la
 *  pile des cascades SUSPENDUES (`suspendedCascades`, `cascade.ts`), toutes deux embarquées par
 *  `snapshotSave`. MIGRATIONS[16]. Mute `data`. */
function bandifyPsychSteps(data: Record<string, unknown>): void {
  const stack = Array.isArray(data.suspendedCascades) ? data.suspendedCascades : [];
  for (const cascade of [data.pendingCascade, ...stack]) {
    const steps = (cascade as { participants?: unknown } | null | undefined)?.participants;
    if (!Array.isArray(steps)) continue;
    for (const step of steps) if (step && typeof step === 'object') bandifyPsychStep(step as Record<string, unknown>);
  }
}

/** Bandifie les jets de NUIT encore À JOUER des TROIS porteurs d'étapes d'une save (cascade ACTIVE,
 *  pile SUSPENDUE, file `deferredUpkeepQueue`) — MIGRATIONS[17]. La conversion passe par la FABRIQUE
 *  du jeu (`nightBands`), source unique de la forme d'une bande : la migration ne redécrit pas une
 *  forme cible qui dériverait ensuite du code vivant. Seules les étapes AU CURSEUR ET APRÈS sont
 *  regroupées (celles d'avant sont validées : historique inerte, et le curseur ne bouge pas). Mute
 *  `data` ; formes inattendues laissées telles quelles (patron `normalizeScene`). */
function bandifyNightSteps(data: Record<string, unknown>): void {
  const stack = Array.isArray(data.suspendedCascades) ? data.suspendedCascades : [];
  for (const cascade of [data.pendingCascade, ...stack]) {
    const c = cascade as { participants?: unknown; cursor?: unknown } | null | undefined;
    if (!c || !Array.isArray(c.participants)) continue;
    const cursor = typeof c.cursor === 'number' ? c.cursor : 0;
    // RÉHYDRATATION : une étape venue du JSON n'a plus la marque de son mint (le brand est un symbole,
    // effacé à la sérialisation). La migration la rend à la fabrique, qui la re-minte ou la laisse
    // passer telle quelle — c'est le rôle de frontière de ce fichier (`eslint.config.js`, #1262 V4).
    // eslint-disable-next-line no-restricted-syntax -- réhydratation : la marque est POSTULÉE sur une étape venue du JSON (seul site licite, cf. `eslint.config.js`)
    const steps = c.participants as BuiltCascadeStep[];
    c.participants = [...steps.slice(0, cursor), ...nightBands(steps.slice(cursor))];
  }
  // eslint-disable-next-line no-restricted-syntax -- réhydratation : cf. ci-dessus (file `deferredUpkeepQueue`)
  if (Array.isArray(data.deferredUpkeepQueue)) data.deferredUpkeepQueue = nightBands(data.deferredUpkeepQueue as BuiltCascadeStep[]);
}

/**
 * Bandifie les étapes MONO de manche de POURSUITE des cascades sérialisées (ACTIVE + pile SUSPENDUE)
 * — MIGRATIONS[18]. Conversion par la FABRIQUE du jeu (`pursuitBands`).
 *
 * DIFFÉRENCE avec `bandifyNightSteps`, qui laisse l'AVANT-CURSEUR intact : la conséquence d'une manche
 * n'est PAS jouée étape par étape mais à la CLÔTURE (elle compare TOUS les DR, LDB 15 l.93). Une étape
 * déjà validée n'est donc pas de l'historique inerte — son DR est encore DÛ à la comparaison ; l'écarter
 * de la bande le perdrait. Toute la manche est bandifiée, résultats déjà posés compris, et le curseur se
 * REPOSE sur la première étape non prête (une cascade 'pursuite' ne porte que des étapes de sa manche).
 * Mute `data` ; formes inattendues laissées telles quelles (patron `normalizeScene`).
 */
function bandifyPursuitSteps(data: Record<string, unknown>): void {
  const stack = Array.isArray(data.suspendedCascades) ? data.suspendedCascades : [];
  for (const cascade of [data.pendingCascade, ...stack]) {
    const c = cascade as { participants?: unknown; cursor?: unknown } | null | undefined;
    if (!c || !Array.isArray(c.participants)) continue;
    // eslint-disable-next-line no-restricted-syntax -- réhydratation : cf. `bandifyNightSteps` (seul site licite, cf. `eslint.config.js`)
    const steps = c.participants as BuiltCascadeStep[];
    const bands = pursuitBands(steps);
    // Rien de bandé ici : la fabrique REND les étapes hors périmètre TELLES QUELLES (même référence) —
    // une manche à un seul coureur donnerait autrement la même LONGUEUR et passerait pour inchangée.
    if (bands.every((s, i) => s === steps[i])) continue;
    const attente = bands.findIndex((s) => !stepReady(s));
    c.participants = bands;
    c.cursor = attente < 0 ? bands.length : attente;
  }
}

/**
 * Bandifie les jets de BILAN DE COMBAT encore À JOUER des cascades sérialisées (ACTIVE + pile
 * SUSPENDUE) — MIGRATIONS[19]. Conversion par la FABRIQUE du jeu (`combatEndBands`), source unique de
 * la forme d'une bande : la migration ne redécrit pas une forme cible qui dériverait ensuite.
 *
 * MÊME borne au curseur que `bandifyNightSteps` (les étapes d'avant sont validées : historique inerte,
 * et le curseur ne bouge pas). Le cas LEGACY qui exige cette fabrique-ci et pas un regroupement naïf :
 * une save v19 peut porter DEUX étapes de MÊME id pour un même personnage (l'Infection post-critique,
 * `LDB 20 l.90`, et la Contagion, `LDB 20 l.25`/`l.51`, visant la même maladie —
 * `combatEndDisease-<héros>-<maladie>` des deux côtés) — les
 * fondre en une bande donnerait deux rangées de même id, injoignables. Le filet d'id de la fabrique
 * (`bandStepId`) les sépare en deux bandes. Mute `data` ; formes inattendues laissées telles quelles.
 */
function bandifyCombatEndSteps(data: Record<string, unknown>): void {
  const stack = Array.isArray(data.suspendedCascades) ? data.suspendedCascades : [];
  for (const cascade of [data.pendingCascade, ...stack]) {
    const c = cascade as { participants?: unknown; cursor?: unknown } | null | undefined;
    if (!c || !Array.isArray(c.participants)) continue;
    const cursor = typeof c.cursor === 'number' ? c.cursor : 0;
    // eslint-disable-next-line no-restricted-syntax -- réhydratation : cf. `bandifyNightSteps` (seul site licite, cf. `eslint.config.js`)
    const steps = c.participants as BuiltCascadeStep[];
    c.participants = [...steps.slice(0, cursor), ...combatEndBands(steps.slice(cursor))];
  }
}

/**
 * RETIRE `interactive` des ÉTAPES des TROIS porteurs d'une save (cascade ACTIVE, pile SUSPENDUE, file
 * `deferredUpkeepQueue`) — MIGRATIONS[20]. Les RANGÉES (`participants[]`) gardent le leur : c'est un
 * AUTRE champ (il dit si le porteur joue son jet ou le reçoit tout roulé). Mute `data` ; formes
 * inattendues laissées telles quelles (patron `normalizeScene`).
 */
function dropStepInteractive(data: Record<string, unknown>): void {
  const strip = (steps: unknown): void => {
    if (!Array.isArray(steps)) return;
    for (const st of steps) if (st && typeof st === 'object') delete (st as Record<string, unknown>).interactive;
  };
  const stack = Array.isArray(data.suspendedCascades) ? data.suspendedCascades : [];
  for (const cascade of [data.pendingCascade, ...stack]) {
    strip((cascade as { participants?: unknown } | null | undefined)?.participants);
  }
  strip(data.deferredUpkeepQueue);
}

/** Met une save parsée au niveau `SAVE_VERSION` AVANT validation (point d'upgrade UNIQUE, via la
 *  primitive générique `migrateDoc`). Un bump de version ne jette donc plus les anciennes saves en
 *  silence : elles passent par la chaîne `MIGRATIONS`. Renvoie null si : pas un objet, version
 *  absente/non numérique, version FUTURE (on ne devine pas une structure plus récente), trou dans la
 *  chaîne, ou forme finale invalide. */
export function migrateSave(parsed: unknown): SaveGame | null {
  const save = migrateDoc(parsed, SAVE_VERSION, MIGRATIONS);
  return save && isValidSave(save) ? (save as unknown as SaveGame) : null;
}

/** Clé de mise à l'écart d'une save FUTURE (version > `SAVE_VERSION`) écrasée par `saveToSlot` — un
 *  emplacement ne garde qu'UN backup (la plus récente écrasée, cas réel : retour à un build antérieur
 *  après un déploiement en avance sur le localStorage du joueur). */
const FUTURE_KEY = (slot: AnySlot) => `wfrp4.save.future.${slot}`;

/** Avant d'écraser un emplacement, met de côté une save PLUS RÉCENTE que `SAVE_VERSION` (retour à un
 *  build antérieur) sous `FUTURE_KEY` — `readSlot` la refuse déjà correctement (`migrateDoc` ne devine
 *  pas une forme future), mais sans cette garde `saveToSlot` l'écraserait ensuite DÉFINITIVEMENT. */
function quarantineFutureSave(s: Storage, slot: AnySlot): void {
  const raw = s.getItem(KEY(slot));
  if (!raw) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  const version = (parsed as { version?: unknown } | null)?.version;
  if (typeof version !== 'number' || version <= SAVE_VERSION) return;
  s.setItem(FUTURE_KEY(slot), raw);
}

/** Lit la save FUTURE mise de côté par `quarantineFutureSave` pour un emplacement — `null` si aucune.
 *  Jamais migrée/validée (version > `SAVE_VERSION`, hors de la portée de `migrateDoc`) : seule sa méta
 *  est exposée, pour signaler sa présence (compendium/écran de chargement) sans prétendre la charger. */
export function readFutureBackup(slot: AnySlot): { version: number; savedAt: string } | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(FUTURE_KEY(slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; savedAt?: unknown };
    if (typeof parsed.version !== 'number' || typeof parsed.savedAt !== 'string') return null;
    return { version: parsed.version, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function saveToSlot(slot: AnySlot, save: SaveGame): boolean {
  const s = storage();
  if (!s) return false;
  try {
    quarantineFutureSave(s, slot);
    s.setItem(KEY(slot), JSON.stringify(save));
    return s.getItem(KEY(slot)) != null; // confirme l'écriture (quota plein → null), jamais readSlot (récursion migrateLegacyKey)
  } catch {
    return false;
  }
}

/** Borne du balayage des clés versionnées historiques (`wfrp4.save.vN.slot`, #898) : `[1, SAVE_VERSION]`.
 *  Aucune version < 1 n'a jamais été écrite (`MIGRATIONS` commence à 1) ; aucune version > SAVE_VERSION
 *  n'est lisible par CE code (refusée par `migrateDoc` — même verdict qu'une clé stable trop récente,
 *  `migrateSave`) : balayer au-delà n'offrirait aucun candidat migrable. */
const LEGACY_SCAN_MAX = SAVE_VERSION;

/** Migration ponctuelle d'une clé versionnée historique (#898) vers la clé stable, pour UN emplacement.
 *  No-op si la clé stable existe déjà (un balayage ne doit jamais écraser une save déjà migrée).
 *  Balaie `LEGACY_SCAN_MAX..1` (la plus RÉCENTE version présente d'abord) ; une clé illisible/corrompue
 *  à une version donnée n'interrompt pas le balayage — la version antérieure suivante reste un candidat.
 *  Ordre STRICT lire → migrer → ÉCRIRE (clé stable, confirmée) → SUPPRIMER (clé legacy) : une écriture
 *  échouée (quota plein, storage refusé) laisse la clé legacy seule source de vérité, jamais supprimée. */
function migrateLegacyKey(s: Storage, slot: AnySlot): void {
  if (s.getItem(KEY(slot)) != null) return;
  for (let v = LEGACY_SCAN_MAX; v >= 1; v--) {
    const legacyKey = LEGACY_KEY(v, slot);
    const raw = s.getItem(legacyKey);
    if (raw == null) continue;
    let migrated: SaveGame | null;
    try {
      migrated = migrateSave(JSON.parse(raw));
    } catch {
      migrated = null;
    }
    if (!migrated) continue; // illisible/corrompue à cette version : la version antérieure reste candidate
    if (!saveToSlot(slot, migrated)) return; // écriture échouée : la clé legacy reste seule source
    s.removeItem(legacyKey); // supprimée SEULEMENT après confirmation de l'écriture
    return;
  }
}

export function readSlot(slot: AnySlot): SaveGame | null {
  const s = storage();
  if (!s) return null;
  try {
    migrateLegacyKey(s, slot);
    const raw = s.getItem(KEY(slot));
    if (!raw) return null;
    return migrateSave(JSON.parse(raw)); // upgrade éventuel puis validation
  } catch {
    return null;
  }
}

export function deleteSlot(slot: AnySlot): void {
  try {
    const s = storage();
    if (!s) return;
    s.removeItem(KEY(slot));
    for (let v = 1; v <= LEGACY_SCAN_MAX; v++) s.removeItem(LEGACY_KEY(v, slot));
  } catch {
    // stockage indisponible : rien à supprimer
  }
}

/** Métadonnées des 3 slots (null = vide) — pour l'UI de la modale Sauvegarde/Chargement. */
export function listSaves(): ({ slot: SaveSlot } & SaveMeta | null)[] {
  return SAVE_SLOTS.map((slot) => {
    const s = readSlot(slot);
    return s ? { slot, version: s.version, savedAt: s.savedAt, sceneLabel: s.sceneLabel, gameTime: s.gameTime } : null;
  });
}

/** Export : JSON lisible (téléchargement / presse-papier). */
export function exportSave(save: SaveGame): string {
  return JSON.stringify(save, null, 2);
}

/** Import : parse + migration éventuelle + validation (null si invalide ou version inconnue/future). */
export function importSave(json: string): SaveGame | null {
  try {
    return migrateSave(JSON.parse(json));
  } catch {
    return null;
  }
}
