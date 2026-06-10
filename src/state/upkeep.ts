/**
 * Entretien QUOTIDIEN du groupe (#T2/#T3) — source unique, anti-double-comptage.
 *
 * « Tout est horodaté » : chaque chemin qui avance l'horloge (advanceTime, repos, voyage) appelle
 * `runDailyUpkeep`, qui traite les FRANCHISSEMENTS DE JOUR entre `lastUpkeepDay` et le jour courant
 * — une journée n'est jamais comptée deux fois, quel que soit le chemin emprunté.
 *
 * Par journée écoulée et par héros (#T3 — cascade RAW) :
 *  1. consommation d'une Ration (LDB p.302) sinon faim (LDB 18 l.417-422) — cf. `engine/provisions` ;
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
import type { GameState } from './store';
import { battleRng } from './battleRng';
import { MINUTES_PER_DAY } from '../engine/clock';
import { dailyFoodUpkeep } from '../engine/provisions';
import { testValue } from '../engine/skills';
import { effectiveChar, bonus } from '../engine/characteristics';
import { loseWounds } from '../engine/conditions';
import { dailyDiseaseUpkeep, restResistVal } from '../engine/rest';
import { dropExpiredGrantedTraits } from '../engine/grantedTraits';
import { tickTraumaRecovery } from '../engine/trauma';
import { bus, EVT } from './bus';

type Get = () => GameState;
type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;

/** Jour courant de l'horloge (index de jour depuis l'époque). */
export function dayIndex(gameTime: number): number {
  return Math.floor(gameTime / MINUTES_PER_DAY);
}

/** Purge les effets à durée d'HORLOGE arrivés à échéance (`untilTime` ≤ maintenant) : contrecoups
 *  d'incantation (LDB 46/40) ET buffs de sort à durée en minutes/heures/jours (LDB 47 — cascade #T3).
 *  Appelée par advanceTime (donc à chaque Round de combat) ET par l'entretien quotidien (repos/voyage) ;
 *  couvre le groupe ET les combattants d'une bataille en cours (copies de spawn). */
export function purgeClockEffects(get: Get, set: Set): void {
  const now = get().gameTime;
  const expiredLog: string[] = [];
  const pool = [...get().party, ...(get().battle?.combatants ?? [])];
  for (const h of pool) {
    const exp = (h.castPenalties ?? []).filter((p) => p.untilTime != null && p.untilTime <= now);
    if (exp.length) {
      for (const p of exp) expiredLog.push(`${h.name} : ${p.label} se dissipe.`);
      h.castPenalties = h.castPenalties!.filter((p) => !(p.untilTime != null && p.untilTime <= now));
    }
    const fx = (h.activeEffects ?? []).filter((e) => e.untilTime != null && e.untilTime <= now);
    if (fx.length) {
      for (const e of fx) expiredLog.push(`${h.name} : ${e.label} se dissipe.`);
      h.activeEffects = h.activeEffects!.filter((e) => !(e.untilTime != null && e.untilTime <= now));
      dropExpiredGrantedTraits(h, fx); // traits accordés (op grantTrait) retirés avec leur effet
    }
  }
  if (expiredLog.length) set({ party: [...get().party], journal: [...get().journal.slice(-40), ...expiredLog] });
}

/** Traite les journées écoulées depuis le dernier entretien (rations/faim, maladies, convalescence)
 *  + purge des effets d'horloge. No-op (hors purge) si aucun franchissement de jour. Appelé par
 *  advanceTime, le repos (`opts.caredFor` = un soignant Guérison veille le groupe) et le voyage. */
export function runDailyUpkeep(get: Get, set: Set, opts: { caredFor?: boolean } = {}): void {
  purgeClockEffects(get, set);
  const today = dayIndex(get().gameTime);
  const last = get().lastUpkeepDay;
  if (today <= last) return;
  const party = get().party;
  const lines: string[] = [];
  let rations = 0;
  for (let d = last + 1; d <= today; d++) {
    for (const h of party) {
      if (h.dead) continue;
      // 1. Nourriture (LDB 18 l.417-422).
      const r = dailyFoodUpkeep(h, testValue(h, 'Résistance', 'E'), bonus(effectiveChar(h, 'E')), battleRng());
      if (r.rationConsumed) rations++;
      if (r.damage > 0) loseWounds(h, r.damage);
      lines.push(...r.log);
      // 2. Maladies (LDB 20 — jours calendaires, #T3).
      lines.push(...dailyDiseaseUpkeep(h, battleRng(), opts.caredFor));
      // 3. Convalescence des Blessures critiques (LDB 18 — jours calendaires, #T3).
      lines.push(...tickTraumaRecovery(h, 1, battleRng(), restResistVal(h)));
    }
  }
  if (rations > 0) lines.unshift(`Le groupe entame ses provisions (${rations} ration${rations > 1 ? 's' : ''}).`);
  set({ lastUpkeepDay: today, party: [...party], journal: [...get().journal.slice(-40), ...lines] });
  if (lines.length) bus.emit(EVT.SCENE_DIRTY);
}
