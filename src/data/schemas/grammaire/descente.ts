/**
 * DESCENTE d'un schéma zod 4.4.3 composé — la seule lecture de la forme d'un nœud (`defDe`), de ses
 * enfants (`enfantsDe`) et du parcours de son arbre (`descendre`). Consommateurs : `validate.ts`
 * (`noeudObjet`), `scripts/docs/lib/zod-introspect.mts`, `scripts/docs/build-structures.mts`, et les
 * gardes qui relèvent des nœuds (`grammaire-guard.test.ts`, `records-de-libelles.test.ts`,
 * `valeurs-de-champ.test.ts`, `parse-de-mesure.test.ts`).
 *
 * Invariant (#1473 R1) : `enfantsDe` rend chaque enfant que le parse EXÉCUTE, et un `z.lazy` y descend
 * par l'instance que le parse exécute (`_zod.innerType`, `node_modules/zod/v4/core/schemas.js:2194-2206`).
 */

/** Forme d'un nœud zod 4.4.3 telle qu'elle se lit sur `_zod.def`. */
export type DefZod = {
  type: string;
  shape?: Record<string, unknown>;
  catchall?: unknown;
  element?: unknown;
  options?: unknown[];
  innerType?: unknown;
  in?: unknown;
  out?: unknown;
  left?: unknown;
  right?: unknown;
  values?: unknown;
  value?: unknown;
  entries?: Record<string, unknown>;
  items?: unknown[];
  rest?: unknown;
  keyType?: unknown;
  valueType?: unknown;
};

type Noeud = { _zod?: { def?: DefZod; innerType?: unknown }; def?: DefZod };

/** Définition zod d'un nœud, ou `undefined` si ce n'en est pas un. */
export const defDe = (s: unknown): DefZod | undefined => (s as Noeud | null)?._zod?.def ?? (s as Noeud | null)?.def;

/** Un enfant d'un nœud, avec le SEGMENT de path qu'il ajoute (`''` pour une enveloppe transparente). */
export interface EnfantZod {
  readonly noeud: unknown;
  /** Clé d'objet quand l'enfant en est une (le doc en tire les clés déclarées). */
  readonly cle?: string;
  readonly segment: string;
}

/** L'instance qu'exécute le parse d'un `z.lazy`, `undefined` si son getter lève. */
function cibleDuLazy(noeud: unknown): unknown {
  try {
    return (noeud as Noeud)._zod?.innerType;
  } catch {
    return undefined;
  }
}

/**
 * Enfants d'un nœud, dans l'ORDRE de descente : clés d'objet, clés hors `shape` d'un objet (`catchall`),
 * élément de liste, enveloppes (`innerType`/`in`/`out`), clé et valeur de record, branches d'union,
 * côtés d'intersection, éléments et reste de tuple, cible d'un `lazy`.
 * Syntaxe des segments : `.clé` clé d'objet, `.*` clé hors `shape`, `[]` élément de liste, `{clé}` clé
 * de record, `{}` valeur de record, `|N` branche d'union, `&0`/`&1` côté gauche/droit d'intersection,
 * `[N]` élément de tuple, `[...]` reste de tuple, `''` enveloppe et cible d'un `lazy`.
 */
export function enfantsDe(noeud: unknown): EnfantZod[] {
  const def = defDe(noeud);
  if (!def) return [];
  const enfants: EnfantZod[] = [];
  for (const [cle, n] of Object.entries(def.shape ?? {})) enfants.push({ noeud: n, cle, segment: '.' + cle });
  if (def.catchall !== undefined) enfants.push({ noeud: def.catchall, segment: '.*' });
  if (def.element !== undefined) enfants.push({ noeud: def.element, segment: '[]' });
  if (def.innerType !== undefined) enfants.push({ noeud: def.innerType, segment: '' });
  if (def.keyType !== undefined) enfants.push({ noeud: def.keyType, segment: '{clé}' });
  if (def.valueType !== undefined) enfants.push({ noeud: def.valueType, segment: '{}' });
  if (def.value !== undefined) enfants.push({ noeud: def.value, segment: '{}' });
  if (def.in !== undefined) enfants.push({ noeud: def.in, segment: '' });
  if (def.out !== undefined) enfants.push({ noeud: def.out, segment: '' });
  (def.options ?? []).forEach((n, i) => enfants.push({ noeud: n, segment: '|' + i }));
  if (def.left !== undefined) enfants.push({ noeud: def.left, segment: '&0' });
  if (def.right !== undefined) enfants.push({ noeud: def.right, segment: '&1' });
  (def.items ?? []).forEach((n, i) => enfants.push({ noeud: n, segment: '[' + i + ']' }));
  if (def.rest !== undefined && def.rest !== null) enfants.push({ noeud: def.rest, segment: '[...]' });
  if (def.type === 'lazy') {
    const cible = cibleDuLazy(noeud);
    if (cible !== undefined) enfants.push({ noeud: cible, segment: '' });
  }
  return enfants;
}

/** Ce que la descente présente à chaque nœud visité. */
export interface Visite {
  readonly noeud: object;
  readonly def: DefZod;
  /** Path de SCHÉMA depuis la racine : la suite des segments d'`enfantsDe` (`.a[]{}`), `''` à la racine. */
  readonly path: string;
  readonly profondeur: number;
  /** Rang de la racine d'où part le chemin. */
  readonly racine: number;
}

/** `elaguer` : ne pas descendre sous ce nœud ; `arreter` : finir la descente. */
export type SuiteDeVisite = void | 'elaguer' | 'arreter';

type Pas = { readonly noeud: unknown; readonly path: string; readonly profondeur: number; readonly racine: number };

/**
 * Descente LARGEUR D'ABORD de schémas racines, par `enfantsDe`. Chaque nœud zod est visité UNE fois
 * par appel (identité), sous le premier chemin qui l'atteint, donc le plus court : un cycle (`z.lazy`)
 * s'arrête sur lui-même, sans borne de profondeur.
 */
export function descendre(racines: readonly unknown[], visite: (v: Visite) => SuiteDeVisite): void {
  const vus = new Set<unknown>();
  const file: Pas[] = racines.map((noeud, racine) => ({ noeud, path: '', profondeur: 0, racine }));
  for (let i = 0; i < file.length; i++) {
    const pas = file[i];
    const { noeud } = pas;
    if (!noeud || typeof noeud !== 'object' || vus.has(noeud)) continue;
    const def = defDe(noeud);
    if (!def) continue;
    vus.add(noeud);
    const suite = visite({ noeud, def, path: pas.path, profondeur: pas.profondeur, racine: pas.racine });
    if (suite === 'arreter') return;
    if (suite === 'elaguer') continue;
    for (const e of enfantsDe(noeud)) file.push({ noeud: e.noeud, path: pas.path + e.segment, profondeur: pas.profondeur + 1, racine: pas.racine });
  }
}
