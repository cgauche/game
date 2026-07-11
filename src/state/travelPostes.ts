/**
 * POSTES d'Activité d'une Étape de voyage (EDOC ch.5) — module FEUILLE (convention « baril ») :
 * n'importe RIEN de `travelFlow` (ré-exporté par lui). Chaque héros tient ≤1 Activité ; depuis la
 * Phase B (voyage terrestre), TOUS les jets de l'Étape (Activités + Exposition de fin d'Étape) passent
 * par la CASCADE influençable du JOUR (`purpose:'travelDay'`) au lieu d'être auto-résolus inline —
 * Chance/Pacte/Résilience s'appliquent, exactement comme la nuit et le voyage fluvial.
 *
 * Deux temps, zéro duplication de formule (moteur PUR `engine/activities` + `engine/exposure`) :
 *  - `buildStageSteps` construit les ÉTAPES influençables (1 jet par poste testé + 1 pas d'agrégation)
 *    et pose le contexte transitoire de l'Étape sur le plan (`travelPlan.stage`) ;
 *  - les APPLIERS (`stagePoste`, `stageAggregate`, `stageExposure`) appliquent la conséquence RAW à la
 *    VALIDATION de chaque étape — un poste réussi/raté (ops/Exténué/issue de portée Étape), puis
 *    l'agrégation (fourrage cumulé, camp, cartes, Rencontre) qui INSÈRE les jets d'Exposition (comme
 *    la nuit : l'abri insère les jets d'Exposition). RAW : « chaque Personnage bénéficie d'une Activité
 *    par Étape » (l.131) ; un échec octroie un Exténué (l.133).
 */
import { battleRng } from './battleRng';
import { d100 } from '../engine/dice';
import {
  travelActivitySpec, applyTravelActivityResult, aggregateActivityOutcomes, activityById,
  type ActivityDef, type TravelActivityResult,
} from '../engine/activities';
import type { SkillRef } from '../engine/skills';
import { refLabel } from '../data';
import { stageEncounterCategory } from '../engine/travelEncounter';
import { rollEncounter, type EncounterCategory } from '../engine/travelTables';
import { applyOps, type GameOp } from '../engine/ops';
import { removeCondition, stacks } from '../engine/conditions';
import { extendedTestStep } from '../engine/tests';
import { registerCascadeApplier } from './cascade';
import { freeCons, resultLine, type Consequence } from './rollSeam';
import { t } from '../i18n';
import { rule } from '../engine/policy';
import {
  stageCount, forageYield, stageExposureDifficulty,
  isColdSeason, WEATHER_LABEL, type Weather, type Season,
} from '../engine/travelStages';
import { hasCoat, partyHasTent, applyExposureFailure, isWeatherWarded } from '../engine/exposure';
import { rationCount } from '../engine/provisions';
import { itemFromGive, autoStowNewItem } from '../engine/items';
import { testValue } from '../engine/skills';
import { DIFFICULTY_MODIFIERS, type Difficulty, type Combatant } from '../engine/types';
import { partyWalkSpeed, vehicleTravel, type TravelMode } from '../engine/travel';
import { partyMounts } from '../engine/mountTravel';
import type { CascadeStep, CascadeStepMeta, BatchParticipant } from './pendings';
import type { Get, Set } from './flowTypes';

const POSTE_ICON: Record<string, string> = {
  'plein-air': 'expedition/outdoors', approvisionnement: 'item/consumable', 'recueillir-informations': 'expedition/rumor', 'rester-aux-aguets': 'ui/eye',
  'etablir-cartes': 'expedition/cartography', 'pratiquer-competence': 'expedition/practice', recuperer: 'rest/bed', 'monter-camp': 'rest/camp',
};

/** Libellé d'une catégorie de Rencontre (EDOC ch.5). */
const ENCOUNTER_LABEL: Record<EncounterCategory, string> = {
  positives: 'Rencontre positive',
  fortuites: 'Rencontre fortuite',
  dangereuses: 'Rencontre dangereuse',
};

/** CONTEXTE TRANSITOIRE de l'Étape en cours (posé par `buildStageSteps`, lu par les appliers, effacé à
 *  la clôture du jour). Résultats de poste ACCUMULÉS (agrégés par le pas `stageAggregate`) + drapeaux. */
export interface StageContext {
  weather: Weather;
  season: Season;
  /** Ids des héros vivants (cibles potentielles de l'Exposition). */
  livingIds: string[];
  /** Résultats des postes déjà validés cette Étape — l'agrégation les relit (fourrage/camp/carte/Rencontre). */
  results: TravelActivityResult[];
}

/** Reconstruit une réf de compétence libre depuis le meta sérialisé d'une étape. */
function freeSkillFromMeta(meta?: CascadeStepMeta): SkillRef | undefined {
  const id = meta?.freeSkillId;
  return typeof id === 'string' ? { skillId: id, spec: typeof meta?.freeSkillSpec === 'string' ? meta.freeSkillSpec : undefined } : undefined;
}

/** Modificateur météo au Test d'une Activité — DONNÉE (`ActivityDef.weatherMod`, plus d'`id` en dur) :
 *  Plein air (l.106) / Approvisionnement (l.56) portent leur table météo ; les autres n'en ont pas. */
function weatherModOf(def: ActivityDef, weather: Weather): number {
  return def.weatherMod?.[weather] ?? 0;
}

/**
 * Construit les ÉTAPES influençables de l'Étape (EDOC ch.5) : un jet par poste TESTÉ (Activité à
 * compétence), un pas d'AFFICHAGE par poste sans Test (Récupérer), puis UN pas d'agrégation
 * `stageAggregate` (fourrage cumulé, camp, cartes, Rencontre → INSÈRE les jets d'Exposition). Pose le
 * contexte transitoire (`travelPlan.stage`). Ne consomme AUCUN RNG (les jets vivent dans les étapes /
 * l'agrégation). RENVOIE `[]` s'il n'y a aucun poste (l'appelant finalise directement).
 */
/** Mouvement le plus faible du groupe pour le mode de voyage courant (EDOC ch.5 l.25, modificateur du
 *  nombre d'Étapes) : à pied = Mouvement effectif le plus lent (`partyWalkSpeed`) ; en selle = M le
 *  plus faible des montures possédées ; en véhicule = Déplacement du véhicule. `undefined` si non
 *  déterminable (ex. mode `monture` sans aucune bête) — `stageCount` n'applique alors aucun modificateur. */
function groupMinMovement(party: Combatant[], mode: TravelMode): number | undefined {
  if (mode === 'monture') {
    const mounts = partyMounts(party);
    return mounts.length ? Math.min(...mounts.map((m) => m.profile.m)) : undefined;
  }
  if (mode !== 'pied') return vehicleTravel(mode)?.movement;
  const speed = partyWalkSpeed(party);
  return speed > 0 ? speed : undefined;
}

export function buildStageSteps(get: Get, set: Set, weather: Weather, season: Season): CascadeStep[] {
  const plan = get().travelPlan;
  const party = get().party;
  if (!plan?.postes || Object.keys(plan.postes).length === 0) return [];

  const stages = stageCount(plan.km, undefined, groupMinMovement(party, plan.mode));
  const livingIds = party.filter((h) => !h.dead && !h.outOfRencontre).map((h) => h.id);
  const stage: StageContext = { weather, season, livingIds, results: [] };
  set({ travelPlan: { ...plan, stage } });

  const steps: CascadeStep[] = [];
  // Postes AVEC Test → UN SEUL pas BATCH (une rangée par héros, jets INDÉPENDANTS — arbitrage user
  // 2026-07-11 : « chacun a son propre jet », pas de séquence « jet 1/5 »). Primitive #328 (`BatchParticipant`,
  // flux `cascadeBatch`). Postes SANS Test → pas d'affichage à conséquence immédiate.
  const batchParts: BatchParticipant[] = [];
  for (const hero of party) {
    const posting = plan.postes[hero.id];
    if (!posting) continue;
    const def = activityById(posting.activityId);
    if (!def) continue;
    const spec = travelActivitySpec(hero, def, { skillMod: weatherModOf(def, weather), stages, freeSkill: posting.freeSkill });
    if (spec.target == null) {
      // Activité SANS Test (Récupérer) : pas de rangée de jet — un pas d'affichage dont l'applier applique l'issue.
      const meta: CascadeStepMeta = { activityId: def.id };
      if (posting.freeSkill?.skillId) { meta.freeSkillId = posting.freeSkill.skillId; if (posting.freeSkill.spec) meta.freeSkillSpec = posting.freeSkill.spec; }
      steps.push({ id: `poste-${hero.id}`, kind: 'stagePoste', actorId: hero.id, icon: POSTE_ICON[def.id] ?? 'travel/compass', label: def.label, interactive: true, meta });
    } else {
      // label = Compétence RÉELLEMENT utilisée, résolue AVEC sa spec (« Métier (Cartographe) ») via
      // `refLabel` ; base/cible déjà influençables. Test ÉTENDU (Établir des cartes, EDOC l.161) : la
      // rangée porte sa progression cumulée (drDone AVANT ce jet, drTarget = 2 × Étapes) → barre de DR
      // sur SA rangée, persistante (arbitrage user). L'accumulation réelle vit dans `stageAggregate`.
      batchParts.push({
        id: hero.id,
        label: spec.used ? refLabel('skills', { id: spec.used.skillId, spec: spec.used.spec }) : def.label,
        interactive: true,
        base: spec.value,
        target: spec.target,
        result: null,
        ...(spec.drTarget != null ? { extendedDrDone: plan.extendedProgress ?? 0, extendedDrTarget: spec.drTarget } : {}),
      });
    }
  }
  if (batchParts.length) {
    steps.push({ id: 'stage-postes', kind: 'stagePosteBatch', icon: 'travel/compass', label: 'Postes de l’Étape',
      participants: batchParts, aggregate: 'summed-dr', interactive: true });
  }
  // Pas d'agrégation de fin d'Étape (fourrage cumulé, camp, cartes, Rencontre) + insertion des Expositions.
  steps.push({ id: 'stage-agg', kind: 'stageAggregate', icon: 'ui/tally', label: 'Bilan de l’Étape', interactive: true,
    meta: { weatherLabel: WEATHER_LABEL[weather], stages } });
  return steps;
}

// ── APPLIERS des étapes de l'Étape (purpose `travelDay`) : conséquence RAW par `kind`, moteur PUR ──

/** UN poste RÉSOLU : issue du jet (ops/Exténué/portée Étape) via le jumeau PUR `applyTravelActivityResult`,
 *  enregistrée dans le contexte d'Étape (l'agrégation `stageAggregate` la relira), et RENDUE en
 *  `Consequence[]` STRUCTURÉES (#295) — jamais une chaîne composée à la main :
 *   - Activité SANS Test → `out.activityDone` (nom en var : la rangée batch peut n'avoir pas d'actorId) ;
 *   - Exténué (EDOC l.133) → op `condition` APPLIQUÉ par `applyOps`, ligne DÉRIVÉE via `opConsequenceLine` ;
 *   - issues individuelles (Récupérer/Pratiquer/Recueillir infos) → notes narratives.
 *  Partagé par le pas d'affichage (`stagePoste`, sans Test) et le pas BATCH (`stagePosteBatch`, avec Test). */
function applyPoste(get: Get, set: Set, hero: Combatant, def: ActivityDef, freeSkill: SkillRef | undefined, roll: { roll: number; target: number; sl: number; success: boolean } | null): Consequence[] {
  const spec = travelActivitySpec(hero, def, { freeSkill });
  const r = applyTravelActivityResult({ ...spec, actorId: hero.id }, def, roll);
  const plan = get().travelPlan;
  if (plan?.stage) set({ travelPlan: { ...plan, stage: { ...plan.stage, results: [...plan.stage.results, r] } } });
  const cons: Consequence[] = [];
  if (r.roll == null) cons.push({ say: 'out.activityDone', vars: { name: hero.name, activity: def.label } });
  if (r.ops.length) cons.push(...freeCons(applyOps(hero, r.ops)));
  if (r.extenue) {
    const op: GameOp = { op: 'condition', name: 'extenue', value: 1 }; // EDOC l.133
    applyOps(hero, [op]);
    cons.push({ ops: [op] });
  }
  // Issues INDIVIDUELLES (Récupérer / Pratiquer / Recueillir infos) : récit (systèmes dédiés câblés ailleurs).
  if (r.success && r.stageOutcome === 'countsAsRest') cons.push(...freeCons([`${hero.name} prend soin de ne pas se surmener — cette Étape compte comme un repos.`]));
  else if (r.success && r.stageOutcome === 'rerollToken') cons.push(...freeCons([`${hero.name} s'exerce en chemin — il pourra inverser un futur Test de cette Compétence.`]));
  else if (r.success && r.stageOutcome === 'gatherInfo') cons.push(...freeCons([`${hero.name} glane des informations en route.`]));
  return cons;
}

/** Poste SANS Test (Récupérer) : pas d'affichage — l'issue s'applique d'office (le journal annonce
 *  seule l'exécution ; aucune rangée de jet). */
registerCascadeApplier('stagePoste', (get, set, step, hero) => {
  const def = activityById(String(step.meta?.activityId ?? ''));
  if (!def || !hero) return;
  const cons = applyPoste(get, set, hero, def, freeSkillFromMeta(step.meta), step.result ?? null);
  set({ party: [...get().party] });
  return { consequences: cons };
});

/** Postes AVEC Test = UN pas BATCH (arbitrage user 2026-07-11 : jets INDÉPENDANTS, un par héros posté).
 *  Chaque rangée porte son propre jet influençable (déjà résolu ici) ; sa CONSÉQUENCE est rendue SUR SA
 *  rangée (`part.outcome`, le portrait porte l'attribution — pas de note agrégée à l'étape). L'agrégat
 *  `summed-dr` de la primitive est IGNORÉ (ces Tests ne sont pas reliés). */
registerCascadeApplier('stagePosteBatch', (get, set, step) => {
  const plan = get().travelPlan;
  if (!step.participants || !plan?.postes) return;
  for (const part of step.participants) {
    const posting = plan.postes[part.id];
    const hero = get().party.find((h) => h.id === part.id);
    const def = posting ? activityById(posting.activityId) : undefined;
    if (!hero || !def || !posting) { part.outcome = []; continue; }
    const cons = applyPoste(get, set, hero, def, posting.freeSkill, part.result ?? null);
    const lines = cons.map((c) => resultLine([c])).filter((s) => s.length > 0);
    part.outcome = lines; // conséquence SUR SA rangée (le portrait attribue)
    for (const l of lines) get().log(l); // + journal/recap (une ligne par héros, pas d'agrégat)
  }
  set({ party: [...get().party] });
  return { consequences: [] };
});

/** AGRÉGATION de fin d'Étape (fourrage cumulé, camp, cartes, Rencontre) + INSERTION des jets d'Exposition
 *  (option « Attraper froid », l.73), sautés si un « Plein air » a réussi (`suppressExposure`, l.141). */
registerCascadeApplier('stageAggregate', (get, set, step) => {
  const plan = get().travelPlan;
  const stage = plan?.stage;
  if (!plan || !stage) return;
  const party = get().party;
  const results = stage.results;
  const j: string[] = [];

  // Approvisionnement (résolveur « forage », CUMUL des fourrageurs) — mêmes rendements qu'inline.
  const foraged = results.filter((r) => r.resolver === 'forage' && r.success).reduce((n, r) => n + forageYield(r.sl, 'recherche'), 0);
  if (foraged > 0) {
    let remaining = foraged;
    for (const h of party.filter((x) => !x.dead && !x.outOfRencontre)) {
      if (remaining <= 0) break;
      if (rationCount(h) >= 1) continue;
      const ration = itemFromGive({ trappingId: 'ration' });
      h.items = [...(h.items ?? []), ration];
      autoStowNewItem(h, ration); // #204 : rangement par défaut
      remaining -= 1;
      j.push(`${h.name} reçoit une ration trouvée en chemin.`);
    }
  }

  const agg = aggregateActivityOutcomes(results);

  // Monter le camp (CUMUL) : chaque DR retire un Exténué d'un Personnage (l.180).
  let campDR = agg.stacks.campCare ?? 0;
  for (const h of party) {
    if (campDR <= 0) break;
    const n = stacks(h, 'extenue');
    if (n <= 0) continue;
    const take = Math.min(campDR, n);
    removeCondition(h, 'extenue', take);
    campDR -= take;
    j.push(`Camp bien monté : ${h.name} récupère (−${take} Exténué).`);
  }

  // Établir des cartes (Test ÉTENDU inter-Étapes) : cumul via le helper UNIQUE + persistance sur le plan.
  const mapDR = agg.stacks.mapMade ?? 0;
  if (mapDR > 0) {
    const drTarget = results.find((r) => r.activityId === 'etablir-cartes')?.drTarget ?? 2 * Number(step.meta?.stages ?? 1);
    const { total, done } = extendedTestStep(plan.extendedProgress ?? 0, { success: true, sl: mapDR }, drTarget, !!rule('test-extended-min-sl'));
    set({ travelPlan: { ...get().travelPlan!, extendedProgress: done ? undefined : total } });
    j.push(done ? `La carte de l'itinéraire est ACHEVÉE (${drTarget}/${drTarget} DR).` : `Cartographie : ${total}/${drTarget} DR.`);
  }

  // Individuel (Récupérer / Pratiquer / Recueillir infos) : le récit a déjà été poussé PAR POSTE (stagePoste).

  // RENCONTRE de l'Étape (l.182-233) : catégorie issue de la qualité des Tests, tirage d100, texte verbatim.
  const category = stageEncounterCategory(results);
  if (category) {
    const enc = rollEncounter(category, d100(battleRng()));
    j.push(t('out.travelEncounter', { category: ENCOUNTER_LABEL[category], label: enc.label, text: enc.text }));
    if (enc.stageOutcome === 'fullRecovery') {
      for (const h of party.filter((x) => !x.dead)) {
        h.wounds.current = h.wounds.max;
        const ex = stacks(h, 'extenue');
        if (ex > 0) removeCondition(h, 'extenue', ex);
      }
      j.push('Voyage tranquille : le groupe récupère toutes ses Blessures et tous ses États Exténué.');
    }
  }
  set({ party: [...get().party] });

  // EXPOSITION de fin d'Étape (l.73) : INSÈRE un jet influençable par héros exposé (sauf « Plein air » l.141).
  const suppress = agg.gates.includes('suppressExposure');
  const insert = suppress ? [] : buildExposureSteps(get(), stage);
  return { consequences: freeCons(j), insert };
});

/** Jets d'EXPOSITION de fin d'Étape (l.73) à insérer : un par héros vivant devant un Test de Résistance
 *  (météo × équipement via `stageExposureDifficulty`). Protection magique = pas de jet (issue directe). */
function buildExposureSteps(state: { party: Combatant[] }, stage: StageContext): CascadeStep[] {
  if (!rule('travel-attraper-froid')) return [];
  const party = state.party;
  const tent = partyHasTent(party);
  const out: CascadeStep[] = [];
  for (const id of stage.livingIds) {
    const h = party.find((x) => x.id === id);
    if (!h || h.dead) continue;
    const diff = stageExposureDifficulty(stage.weather, hasCoat(h), tent);
    if (!diff) continue; // bien équipé sous pluie/neige normale, ou beau temps → aucun Test
    const resVal = testValue(h, 'resistance', 'endurance');
    out.push({ id: `expo-${id}`, kind: 'stageExposure', actorId: id, icon: 'rest/cold', label: 'Exposition',
      rollLabel: 'Résistance', base: resVal, target: Math.max(1, Math.min(99, resVal + DIFFICULTY_MODIFIERS[diff as Difficulty])),
      result: null, interactive: true, menace: 'Exposition',
      meta: { weatherLabel: WEATHER_LABEL[stage.weather], warded: isWeatherWarded(h), coldSeason: isColdSeason(stage.season) } });
  }
  return out;
}

/** Un Test d'EXPOSITION de fin d'Étape (l.73) : échec → escalade cumulative de froid (l.415), rhume en
 *  saison froide (raconté). Protection magique = ignorée d'office. Le RANG d'échec = nombre de paliers de
 *  froid DÉJÀ PERSISTÉS (activeEffects `exposition-froid`, comme l'ancien chemin inline) — escalade
 *  cumulative INTER-Étapes (0 → −10 CT/Ag/Dex, 3 → le reste, 10 → Blessures). */
registerCascadeApplier('stageExposure', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  const weatherLabel = String(step.meta?.weatherLabel ?? '');
  if (step.meta?.warded) return { consequences: freeCons([`${hero.name} ignore le froid et les intempéries (protection magique).`]) };
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5) ;
  // succès sans effet (rien à ajouter) → aucune conséquence.
  if (step.result.success) return { consequences: freeCons([]) };
  const j = [`${hero.name} — Exposition de fin d'Étape (${weatherLabel}) : transi par le froid.`];
  const prior = (hero.activeEffects ?? []).filter((e) => e.effectId === 'exposition-froid').length;
  const rank = prior >= 10 ? 3 : prior >= 3 ? 2 : 1;
  j.push(...applyExposureFailure(hero, rank, battleRng()).log);
  if (step.meta?.coldSeason) j.push(`${hero.name} grelotte et tousse — un rhume couve (saison froide).`);
  return { consequences: freeCons(j) };
});
