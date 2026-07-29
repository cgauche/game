/**
 * MARQUAGE « dé fixé » du JOURNAL — pendant de la mention portée par la rangée de la modale.
 *
 * Arbitrage utilisateur (#939) : un jet dont le joueur a SAISI la valeur est marqué PARTOUT — rangée ET
 * journal. La rangée le porte via `RollRow.fixedMark` ; le journal, lui, n'a qu'UN seul puits (`log` du
 * store) : c'est donc là que la mention s'ajoute, et nulle part ailleurs. Chaque flux compose sa ligne
 * autrement (`res.log` du moteur, `describeX`, `logLines` d'applicateur) — marquer chez eux serait
 * trente copies, et la trentième manquerait.
 *
 * FENÊTRE : un pending reste ouvert pendant que son « Appliquer » compose ses lignes. Tant qu'un slot
 * OUVERT porte `fixed`, les lignes émises sont les conséquences de CE jet — c'est exactement ce qu'il
 * faut marquer. Hors modale, aucun pending n'est ouvert : aucune ligne n'est touchée.
 */
import { PENDING_FIELD_KEYS } from './stateFields';
import type { GameState } from './store';

/** Mention ajoutée en fin de ligne (sobre : le journal n'a pas d'autre décoration de provenance). */
export const FIXED_DIE_MARK = '(dé fixé)';

/** Un objet de jet porte-t-il la provenance « dé fixé » ? (le slot lui-même, ou l'un de ses slots MULTI). */
function slotFixed(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.fixed === true) return true;
  for (const k of ['participants', 'rounds']) {
    const arr = o[k];
    if (Array.isArray(arr) && arr.some(slotFixed)) return true;
  }
  // Fuir : ses slots vivent sous `fuir.participants`.
  return slotFixed(o.fuir);
}

/** Un jet SAISI par le joueur est-il ouvert (donc en cours d'application) ? */
export function fixedJetOpen(s: GameState): boolean {
  const st = s as unknown as Record<string, unknown>;
  return PENDING_FIELD_KEYS.some((k) => slotFixed(st[k]));
}

/** Ajoute la mention à une ligne qui ne la porte pas déjà (le journal reste lisible, sans doublon). */
export function markFixedDie(line: string): string {
  return line.includes('dé fixé') ? line : `${line} ${FIXED_DIE_MARK}`;
}
