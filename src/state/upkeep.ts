/**
 * Entretien QUOTIDIEN du groupe (#T2/#T3) — source unique, anti-double-comptage.
 *
 * « Tout est horodaté » : chaque chemin qui avance l'horloge (advanceTime, repos, voyage) appelle
 * `runDailyUpkeep`, qui traite les FRANCHISSEMENTS DE JOUR entre `lastUpkeepDay` et le jour courant
 * — une journée n'est jamais comptée deux fois, quel que soit le chemin emprunté.
 *
 * Par journée écoulée et par héros (#T3 — cascade RAW) :
 *  1. consommation d'une Ration (LDB 66 p.302) sinon faim (LDB 18 l.337-343) — cf. `engine/provisions` ;
 *  2. progression des MALADIES (LDB 20 : incubation/durée en jours CALENDAIRES, repos ou pas) —
 *     `dailyDiseaseUpkeep` (+ soins d'un soignant au repos via `opts.caredFor`) ;
 *  3. CONVALESCENCE des Blessures critiques (LDB 18 l.317 : « un nombre de JOURS égal à 30 − BE »,
 *     calendaire) — `tickTraumaRecovery`.
 * (Corruption : AUCUN déclencheur temporel dans LDB 19 — rien à câbler, vérifié à la source.)
 *
 * `purgeClockEffects` (appelé à CHAQUE passage, même sans franchissement de jour) dissipe les effets
 * à durée d'HORLOGE arrivés à échéance : contrecoups d'incantation `castPenalties.untilTime`
 * (LDB 46/40 — « Pensez à vos actes » une semaine, Drain de puissance N minutes…). Avant #T3, cette
 * purge ne vivait que dans `advanceTime` : un contrecoup expiré restait actif après un voyage/repos
 * (qui posent `gameTime` directement).
 *
 * N'importe QUE du moteur + battleRng (pas de cycle avec les flux).
 */
import { battleRng } from './battleRng';
import { tickCampaignVesselWeek } from './shipCrew';
import { dayIndex } from '../engine/clock';
import { dailyFoodUpkeep, dailyWaterUpkeep, feedFromMeal } from '../engine/provisions';
import { testValue } from '../engine/skills';
import { effectiveChar, bonus, refreshWounds } from '../engine/characteristics';
import { loseWounds, addClockCondition } from '../engine/conditions';
import { rollTest } from '../engine/tests';
import { soberUp } from '../engine/drunkenness';
import { DIFFICULTY_MODIFIERS, type Difficulty, type UpkeepDeferTest, type NightTestKind } from '../engine/types';
import { dailyDiseaseUpkeep, restResistVal } from '../engine/rest';
import { conditionLabel } from '../data';
import { rule } from '../engine/policy';
import { dropExpiredGrantedTraits } from '../engine/grantedTraits';
import { dropExpiredGrantedResources } from '../engine/grantedResources';
import { dropExpiredGrantedWeapons } from '../engine/conjuredWeapons';
import { dropExpiredGrantedMutations } from '../engine/corruption';
import { recomputeLoadout } from '../engine/items';
import { restoreSuppressedPsych } from '../engine/psychology';
import { tickTraumaRecovery } from '../engine/trauma';
import { applyOps } from '../engine/ops';
import { bus, EVT } from './bus';

import type { Get, Set } from './flowTypes';

export { dayIndex };

/** Purge les effets à durée d'HORLOGE arrivés à échéance (`untilTime` ≤ maintenant) : contrecoups
 *  d'incantation (LDB 46/40) ET buffs de sort à durée en minutes/heures/jours (LDB 47 — cascade #T3).
 *  Appelée par advanceTime (donc à chaque Round de combat) ET par l'entretien quotidien (repos/voyage) ;
 *  couvre le groupe ET les combattants d'une bataille en cours (copies de spawn).
 *  RENVOIE les dissipations (reprises dans le rapport du jour au franchissement). */
export function purgeClockEffects(get: Get, set: Set): string[] {
  const now = get().gameTime;
  const expiredLog: string[] = [];
  const pool = [...get().party, ...(get().battle?.combatants ?? [])];
  for (const h of pool) {
    const exp = (h.castPenalties ?? []).filter((p) => p.untilTime != null && p.untilTime <= now);
    if (exp.length) {
      for (const p of exp) expiredLog.push(`${h.label} : ${p.label} se dissipe.`);
      h.castPenalties = h.castPenalties!.filter((p) => !(p.untilTime != null && p.untilTime <= now));
    }
    const fx = (h.activeEffects ?? []).filter((e) => e.duration.scale === 'clock' && e.duration.until <= now);
    if (fx.length) {
      for (const e of fx) expiredLog.push(`${h.label} : ${e.label} se dissipe.`);
      h.activeEffects = h.activeEffects!.filter((e) => !(e.duration.scale === 'clock' && e.duration.until <= now));
      dropExpiredGrantedTraits(h, fx); // traits accordés (op grantTrait) retirés avec leur effet
      dropExpiredGrantedResources(h, fx); // Chance/Destin accordés (gainResource) non dépensés
      dropExpiredGrantedWeapons(h, fx); // armes invoquées/naturelles accordées : loadout recomposé
      const mutDropped = dropExpiredGrantedMutations(h, fx); // mutation TEMPORISÉE (op rollMutation) détachée
      if (mutDropped) recomputeLoadout(h); // armes/PA naturels de mutation retirés → loadout recomposé
      restoreSuppressedPsych(h, fx); // Traits psy suspendus (Baume, LDB 42) restitués
      // Blessures max dérivées : un buff F/E/FM ou un `attrMod{wounds}` (Bonnet de fou) expiré, OU une
      // mutation détachée (charMod E/F/FM) recale max + courants.
      if (mutDropped || fx.some((e) => e.attrMods?.wounds || e.char === 'force' || e.char === 'endurance' || e.char === 'force-mentale')) refreshWounds(h);
    }
    // États à durée d'HORLOGE (op `condition.durationHours` — Belladone : sommeil « 1d10+4 heures ») :
    // dissipés à l'échéance, même canal de purge que les effets actifs (LDB 72 l.18).
    const conds = (h.conditions ?? []).filter((x) => x.untilTime != null && x.untilTime <= now);
    if (conds.length) {
      for (const x of conds) expiredLog.push(`${h.label} : l'État ${conditionLabel(x.id)} se dissipe.`);
      h.conditions = h.conditions.filter((x) => !(x.untilTime != null && x.untilTime <= now));
    }
  }
  if (expiredLog.length) { set({ party: [...get().party] }); get().log(expiredLog); }
  return expiredLog;
}

/** Purge les effets « pour la prochaine aventure » (`ActiveEffect.duration.scale === 'adventure'` —
 *  LDB 23 l.209/218/234 : Entraînement au Combat, Observer une cible, Réputation) : la borne « fin
 *  d'aventure » n'a pas d'échéance chiffrable à la pose — elle est la PROCHAINE ouverture d'interlude
 *  (`startInterlude`, seul appelant). RENVOIE les dissipations (journalisées par l'appelant). */
export function purgeAdventureEffects(get: Get, set: Set): string[] {
  const expiredLog: string[] = [];
  for (const h of get().party) {
    const fx = (h.activeEffects ?? []).filter((e) => e.duration.scale === 'adventure');
    if (!fx.length) continue;
    for (const e of fx) expiredLog.push(`${h.label} : ${e.label} se dissipe (fin de l'aventure).`);
    h.activeEffects = (h.activeEffects ?? []).filter((e) => e.duration.scale !== 'adventure');
  }
  if (expiredLog.length) { set({ party: [...get().party] }); get().log(expiredLog); }
  return expiredLog;
}

/** Traite les journées écoulées depuis le dernier entretien (rations/faim, maladies, convalescence)
 *  + purge des effets d'horloge. No-op (hors purge) si aucun franchissement de jour. Appelé par
 *  advanceTime, le repos (`opts.caredFor` = un soignant Guérison veille le groupe) et le voyage.
 *  RENVOIE les lignes du bilan : chaque appelant les AFFICHE (révélation témoin / bilan de nuit /
 *  recap de voyage) — le journal seul ne suffit pas (personne ne le lit). */
/** Un Test de Résistance d'entretien DIFFÉRÉ, prêt à devenir une étape de cascade de nuit. */
export interface DeferredUpkeepTest {
  heroId: string;
  /** Vocabulaire FERMÉ des étapes de nuit (#1117 point 5) — un kind inventé ne compile pas. */
  kind: NightTestKind;
  label: string;
  base: number;
  /** Difficulté DÉCLARÉE du Test (comprise dans `target`) — la ligne de jet la DIT (#1112). */
  difficulty: Difficulty;
  /** Modificateurs NOMMÉS compris dans `target` (Faim/Soif : « -10 % de plus pour chaque Test », LDB 18 l.338). */
  mods?: { label: string; value: number }[];
  target: number;
  meta?: Record<string, unknown>; // p.ex. { diseaseName, onFail: GameOp[] } — porté tel quel jusqu'à l'applier
}

export function runDailyUpkeep(get: Get, set: Set, opts: { caredFor?: boolean; fedDaily?: boolean; onDeferTest?: (t: DeferredUpkeepTest) => void } = {}): string[] {
  // Dissipations d'effets d'horloge : au FRANCHISSEMENT de jour, elles font partie du rapport
  // visible (hors franchissement — rythme combat — le journal et les icônes d'État suffisent).
  const purged = purgeClockEffects(get, set);
  const today = dayIndex(get().gameTime);
  const last = get().lastUpkeepDay;
  if (today <= last) return [];
  const party = get().party;
  const lines: string[] = [];
  let rations = 0;
  // Accès à l'eau (LDB 18 l.340) : abondant au Reikland sauf règle `water-scarcity` ; en mer, suit les
  // tonneaux du navire (`vessel.waterLitres`) — stable sur l'entretien, calculé une fois.
  const waterLitres = get().vessel?.waterLitres;
  const hasWater = waterLitres != null ? waterLitres > 0 : rule('water-scarcity') !== true;
  for (let d = last + 1; d <= today; d++) {
    for (const h of party) {
      if (h.dead) continue;
      // Période NOURRIE (interlude « Entre deux aventures » : gîte et couvert payés par l'Argent
      // à gaspiller, LDB 23) : chaque jour est un repas — la Faim ne s'installe jamais.
      if (opts.fedDaily) feedFromMeal(h);
      // `onDeferTest` (cascade de nuit) : TOUT Test de Résistance d'entretien (Faim, maladie,
      //  convalescence) est DIFFÉRÉ en étape influençable au lieu d'être roulé ici (sinon témoin
      //  pré-résolu). Le wrapper calcule la cible (base + difficulté + pénalité) et ajoute le héros.
      const defer: UpkeepDeferTest | undefined = opts.onDeferTest
        ? (spec) => opts.onDeferTest!({ heroId: h.id, kind: spec.kind, label: spec.label, base: spec.base,
          difficulty: spec.difficulty,
          ...(spec.penalty ? { mods: [{ label: 'Tests déjà subis', value: spec.penalty }] } : {}),
          target: spec.base + DIFFICULTY_MODIFIERS[spec.difficulty] + (spec.penalty ?? 0), meta: spec.meta })
        : undefined;
      // 1. Nourriture (LDB 18 l.337-343).
      const r = dailyFoodUpkeep(h, testValue(h, 'resistance', 'endurance'), bonus(effectiveChar(h, 'endurance')), battleRng(), defer);
      if (r.rationConsumed) rations++;
      if (r.damage > 0) loseWounds(h, r.damage);
      lines.push(...r.log);
      // 1bis. Eau / Soif (LDB 18 l.340) — accès à l'eau calculé plus haut (`hasWater`).
      const w = dailyWaterUpkeep(h, hasWater, testValue(h, 'resistance', 'endurance'), bonus(effectiveChar(h, 'endurance')), battleRng(), defer);
      if (w.damage > 0) loseWounds(h, w.damage);
      lines.push(...w.log);
      // 1ter. Dessoûlage (LDB 09 l.485) : une nuit sans boire dégrise. Deux Tests de Résistance à l'alcool
      //       Intermédiaires fixent la dissipation (10−DR h) et la gueule de bois (Exténué 5−DR h, horloge).
      if (h.drunk) {
        const alc = testValue(h, 'resistance-a-l-alcool', 'endurance');
        // DIFFÉRÉ comme ses voisins (faim/soif) quand un canal influençable existe : le Test de
        // Résistance à l'alcool devient une étape de cascade au lieu d'être roulé ici (sinon pré-résolu).
        if (defer) defer({ kind: 'dessoulage', label: 'Dessoûlage', base: alc, difficulty: 'intermediaire' });
        else {
          const sr = soberUp(h, get().gameTime, rollTest(alc, 'intermediaire', battleRng()).sl, rollTest(alc, 'intermediaire', battleRng()).sl);
          lines.push(...sr.log);
          if (sr.hangover) addClockCondition(h, sr.hangover.id, sr.hangover.value, sr.hangover.until);
        }
      }
      // 2. Maladies (LDB 20 — jours calendaires, #T3). Règle optionnelle : désactivable (disease-mode off).
      if (rule('disease-mode') !== 'off') lines.push(...dailyDiseaseUpkeep(h, battleRng(), opts.caredFor, defer));
      // 3. Convalescence des Blessures critiques (LDB 18 — jours calendaires, #T3).
      lines.push(...tickTraumaRecovery(h, 1, battleRng(), restResistVal(h), defer));
    }
  }
  // Nuit forcée (maison `travel-sleep-forced`, #340) : chaque jour calendaire franchi SANS nuit jouée
  // (aucun repos depuis `lastNightDay`) inflige 1 État Exténué « privation de sommeil » par héros vivant.
  // Jamais silencieux (Consequence via applyOps `condition`) ; retiré au prochain vrai sommeil (LDB 16).
  if (rule('travel-sleep-forced') === true) {
    const missed = Math.max(0, today - Math.max(last, get().lastNightDay));
    if (missed > 0) {
      for (const h of party) {
        if (h.dead) continue;
        lines.push(`${h.label} — privation de sommeil (${missed} nuit${missed > 1 ? 's' : ''} sans dormir) :`);
        lines.push(...applyOps(h, [{ op: 'condition', id: 'extenue', value: missed }], { rng: battleRng() }));
      }
    }
  }
  if (rations > 0) lines.unshift(`Le groupe entame ses provisions (${rations} ration${rations > 1 ? 's' : ''}).`);
  // Navire de campagne (MDG 14) : PAIE hebdomadaire de l'équipage salarié puis recalcul du Moral, une
  // fois par semaine calendaire (garde interne à `tickCampaignVesselWeek` ; un saut de plusieurs jours ne
  // recalcule qu'au franchissement de semaine). #216.
  set({ lastUpkeepDay: today, party: [...party] }); // persiste faim/eau/maladies/convalescence AVANT le débit des gages
  lines.push(...tickCampaignVesselWeek(get, set, today, battleRng())); // débite les bourses PAR-DESSUS (lit get().party à jour)
  get().log(lines);
  if (lines.length) bus.emit(EVT.SCENE_DIRTY);
  return [...purged, ...lines]; // les dissipations du jour font partie du bilan affiché
}
