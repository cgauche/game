/**
 * POSTES d'Activité d'une Étape de voyage (EDOC ch.5) — module FEUILLE (convention « baril ») :
 * n'importe RIEN de `travelFlow` (ré-exporté par lui). Chaque héros tient ≤1 Activité ; depuis la
 * Phase B (voyage terrestre), TOUS les jets de l'Étape (Activités + Exposition de fin d'Étape)
 * passent par la CASCADE influençable du JOUR (`purpose:'travelDay'`) au lieu d'être auto-résolus
 * inline — Chance/Pacte/Résilience s'appliquent, exactement comme la nuit et le voyage fluvial.
 *
 * Deux temps, zéro duplication de formule (moteur PUR `engine/activities` + `engine/exposure`) :
 *  - `buildStageSteps` construit les ÉTAPES influençables (1 jet par poste testé + 1 pas d'agrégation)
 *    et pose le contexte transitoire de l'Étape sur le plan (`travelPlan.stage`) ;
 *  - les APPLIERS (`stagePoste`, `stageAggregate`, `stageExposure`) appliquent la conséquence RAW à la
 *    VALIDATION de chaque étape — un poste réussi/raté (ops/Exténué/issue de portée Étape), puis
 *    l'agrégation (fourrage cumulé, camp, cartes, Rencontre) qui INSÈRE les jets d'Exposition (comme
 *    la nuit : `shelter` insère les jets d'Exposition). RAW : « chaque Personnage bénéficie d'une
 *    Activité par Étape » (l.131) ; un échec octroie un Exténué (l.133).
 */
import { battleRng } from './battleRng';
import { d100 } from '../engine/dice';
import {
  travelActivitySpec, applyTravelActivityResult, aggregateActivityOutcomes, activityById,
  type ActivityDef, type TravelActivityResult, type SkillRef,
} from '../engine/activities';
import { stageEncounterCategory } from '../engine/travelEncounter';
import { rollEncounter, type EncounterCategory } from '../engine/travelTables';
import { applyOps } from '../engine/ops';
import { addCondition, removeCondition, stacks } from '../engine/conditions';
import { extendedTestStep } from '../engine/tests';
import { registerCascadeApplier } from './cascade';
import { rule } from '../engine/policy';
import {
  stageCount, pleinAirModifier, forageWeatherModifier, forageYield, stageExposureDifficulty,
  isColdSeason, WEATHER_LABEL, type Weather, type Season,
} from '../engine/travelStages';
import { hasCoat, partyHasTent, applyExposureFailure, isWeatherWarded } from '../engine/exposure';
import { rationCount } from '../engine/provisions';
import { itemFromGive } from '../engine/items';
import { testValue } from '../engine/skills';
import { DIFFICULTY_MODIFIERS, type Difficulty, type Combatant } from '../engine/types';
import type { CascadeStep, CascadeStepMeta } from './pendings';
import type { NightEntry } from './restFlow';
import type { Get, Set } from './flowTypes';

const POSTE_ICON: Record<string, string> = {
  'plein-air': '⛅', approvisionnement: '🍖', 'recueillir-informations': '💬', 'rester-aux-aguets': '👁️',
  'etablir-cartes': '🗺️', 'pratiquer-competence': '🎯', recuperer: '😴', 'monter-camp': '⛺',
};

/** Présentation d'une catégorie de Rencontre (EDOC ch.5) — icône + libellé + ton du bilan. */
const ENCOUNTER_PRESENTATION: Record<EncounterCategory, { icon: string; label: string; tone: 'ok' | 'bad' | 'info' }> = {
  positives: { icon: '🍀', label: 'Rencontre positive', tone: 'ok' },
  fortuites: { icon: '🎭', label: 'Rencontre fortuite', tone: 'info' },
  dangereuses: { icon: '⚠️', label: 'Rencontre dangereuse', tone: 'bad' },
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

const log = (get: Get, set: Set, lines: string[]) => {
  if (lines.length) set({ journal: [...get().journal.slice(-40), ...lines] });
};

/** Modificateur météo PAR activité : Plein air (l.141) et Approvisionnement (l.56) seulement. */
function weatherModOf(def: ActivityDef, weather: Weather): number {
  return def.id === 'plein-air' ? pleinAirModifier(weather)
    : def.id === 'approvisionnement' ? forageWeatherModifier(weather)
      : 0;
}

/** Reconstruit une réf de compétence libre depuis le meta sérialisé d'une étape. */
function freeSkillFromMeta(meta?: CascadeStepMeta): SkillRef | undefined {
  const id = meta?.freeSkillId;
  return typeof id === 'string' ? { skillId: id, spec: typeof meta?.freeSkillSpec === 'string' ? meta.freeSkillSpec : undefined } : undefined;
}

/**
 * Construit les ÉTAPES influençables de l'Étape (EDOC ch.5) : un jet par poste TESTÉ (Activité à
 * compétence), un pas d'AFFICHAGE par poste sans Test (Récupérer), puis UN pas d'agrégation
 * `stageAggregate` (fourrage cumulé, camp, cartes, Rencontre → INSÈRE les jets d'Exposition). Pose le
 * contexte transitoire (`travelPlan.stage`). Ne consomme AUCUN RNG (les jets vivent dans les étapes /
 * l'agrégation). Renvoie aussi la ligne de Météo (déjà tirée par l'appelant, ambiance).
 */
export function buildStageSteps(get: Get, set: Set, weather: Weather, season: Season, weatherLine: string): { steps: CascadeStep[]; log: string[] } {
  const plan = get().travelPlan;
  const party = get().party;
  const logs: string[] = [weatherLine];
  if (!plan?.postes || Object.keys(plan.postes).length === 0) return { steps: [], log: logs };

  const stages = stageCount(plan.km);
  const livingIds = party.filter((h) => !h.dead && !h.outOfRencontre).map((h) => h.id);
  const stage: StageContext = { weather, season, livingIds, results: [] };
  set({ travelPlan: { ...plan, stage } });

  const steps: CascadeStep[] = [];
  for (const hero of party) {
    const posting = plan.postes[hero.id];
    if (!posting) continue;
    const def = activityById(posting.activityId);
    if (!def) continue;
    const spec = travelActivitySpec(hero, def, { skillMod: weatherModOf(def, weather), stages, freeSkill: posting.freeSkill });
    const label = def.label;
    const meta: CascadeStepMeta = { activityId: def.id };
    if (posting.freeSkill?.skillId) { meta.freeSkillId = posting.freeSkill.skillId; if (posting.freeSkill.spec) meta.freeSkillSpec = posting.freeSkill.spec; }
    if (spec.target == null) {
      // Activité SANS Test (Récupérer) : pas d'étape-jet — un pas d'affichage dont l'applier applique l'issue.
      steps.push({ id: `poste-${hero.id}`, kind: 'stagePoste', actorId: hero.id, icon: POSTE_ICON[def.id] ?? '🧭', label, interactive: true, meta });
    } else {
      steps.push({ id: `poste-${hero.id}`, kind: 'stagePoste', actorId: hero.id, icon: POSTE_ICON[def.id] ?? '🧭', label,
        rollLabel: def.skills?.[0]?.skillId ? undefined : undefined, base: spec.value, target: spec.target, result: null, interactive: true, meta });
    }
  }
  // Pas d'agrégation de fin d'Étape (fourrage cumulé, camp, cartes, Rencontre) + insertion des Expositions.
  steps.push({ id: 'stage-agg', kind: 'stageAggregate', icon: '🧮', label: 'Bilan de l’Étape', interactive: true,
    meta: { weatherLabel: WEATHER_LABEL[weather], stages } });
  return { steps, log: logs };
}

// ── APPLIERS des étapes de l'Étape (purpose `travelDay`) : conséquence RAW par `kind`, moteur PUR ──

/** UN poste : issue du jet (ops/Exténué/portée Étape) via le jumeau PUR `applyTravelActivityResult`.
 *  Enregistre le résultat dans le contexte d'Étape (l'agrégation `stageAggregate` le relira). */
registerCascadeApplier('stagePoste', (get, set, step, hero) => {
  const def = activityById(String(step.meta?.activityId ?? ''));
  if (!def || !hero) return;
  const spec = travelActivitySpec(hero, def, { freeSkill: freeSkillFromMeta(step.meta) });
  const roll = step.result ?? null;
  const r = applyTravelActivityResult({ ...spec, actorId: hero.id }, def, roll);
  // Accumule le résultat pour l'agrégation de fin d'Étape.
  const plan = get().travelPlan;
  if (plan?.stage) set({ travelPlan: { ...plan, stage: { ...plan.stage, results: [...plan.stage.results, r] } } });

  const j: string[] = [];
  j.push(r.roll != null
    ? `${hero.name} — ${def.label} : 🎲 ${r.roll}/${r.target} → ${r.success ? `réussi (DR ${r.sl})` : r.extenue ? 'échec (Exténué)' : 'échec'}`
    : `${hero.name} — ${def.label} (effectué).`);
  if (r.ops.length) j.push(...applyOps(hero, r.ops));
  if (r.extenue) addCondition(hero, 'extenue', 1);
  // Issues INDIVIDUELLES (Récupérer / Pratiquer / Recueillir infos) : récit (systèmes dédiés câblés ailleurs).
  if (r.success && r.stageOutcome === 'countsAsRest') j.push(`${hero.name} prend soin de ne pas se surmener — cette Étape compte comme un repos.`);
  else if (r.success && r.stageOutcome === 'rerollToken') j.push(`${hero.name} s'exerce en chemin — il pourra inverser un futur Test de cette Compétence.`);
  else if (r.success && r.stageOutcome === 'gatherInfo') j.push(`${hero.name} glane des informations en route.`);
  set({ party: [...get().party] });
  return { journal: j };
}, (ok, n) => (ok ? `${n} tient son poste.` : `${n} échoue à son poste.`));

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
      h.items = [...(h.items ?? []), itemFromGive({ trappingId: 'ration' })];
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

  // RENCONTRE de l'Étape (l.182-233) : catégorie issue de la qualité des Tests, tirage d100, texte verbatim.
  const category = stageEncounterCategory(results);
  if (category) {
    const enc = rollEncounter(category, d100(battleRng()));
    const pres = ENCOUNTER_PRESENTATION[category];
    j.push(`${pres.icon} ${pres.label} — ${enc.label} : ${enc.text}`);
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
  return { journal: j, insert };
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
    if (!diff) continue;
    const resVal = testValue(h, 'resistance', 'E');
    out.push({ id: `expo-${id}`, kind: 'stageExposure', actorId: id, icon: '🥶', label: 'Exposition',
      rollLabel: 'Résistance', base: resVal, target: Math.max(1, Math.min(99, resVal + DIFFICULTY_MODIFIERS[diff as Difficulty])),
      result: null, interactive: true, menace: 'Exposition',
      meta: { weatherLabel: WEATHER_LABEL[stage.weather], warded: isWeatherWarded(h), coldSeason: isColdSeason(stage.season) } });
  }
  return out;
}

/** Un Test d'EXPOSITION de fin d'Étape (l.73) : échec → escalade cumulative de froid (l.415), rhume en
 *  saison froide (raconté). Protection magique = ignorée d'office. */
registerCascadeApplier('stageExposure', (_get, _set, step, hero, ctx) => {
  if (!hero || !step.result) return;
  const weatherLabel = String(step.meta?.weatherLabel ?? '');
  if (step.meta?.warded) return { journal: [`${hero.name} ignore le froid et les intempéries (protection magique).`] };
  const j = [`${hero.name} — Exposition de fin d'Étape (${weatherLabel}) : 🎲 ${step.result.roll}/${step.result.target} → ${step.result.success ? 'tient le coup.' : 'transi par le froid.'}`];
  if (!step.result.success) {
    // Escalade cumulative (l.415) : rang d'échec = nombre d'échecs d'Exposition DÉJÀ validés de CE héros + 1.
    const prior = ctx.steps.slice(0, ctx.index)
      .filter((s) => s.kind === 'stageExposure' && s.actorId === hero.id && s.result && !s.result.success).length;
    j.push(...applyExposureFailure(hero, prior + 1, battleRng()).log);
    if (step.meta?.coldSeason) j.push(`${hero.name} grelotte et tousse — un rhume couve (saison froide).`);
  }
  return { journal: j };
}, (ok, n) => (ok ? `${n} tient le coup.` : `${n} souffre du froid.`));

void log;
export type { NightEntry };
