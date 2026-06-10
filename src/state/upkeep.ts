/**
 * Entretien QUOTIDIEN du groupe (#T2) — source unique, anti-double-comptage.
 *
 * « Tout est horodaté » : chaque chemin qui avance l'horloge (advanceTime, repos, voyage) appelle
 * `runDailyUpkeep`, qui traite les FRANCHISSEMENTS DE JOUR entre `lastUpkeepDay` et le jour courant
 * — une journée n'est jamais comptée deux fois, quel que soit le chemin emprunté.
 *
 * Par journée écoulée et par héros : consommation d'une Ration (LDB p.302) sinon faim
 * (LDB 18 l.417-422 — Tests de Résistance, malus, dégâts ignorant les PA) — cf. `engine/provisions`.
 * N'importe QUE du moteur + battleRng (pas de cycle avec les flux).
 */
import type { GameState } from './store';
import { battleRng } from './battleRng';
import { MINUTES_PER_DAY } from '../engine/clock';
import { dailyFoodUpkeep } from '../engine/provisions';
import { testValue } from '../engine/skills';
import { effectiveChar, bonus } from '../engine/characteristics';
import { loseWounds } from '../engine/conditions';
import { bus, EVT } from './bus';

type Get = () => GameState;
type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;

/** Jour courant de l'horloge (index de jour depuis l'époque). */
export function dayIndex(gameTime: number): number {
  return Math.floor(gameTime / MINUTES_PER_DAY);
}

/** Traite les journées écoulées depuis le dernier entretien (rations/faim). No-op si aucun
 *  franchissement de jour. Appelé par advanceTime, le repos et le voyage. */
export function runDailyUpkeep(get: Get, set: Set): void {
  const today = dayIndex(get().gameTime);
  const last = get().lastUpkeepDay;
  if (today <= last) return;
  const party = get().party;
  const lines: string[] = [];
  let rations = 0;
  for (let d = last + 1; d <= today; d++) {
    for (const h of party) {
      if (h.dead) continue;
      const r = dailyFoodUpkeep(h, testValue(h, 'Résistance', 'E'), bonus(effectiveChar(h, 'E')), battleRng());
      if (r.rationConsumed) rations++;
      if (r.damage > 0) loseWounds(h, r.damage);
      lines.push(...r.log);
    }
  }
  if (rations > 0) lines.unshift(`Le groupe entame ses provisions (${rations} ration${rations > 1 ? 's' : ''}).`);
  set({ lastUpkeepDay: today, party: [...party], journal: [...get().journal.slice(-40), ...lines] });
  if (lines.length) bus.emit(EVT.SCENE_DIRTY);
}
