/**
 * NARRATION d'issue des jets — SOURCE UNIQUE par flux (popin ET journal).
 *
 * Motif unifié : chaque flux expose une fonction PURE `describeX(pending) → string` qui produit LA
 * ligne d'issue du jet. La modale l'affiche (`<JournalLine event={ev(kind, describeX(p), …)}>`) et le
 * store la journalise au même endroit — fini les `outcomeText` recalculés dans chaque modale (et
 * re-recalculés à la validation). Pour le combat, l'équivalent est `result.log`, déjà posé par le
 * moteur ; ces fonctions étendent le même principe aux flux non-combat.
 */
import type { PendingTest, PendingPsych } from './pendings';
import type { PendingEncounterPsych } from './encounterPsychFlow';
import { CIBLE_TYPES, CIBLE_LABEL } from '../engine/psychology';

/** Test de scène (LDB 12) : réussite / échec / réussite garantie par Résilience. Le DR figure déjà
 *  dans le breakdown au-dessus — l'issue reste une phrase courte. */
export function describeTest(pt: PendingTest): string {
  if (pt.roll == null) return '';
  if (pt.forced) return `${pt.actorName} ne faillit pas (Résilience) : réussite garantie.`;
  return pt.success ? `${pt.actorName} réussit.` : `${pt.actorName} échoue.`;
}

/** Psychologie EN COMBAT (LDB 21) : Trait ciblé, Terreur (→ Brisé puis Peur) ou Peur (Test étendu).
 *  `name` = combattant concerné. */
export function describePsych(pp: PendingPsych, name: string): string {
  const r = pp.result;
  if (!r) return '';
  if (CIBLE_TYPES.has(pp.kind)) {
    const cl = CIBLE_LABEL[pp.kind];
    return r.success ? `${name} garde son sang-froid.` : `${name} est en proie à son ${cl?.label.toLowerCase() ?? pp.kind}.`;
  }
  if (pp.kind === 'terreur') {
    return r.success ? `${name} garde son sang-froid.` : `${name} est terrifié : ${r.brise} État(s) Brisé, puis Peur ${pp.indice}.`;
  }
  return r.vaincue ? `${name} surmonte sa peur.` : `${name} reste sous l'emprise de la Peur (${r.calmeDR}/${pp.indice} DR).`;
}

/** Psychologie À LA RENCONTRE, hors combat (couture C) : Trait ciblé social, Terreur ou Peur face à
 *  une source nommée. `name` = héros concerné. */
export function describeEncounterPsych(pe: PendingEncounterPsych, name: string): string {
  const r = pe.result;
  if (!r) return '';
  if (CIBLE_TYPES.has(pe.kind)) {
    const cl = CIBLE_LABEL[pe.kind];
    return r.success ? `${name} maîtrise son ${cl?.label.toLowerCase() ?? pe.kind}.` : `${name} est en proie à son ${cl?.label.toLowerCase() ?? pe.kind}.`;
  }
  if (pe.kind === 'terreur') {
    return r.success ? `${name} garde son sang-froid.` : `${name} est terrifié par ${pe.sourceName} : ${r.brise} État(s) Brisé.`;
  }
  return r.success ? `${name} surmonte sa peur de ${pe.sourceName}.` : `${name} a peur de ${pe.sourceName}.`;
}
