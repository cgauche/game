/**
 * Affichage FR de la portée/cible d'un sort — DÉRIVÉ de la structure (`SpellRange`/`SpellTarget`),
 * SOURCE UNIQUE de la prose qui vivait jadis figée dans `spells.json`. Régénérer le texte ici (au lieu
 * de le stocker) rend l'i18n possible : changer `CHAR_LABELS` ou ces gabarits propage partout. Le
 * `parseSpellRange/Target` (spellRange.ts) en est l'inverse exact (round-trip pour les valeurs parsables).
 */
import type { Formula } from './ops';
import { CHAR_LABELS } from './types';
import type { SpellRange, SpellTarget } from './spellRange';
import type { SpellDuration } from './spellDuration';

/** Mesure → prose : `6` → « 6 », `{charOf}` → « (Force Mentale) », `{bonusOf}` → « (Bonus de Force Mentale) ». */
function fmtMeasure(f: Formula): string {
  if (typeof f === 'number') return String(f);
  if ('bonusOf' in f) return `(Bonus de ${CHAR_LABELS[f.bonusOf]})`;
  if ('charOf' in f) return `(${CHAR_LABELS[f.charOf]})`;
  return '?'; // dés/rolled/indiceOf n'apparaissent pas en portée/cible
}

/** « mètre(s) » / « kilomètre(s) » selon le pluriel (littéral 1 = singulier). */
function unitWord(f: Formula, unit: 'm' | 'km'): string {
  const sing = f === 1;
  return unit === 'km' ? (sing ? 'kilomètre' : 'kilomètres') : (sing ? 'mètre' : 'mètres');
}

export function formatSpellRange(r: SpellRange): string {
  switch (r.kind) {
    case 'self': return 'Vous';
    case 'touch': return 'Contact';
    case 'distance': return `${fmtMeasure(r.value)} ${unitWord(r.value, r.unit)}`;
    case 'special': return r.text;
  }
}

export function formatSpellTarget(t: SpellTarget): string {
  switch (t.kind) {
    case 'self': return 'Vous';
    case 'count': return typeof t.n === 'number'
      ? (t.n === 1 ? '1 cible' : `${t.n} cibles`)
      : `${fmtMeasure(t.n)} cibles`;
    case 'area': return `ZdE ${t.span === 'radius' ? 'rayon' : 'diamètre'} ${fmtMeasure(t.meters)} mètres`;
    case 'cone': return `Cône Longueur (${fmtMeasure(t.lengthMeters)} mètres) x Largeur (${fmtMeasure(t.widthMeters)} mètres)`;
    case 'special': return t.text;
  }
}

const CLOCK_UNIT: Record<'minutes' | 'hours' | 'days', [string, string]> = {
  minutes: ['minute', 'minutes'], hours: ['heure', 'heures'], days: ['jour', 'jours'],
};

export function formatSpellDuration(d: SpellDuration): string {
  switch (d.kind) {
    case 'instant': return 'Instantané';
    case 'rounds': return `${fmtMeasure(d.value)} ${d.value === 1 ? 'Round' : 'Rounds'}`;
    case 'clock': { const [sg, pl] = CLOCK_UNIT[d.unit]; return `${fmtMeasure(d.value)} ${d.value === 1 ? sg : pl}`; }
    case 'untilDawn': return 'Jusqu\'au lever du soleil';
    case 'special': return d.text;
  }
}
