/**
 * Poursuite — mécanique de « Distance » (Livre de base, Déplacement, LDB 15 l.86-108). Rien d'inventé :
 *
 *  1. Le MJ fixe la Distance de départ (1 = presque à portée … 8 = presque hors de portée).
 *  2. Chaque participant effectue un Test de Mouvement (Conduite d'Attelages / Chevaucher / Athlétisme
 *     selon les circonstances — la Compétence est passée en donnée, aucun nom en dur).
 *  3. « On compare le DR le plus PETIT obtenu par les poursuivis au plus HAUT DR obtenu par les
 *     poursuivants, et la différence est ajoutée à la Distance si les poursuivis l'ont emporté et
 *     retranchée si ce sont les poursuivants qui l'ont emporté » ⇒ Distance += (min DR fuyards − max DR
 *     poursuivants).
 *  4. Distance ≤ 0 → rattrapés ; Distance ≥ 10 → semés ; sinon la poursuite continue (l.94).
 *  5. Modificateur de Mouvement (l.104-108) : un participant plus rapide gagne autant de DR bonus que sa
 *     différence de Mouvement avec le plus lent de la course (M8/M7/M9 → +1 / 0 / +2 relatifs au plus lent).
 *
 * La résolution d'issue (`pursuitOutcome`) est la PRIMITIVE PARTAGÉE terrestre/navale (la poursuite navale
 * MDG ch.13 calcule son « gain » de Distance différemment — en mètres — mais franchit les MÊMES seuils).
 * PUR : RNG injecté ; ne mute rien.
 */
import { RNG, defaultRNG } from './dice';
import { rollTest } from './tests';

/** Seuil d'évasion terrestre RAW : « Si la Distance atteint 10+, les poursuivants ont perdu leur proie » (l.94). */
export const PURSUIT_ESCAPE_DISTANCE = 10;

/** Issue d'un Round de poursuite selon la Distance courante — SOURCE UNIQUE partagée terrestre/navale. */
export function pursuitOutcome(distance: number, escapeAt: number = PURSUIT_ESCAPE_DISTANCE): 'caught' | 'escaped' | 'ongoing' {
  if (distance <= 0) return 'caught';
  if (distance >= escapeAt) return 'escaped';
  return 'ongoing';
}

/** Un participant à la poursuite : sa valeur de Test de Mouvement (Compétence en DONNÉE), son Mouvement,
 *  et son camp. `id` sert au journal. */
export interface PursuitParticipant {
  id: string;
  skill: number; // valeur de la Compétence de Mouvement (Conduite d'attelage / Chevaucher / Athlétisme…)
  movement: number; // caractéristique de Mouvement (pour le bonus de DR de vitesse, l.104-108)
  side: 'fleeing' | 'pursuer';
}

/** Bonus de DR de vitesse (l.104-108) : différence de Mouvement avec le plus lent de la course. */
export function pursuitMoveBonus(movement: number, slowestMovement: number): number {
  return Math.max(0, movement - slowestMovement);
}

export interface PursuitRoundResult {
  distance: number; // nouvelle Distance
  delta: number; // variation (min DR fuyards − max DR poursuivants)
  outcome: 'caught' | 'escaped' | 'ongoing';
  rolls: { id: string; side: 'fleeing' | 'pursuer'; roll: number; target: number; dr: number; moveBonus: number; total: number }[];
}

/**
 * Résout UN Round de poursuite terrestre (LDB 15). Chaque participant roule son Test de Mouvement (au
 * palier `difficulty`, défaut Intermédiaire), plus le bonus de DR de vitesse. On compare le plus petit DR
 * total des fuyards au plus grand DR total des poursuivants ; la Distance varie de la différence, puis
 * l'issue est jugée par `pursuitOutcome`. Pur ; renvoie la nouvelle Distance, la variation, l'issue et les jets.
 */
export function resolveGroundPursuitRound(
  distance: number,
  participants: PursuitParticipant[],
  rng: RNG = defaultRNG,
  opts: { escapeAt?: number; difficulty?: import('./types').Difficulty } = {},
): PursuitRoundResult {
  const slowest = Math.min(...participants.map((p) => p.movement));
  const rolls = participants.map((p) => {
    const t = rollTest(p.skill, opts.difficulty ?? 'intermediaire', rng);
    const moveBonus = pursuitMoveBonus(p.movement, slowest);
    return { id: p.id, side: p.side, roll: t.roll, target: t.target, dr: t.sl, moveBonus, total: t.sl + moveBonus };
  });
  const fleeing = rolls.filter((r) => r.side === 'fleeing');
  const pursuers = rolls.filter((r) => r.side === 'pursuer');
  // Distance += (DR le plus PETIT des fuyards − DR le plus HAUT des poursuivants) (l.93).
  const minFleeing = fleeing.length ? Math.min(...fleeing.map((r) => r.total)) : 0;
  const maxPursuer = pursuers.length ? Math.max(...pursuers.map((r) => r.total)) : 0;
  const delta = minFleeing - maxPursuer;
  const next = distance + delta;
  return { distance: next, delta, outcome: pursuitOutcome(next, opts.escapeAt), rolls };
}
