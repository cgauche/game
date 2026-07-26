/**
 * Durée d'un sort — donnée STRUCTURÉE (LDB 47). Remplace la prose `duration` (« (Bonus de FM) Rounds »,
 * « 1 heure », « Instantané »…) : plus aucune re-lecture de prose au RUNTIME. L'interprétation des
 * mots français n'a lieu qu'à l'AUTHORING/migration ;
 * le moteur lit la structure, l'affichage est DÉRIVÉ (`spellRangeFormat.formatSpellDuration`).
 *
 * Replie l'ancien champ structuré `durationRounds: Formula` (échelle tactique) — source UNIQUE désormais.
 * La MESURE réutilise `Formula` (engine/ops) via `parseFormulaMeasure` (`spellRange.ts`).
 */
import type { Formula } from './ops';
import { parseFormulaMeasure } from './spellRange';

export type SpellDuration =
  | { kind: 'instant' } // « Instantané »
  | { kind: 'rounds'; value: Formula; plus?: true } // « (Bonus de FM) Rounds », « 6 rounds » (échelle tactique) ; LDB 47 l.311
  | { kind: 'clock'; value: Formula; unit: 'minutes' | 'hours' | 'days' } // « 1 heure », « (FM) minutes »
  | { kind: 'untilDawn' } // « Jusqu'au (prochain) lever du soleil »
  | { kind: 'special'; text: string; plus?: true }; // « Spécial », « Variable », « 8 Tours » (non chiffrable), homebrew ; LDB 47 l.311

/** Normalise la prose de durée : NFC, espaces réduits, « + » de fin, « Instantanée » → « Instantané ».
 *  NE replie PAS « Tours » sur « Rounds » (comportement préservé : « 8 Tours » n'est pas chiffrable). */
function normalize(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/instantanée/gi, 'Instantané')
    .replace(/\s+/g, ' ')
    .replace(/\s*\+\s*$/, '')
    .trim();
}

/** Détecte le marqueur « + » de fin de Durée (LDB 47 l.311 : Test de FM pour +1 Round) —
 *  distinct du « + » arithmétique interne (ex. « DR Test + 4 Tours », poudre-d-escampette). */
function hasPlusMarker(raw: string): boolean {
  return /\+\s*$/.test(raw.normalize('NFC').trim());
}

/** Prose de durée → `SpellDuration` structuré (authoring/migration uniquement). */
export function parseSpellDuration(raw: string): SpellDuration {
  const s = normalize(raw);
  const plus = hasPlusMarker(raw);
  if (/^instantané/i.test(s)) return { kind: 'instant' };
  if (/jusqu.au\s+(prochain\s+)?lever\s+d[eu]\s*soleil/i.test(s)) return { kind: 'untilDawn' };
  if (/rounds?\b/i.test(s)) {
    const v = parseFormulaMeasure(s);
    if (v != null) return plus ? { kind: 'rounds', value: v, plus: true } : { kind: 'rounds', value: v };
  }
  const unit = /minutes?\b/i.test(s) ? 'minutes' : /heures?\b/i.test(s) ? 'hours' : /jours?\b/i.test(s) ? 'days' : null;
  if (unit) {
    const v = parseFormulaMeasure(s);
    if (v != null) return { kind: 'clock', value: v, unit };
  }
  return plus ? { kind: 'special', text: raw, plus: true } : { kind: 'special', text: raw };
}
