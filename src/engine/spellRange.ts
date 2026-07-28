/**
 * Portée et Cible d'un sort — données STRUCTURÉES (LDB 46/47). Remplacent la prose qui était re-parsée
 * au RUNTIME par `magic.ts` (« (Force Mentale) mètres », « ZdE (Bonus de FM) mètres »…) : l'interprétation
 * des mots français n'a plus lieu qu'à l'AUTHORING/migration (cf. `statEntry.ts` — « plus jamais de
 * parsing de chaîne au runtime »), jamais au runtime ni à l'affichage (dérivé par `spellRangeFormat.ts`).
 *
 * La MESURE réutilise `Formula` (engine/ops) : littéral `number`, « (X) » → `{charOf}`, « (Bonus de X) »
 * → `{bonusOf}`. `parseSpellRange`/`parseSpellTarget` ne servent QU'à la migration et à l'éditeur
 * (saisie en prose → structure) ; le moteur lit la structure directement.
 */
import type { Formula } from './ops';
import type { Condition } from './flowCore';
import { charKeyByLabel } from '../data/index';

/** Portée d'un sort — d'OÙ il peut être lancé. */
export type SpellRange =
  | { kind: 'self' } // « Vous »
  | { kind: 'touch' } // « Contact » / « Toucher »
  | { kind: 'distance'; value: Formula; unit: 'm' | 'km' } // « 6 mètres », « (Force Mentale) mètres », « (Bonus de FM) mètres »
  | { kind: 'special'; text: string }; // « Spécial »/« Voir texte »/valeur non chiffrable (homebrew)

/** Cible d'un sort — QUI/QUOI il affecte.
 *
 *  `affects` (formes de ZONE) : `Condition` évaluée PAR CANDIDAT à l'énumération de la zone
 *  (`target` = le candidat, `caster` = le lanceur) — le candidat n'entre en zone que si elle est
 *  vraie. Champ ABSENT = LDB 47 l.28. Vocabulaire partagé `Condition` (`flowCore.ts`), aucune
 *  énumération de camp propre au sort.
 *
 *  `maison` : valeur maison ÉDITABLE portant sa justification, quand le RAW laisse un point ouvert
 *  — CLAUDE.md règle 7. */
export type SpellTarget =
  | { kind: 'self' } // « Vous »
  | { kind: 'count'; n: Formula } // 1, « (Bonus d'Intelligence) alliés »
  | { kind: 'area'; span: 'radius' | 'diameter'; meters: Formula; excludesCaster?: boolean; affects?: Condition; maison?: string } // toute forme de ZONE
  | { kind: 'cone'; lengthMeters: Formula; widthMeters: Formula; affects?: Condition; maison?: string } // « Cône Longueur (8 m) x Largeur (2 m) »
  | { kind: 'special'; text: string }; // « Spécial », « 1 voilier… », « ZdE (un lieu unique) », homebrew

/** Normalise une chaîne de prose : NFC, espaces réduits, fautes OCR connues (« Diam ètre », « mètre s »,
 *  « Spéci al »), casse de l'unité. Déterministe — la migration s'appuie dessus. */
function normalize(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/Diam\s*ètre/gi, 'Diamètre')
    .replace(/mètre\s+s\b/gi, 'mètres')
    .replace(/Spéci\s*al/gi, 'Spécial')
    .replace(/\s+/g, ' ')
    .replace(/\s*\+\s*$/, '')
    .trim();
}

/** Caractéristique depuis un libellé FR complet (« Force Mentale » → 'FM'), ou undefined — couture
 *  label→id (`charKeyByLabel`, src/data/index.ts), pas de carte locale au moteur. */
function charKey(label: string) {
  return charKeyByLabel(label.trim());
}

/** Mesure (Formula) depuis une chaîne : « (Bonus de X) » → {bonusOf}, « (X) » (carac) → {charOf},
 *  « N » → number. Renvoie null si non reconnu. PARTAGÉ (portée, cible, durée — `spellDuration.ts`). */
export function parseFormulaMeasure(s: string): Formula | null {
  const bonus = s.match(/Bonus d[e'’]\s*([^)]+?)\s*\)/i);
  if (bonus) {
    const k = charKey(bonus[1]);
    if (k) return { bonusOf: k };
  }
  const full = s.match(/\(\s*([^)]+?)\s*\)/);
  if (full) {
    const k = charKey(full[1]);
    if (k) return { charOf: k };
  }
  const lit = s.match(/(\d+)/);
  if (lit) return parseInt(lit[1], 10);
  return null;
}

/** Prose de portée → `SpellRange` structuré (authoring/migration uniquement). */
export function parseSpellRange(raw: string): SpellRange {
  const s = normalize(raw);
  if (/^vous$/i.test(s)) return { kind: 'self' };
  if (/^(contact|toucher)$/i.test(s)) return { kind: 'touch' };
  const km = /kilom[èe]tres?/i.test(s);
  const m = /(?<!kilo)m[èe]tres?/i.test(s);
  if (km || m) {
    const measure = parseFormulaMeasure(s);
    if (measure != null) return { kind: 'distance', value: measure, unit: km ? 'km' : 'm' };
  }
  return { kind: 'special', text: raw };
}

/** Prose/numéro de cible → `SpellTarget` structuré (authoring/migration uniquement). */
export function parseSpellTarget(raw: number | string): SpellTarget {
  if (typeof raw === 'number') return { kind: 'count', n: raw };
  const s = normalize(raw);
  if (/^\d+$/.test(s)) return { kind: 'count', n: parseInt(s, 10) };
  const cibles = s.match(/^(\d+)\s*cibles?$/i); // forme régénérée « N cible(s) »
  if (cibles) return { kind: 'count', n: parseInt(cibles[1], 10) };
  if (/^vous$/i.test(s)) return { kind: 'self' };
  // Cône : « Cône Longueur (8 Mètres) x Largeur (2 Mètres) ».
  const cone = s.match(/c[ôo]ne.*longueur\s*\(?([^)x]+?)\)?\s*x\s*largeur\s*\(?([^)]+?)\)?$/i);
  if (cone) {
    const l = parseFormulaMeasure(`(${cone[1]})`) ?? parseFormulaMeasure(cone[1]);
    const w = parseFormulaMeasure(`(${cone[2]})`) ?? parseFormulaMeasure(cone[2]);
    if (l != null && w != null) return { kind: 'cone', lengthMeters: l, widthMeters: w };
  }
  // Zone : « Zone Diamètre N mètres », « ZdE (Bonus de X) mètres », « (Bonus de X) mètres ». Les cibles
  // spéciales (« lieu unique », « Spécial », « voilier », ciblage allié-only non modélisé…) ne sont PAS
  // chiffrables → escape hatch (prose verbatim préservée, mécanique nulle = comportement actuel).
  const isZone = /\b(zde|zone)\b/i.test(s) || /m[èe]tres?\s*$/i.test(s);
  if (isZone && !/sp[ée]cial|lieu unique|voilier|alli[ée]s?/i.test(s)) {
    const measure = parseFormulaMeasure(s);
    // La prose « Zone Diamètre N » / « ZdE (X) mètres » exprime un DIAMÈTRE (LDB 47) ; « rayon » un rayon
    // (forme régénérée des sorts à `zdeRadiusMeters`). Le défaut est le diamètre (toute la prose d'origine).
    if (measure != null) return { kind: 'area', span: /rayon/i.test(s) ? 'radius' : 'diameter', meters: measure };
  }
  return { kind: 'special', text: raw };
}
