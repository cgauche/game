/**
 * Seam i18n (cf. docs/i18n-seam.md) — PUR (aucun React/DOM) → importable par le moteur sans casser sa
 * pureté (peer module, comme src/data). `t(key, params)` résout depuis le catalogue de la locale courante
 * (FR par défaut, figée au lancement en v1) ; `MsgKey` est dérivé du catalogue FR → une clé absente est
 * une ERREUR DE COMPILATION. La 2ᵉ langue = un catalogue frère ajouté à `CATALOGS`.
 */
import { fr } from './messages/fr';

export type MsgKey = keyof typeof fr;
type Params = Record<string, string | number>;

/** Sous-ensemble `out.*` du catalogue — clés de CONSÉQUENCE (`resultLine`, `rollSeam.ts`, #295 Lot 0).
 *  `OutVars` reste un `Record` non typé PAR clé (comme `Params` ci-dessus, `t()` n'a pas de typage
 *  par clé) ; le paramètre générique est gardé pour matcher la signature du plan de conception
 *  (docs/plans/2026-07-10-conception-composeur-affichage-jets.md Décision 1b), extensible sans
 *  casser l'appelant si `t()` se type un jour par clé. */
export type OutKey = Extract<MsgKey, `out.${string}`>;
export type OutVars<_K extends OutKey = OutKey> = Params;

const CATALOGS = { fr } as const;
export type Locale = keyof typeof CATALOGS;

let locale: Locale = 'fr';
export const getLocale = (): Locale => locale;
export const setLocale = (l: Locale): void => { locale = l; };

/** Interpole `{param}` dans un patron ; laisse `{x}` intact si `x` est absent. Pur (testable seul). */
export function interpolate(pattern: string, params?: Params): string {
  return params ? pattern.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] != null ? String(params[k]) : `{${k}}`)) : pattern;
}

/** Texte de la clé dans la locale courante (repli FR puis clé), paramètres interpolés. */
export function t(key: MsgKey, params?: Params): string {
  const pat: string = CATALOGS[locale][key] ?? CATALOGS.fr[key] ?? key;
  return interpolate(pat, params);
}
