/**
 * NARRATION d'issue des jets — SOURCE UNIQUE par flux (popin ET journal).
 *
 * Motif unifié : chaque flux expose une fonction PURE `describeX(pending) → string` qui produit LA
 * ligne d'issue du jet. La modale l'affiche (`<JournalLine event={ev(kind, describeX(p), …)}>`) et le
 * store la journalise au même endroit — fini les `outcomeText` recalculés dans chaque modale (et
 * re-recalculés à la validation). Pour le combat, l'équivalent est `result.log`, déjà posé par le
 * moteur ; ces fonctions étendent le même principe aux flux non-combat.
 */
import type { PendingTest } from './pendings';

/** Test de scène (LDB 12) : réussite / échec / réussite garantie par Résilience. Le DR figure déjà
 *  dans le breakdown au-dessus — l'issue reste une phrase courte. */
export function describeTest(pt: PendingTest): string {
  if (pt.roll == null) return '';
  if (pt.forced) return `${pt.actorName} ne faillit pas (Résilience) : réussite garantie.`;
  return pt.success ? `${pt.actorName} réussit.` : `${pt.actorName} échoue.`;
}
