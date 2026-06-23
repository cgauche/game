/**
 * Résolution des POSTES d'Activité d'une Étape de voyage (EDOC ch.5) — module FEUILLE (convention
 * « baril ») : n'importe RIEN de `travelFlow` (ré-exporté par lui). Chaque héros tient ≤1 Activité ;
 * on résout son Test (moteur PUR `resolveStageActivities`), on applique les effets (langue UNIQUE
 * `GameOp`/`applyOps` + États), on AGRÈGE (porte/cumul/individuel) et on rend le récit + les drapeaux
 * d'Étape (Exposition sautée, pas de surprise). RAW : « chaque Personnage bénéficie d'une Activité par
 * Étape » (l.131) ; un échec donne un Exténué au performeur (l.133).
 */
import { battleRng } from './battleRng';
import { d100 } from '../engine/dice';
import {
  resolveStageActivities, aggregateActivityOutcomes, activityById,
  type ActivityDef, type TravelActivityResult,
} from '../engine/activities';
import { stageEncounterCategory } from '../engine/travelEncounter';
import { rollEncounter, type EncounterCategory } from '../engine/travelTables';
import { applyOps } from '../engine/ops';
import { addCondition, removeCondition, stacks } from '../engine/conditions';
import { extendedTestStep } from '../engine/tests';
import { rule } from '../engine/policy';
import { stageCount, pleinAirModifier, forageWeatherModifier, forageYield, type Weather } from '../engine/travelStages';
import { rationCount } from '../engine/provisions';
import { itemFromGive } from '../engine/items';
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

export interface StagePostesResult {
  lines: string[];
  entries: NightEntry[];
  /** Porte « Plein air » ouverte : le groupe SAUTE le Test d'Exposition cette Étape (EDOC l.141). */
  suppressExposure: boolean;
  /** Porte « Rester aux aguets » : le groupe ne peut être surpris cette Étape (EDOC l.157). */
  noSurprise: boolean;
}

/** Résout et APPLIQUE les postes d'Activité de l'Étape (mute party/plan via get/set), rend le récit. */
export function resolveStagePostes(get: Get, set: Set, weather: Weather): StagePostesResult {
  const out: StagePostesResult = { lines: [], entries: [], suppressExposure: false, noSurprise: false };
  const plan = get().travelPlan;
  const party = get().party;
  if (!plan?.postes || Object.keys(plan.postes).length === 0) return out;

  const stages = stageCount(plan.km);
  // Modificateur météo PAR activité : Plein air (l.141) et Approvisionnement (l.56) seulement.
  const weatherModOf = (def: ActivityDef): number =>
    def.id === 'plein-air' ? pleinAirModifier(weather)
      : def.id === 'approvisionnement' ? forageWeatherModifier(weather)
        : 0;

  const results: TravelActivityResult[] = resolveStageActivities(party, plan.postes, battleRng(), { skillMod: weatherModOf, stages });
  const byId = (id: string) => party.find((h) => h.id === id);

  // 1) Par poste : effets GameOp (langue unique) + Exténué sur échec + entrée de bilan (RollLine).
  for (const r of results) {
    const actor = byId(r.actorId);
    if (!actor) continue;
    const label = activityById(r.activityId)?.label ?? r.activityId;
    out.lines.push(r.roll != null
      ? `${actor.name} — ${label} : 🎲 ${r.roll}/${r.target} → ${r.success ? `réussi (DR ${r.sl})` : r.extenue ? 'échec (Exténué)' : 'échec'}`
      : `${actor.name} — ${label} (effectué).`);
    if (r.ops.length) out.lines.push(...applyOps(actor, r.ops));
    if (r.extenue) addCondition(actor, 'extenue', 1);
    out.entries.push({
      actorId: actor.id, icon: POSTE_ICON[r.activityId] ?? '🧭', label,
      d: r.roll != null
        ? { label, base: r.value ?? 0, modifier: (r.target ?? 0) - (r.value ?? 0), target: r.target ?? 0, roll: r.roll, success: r.success, sl: r.sl }
        : undefined,
      text: r.roll == null ? 'effectué' : r.success ? `réussi (DR ${r.sl})` : r.extenue ? 'échec — Exténué' : 'échec',
      tone: r.roll == null ? 'info' : r.success ? 'ok' : 'bad',
    });
  }

  // 2) Approvisionnement (résolveur « forage », CUMUL des fourrageurs) — FACTORISÉ depuis resolveStage.
  const foraged = results.filter((r) => r.resolver === 'forage' && r.success).reduce((n, r) => n + forageYield(r.sl, 'recherche'), 0);
  if (foraged > 0) {
    let remaining = foraged;
    for (const h of party.filter((x) => !x.dead && !x.outOfRencontre)) {
      if (remaining <= 0) break;
      if (rationCount(h) >= 1) continue; // déjà de quoi manger ce jour-là
      h.items = [...(h.items ?? []), itemFromGive({ trappingId: 'ration' })];
      remaining -= 1;
      out.lines.push(`${h.name} reçoit une ration trouvée en chemin.`);
    }
  }

  // 3) Agrégation des issues d'Étape.
  const agg = aggregateActivityOutcomes(results);
  out.suppressExposure = agg.gates.includes('suppressExposure');
  out.noSurprise = agg.gates.includes('noSurprise');

  // Monter le camp (CUMUL) : chaque DR retire un Exténué d'un Personnage (EDOC l.180).
  let campDR = agg.stacks.campCare ?? 0;
  for (const h of party) {
    if (campDR <= 0) break;
    const n = stacks(h, 'extenue');
    if (n <= 0) continue;
    const take = Math.min(campDR, n);
    removeCondition(h, 'extenue', take);
    campDR -= take;
    out.lines.push(`Camp bien monté : ${h.name} récupère (−${take} Exténué).`);
  }

  // Établir des cartes (Test ÉTENDU inter-Étapes) : cumul via le helper UNIQUE + persistance sur le plan.
  const mapDR = agg.stacks.mapMade ?? 0;
  if (mapDR > 0) {
    const drTarget = results.find((r) => r.activityId === 'etablir-cartes')?.drTarget ?? 2 * stages;
    const { total, done } = extendedTestStep(plan.extendedProgress ?? 0, { success: true, sl: mapDR }, drTarget, !!rule('test-extended-min-sl'));
    set({ travelPlan: { ...get().travelPlan!, extendedProgress: done ? undefined : total } });
    out.lines.push(done ? `La carte de l'itinéraire est ACHEVÉE (${drTarget}/${drTarget} DR).` : `Cartographie : ${total}/${drTarget} DR.`);
  }

  // Individuel (Récupérer / Pratiquer / Recueillir infos) : récit. Leurs effets COMPLETS (repos pour la
  // convalescence, jeton de relance, questions au MJ) dépendent de systèmes dédiés — câblés ultérieurement.
  for (const [heroId, outcomes] of Object.entries(agg.selfByHero)) {
    const h = byId(heroId);
    if (!h) continue;
    for (const o of outcomes) {
      if (o === 'countsAsRest') out.lines.push(`${h.name} prend soin de ne pas se surmener — cette Étape compte comme un repos.`);
      else if (o === 'rerollToken') out.lines.push(`${h.name} s'exerce en chemin — il pourra inverser un futur Test de cette Compétence.`);
      else if (o === 'gatherInfo') out.lines.push(`${h.name} glane des informations en route.`);
    }
  }

  // 4) RENCONTRE de l'Étape (EDOC l.182-233) : catégorie issue de la qualité des Tests (moteur PUR),
  // tirage d100 sur la table en DONNÉE (`rollEncounter`), texte VERBATIM au bilan. La plupart des
  // Rencontres sont de la prose arbitrée par le MJ ; seule l'issue MÉCANISABLE « Voyage tranquille »
  // (fullRecovery, l.198) est appliquée — guérit toutes les Blessures et retire tous les Exténué.
  const category = stageEncounterCategory(results);
  if (category) {
    const enc = rollEncounter(category, d100(battleRng()));
    const pres = ENCOUNTER_PRESENTATION[category];
    out.lines.push(`${pres.icon} ${pres.label} — ${enc.label} : ${enc.text}`);
    out.entries.push({ icon: pres.icon, label: enc.label, text: enc.label, tone: pres.tone });
    if (enc.stageOutcome === 'fullRecovery') {
      for (const h of party.filter((x) => !x.dead)) {
        h.wounds.current = h.wounds.max;
        const ex = stacks(h, 'extenue');
        if (ex > 0) removeCondition(h, 'extenue', ex);
      }
      out.lines.push('Voyage tranquille : le groupe récupère toutes ses Blessures et tous ses États Exténué.');
    }
  }

  set({ party: [...get().party] });
  return out;
}
