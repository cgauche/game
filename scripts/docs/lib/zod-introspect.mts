// INTROSPECTION du côté DÉCLARÉ : les 120 schémas zod du registre `src/data/schemas/_registry.generated.ts`.
// Promue de la sonde `scratchprobe/1463/envelope_1463.mts` (exécutée sans échec sur les 120 defs).
// Consommée par `scripts/docs/build-structures.mts` pour la colonne « déclaré » et le volet
// « forme DÉCLARÉE jamais observée ».
//
// zod 4.4.3 : la forme d'un nœud se lit sur `s._zod.def` (`type`, `shape`, `element`, `options`,
// `innerType`, `getter`, `in`/`out`).
import type { SchemaDef } from '../../../src/data/schemas/types';

type Noeud = { _zod?: { def?: DefZod }; def?: DefZod };
type DefZod = {
  type: string;
  shape?: Record<string, unknown>;
  element?: unknown;
  options?: unknown[];
  innerType?: unknown;
  getter?: () => unknown;
  in?: unknown;
  out?: unknown;
  values?: unknown;
  value?: unknown;
  entries?: Record<string, unknown>;
  items?: unknown[];
  valueType?: unknown;
};

const defDe = (s: unknown): DefZod | undefined => (s as Noeud | null)?._zod?.def ?? (s as Noeud | null)?.def;

/** Nom de CLASSE de type d'un nœud zod, borné en profondeur (les unions récursives sont légion). */
function classeZod(s: unknown, profondeur = 0): string {
  if (!s || typeof s !== 'object') return `inconnu(${typeof s})`;
  const def = defDe(s);
  if (!def) return 'sans-def';
  if (profondeur > 6) return `${def.type}(profondeur)`;
  switch (def.type) {
    case 'literal':
      return `literal ${JSON.stringify(def.values ?? def.value)}`;
    case 'enum':
      return `enum(${Object.values(def.entries ?? {}).length})`;
    case 'array':
      return `array<${classeZod(def.element, profondeur + 1)}>`;
    case 'object':
      return 'object';
    case 'tuple':
      return `tuple(${(def.items ?? []).length})`;
    case 'union':
      return `union<${(def.options ?? []).map((o) => classeZod(o, profondeur + 1)).join('|')}>`;
    case 'optional':
    case 'nullable':
    case 'default':
    case 'catch':
      return `${def.type}<${classeZod(def.innerType, profondeur + 1)}>`;
    case 'lazy':
      try {
        return `lazy<${classeZod(def.getter?.(), profondeur + 1)}>`;
      } catch (e) {
        return `lazy(erreur ${(e as Error)?.message})`;
      }
    case 'pipe':
      return `pipe<${classeZod(def.in, profondeur + 1)}=>${classeZod(def.out, profondeur + 1)}>`;
    default:
      return def.type;
  }
}

/** Clés DÉCLARÉES d'un nœud d'entrée (objet, union de branches, record, lazy). */
function clesDeclarees(s: unknown, profondeur = 0): { cles: Record<string, string>; note: string } {
  const def = defDe(s);
  if (!def) return { cles: {}, note: 'sans-def' };
  if (profondeur > 6) return { cles: {}, note: 'profondeur' };
  if (def.type === 'object') {
    const shape = def.shape ?? {};
    const cles: Record<string, string> = {};
    for (const k of Object.keys(shape)) cles[k] = classeZod(shape[k]);
    return { cles, note: '' };
  }
  if (def.type === 'union') {
    const cles: Record<string, string> = {};
    (def.options ?? []).forEach((opt, i) => {
      const sub = clesDeclarees(opt, profondeur + 1);
      for (const [k, v] of Object.entries(sub.cles)) cles[k] = (cles[k] ? `${cles[k]} | ` : '') + `b${i}:${v}`;
    });
    return { cles, note: `union(${(def.options ?? []).length} branches)` };
  }
  if (def.type === 'record') {
    const sub = clesDeclarees(def.valueType ?? def.value, profondeur + 1);
    return { cles: sub.cles, note: `record ${sub.note}`.trim() };
  }
  if (def.type === 'lazy') {
    try {
      return clesDeclarees(def.getter?.(), profondeur + 1);
    } catch (e) {
      return { cles: {}, note: `lazy erreur ${(e as Error)?.message}` };
    }
  }
  return { cles: {}, note: `non-objet(${def.type})` };
}

export type DefIntrospectee = {
  file: string;
  racine: string;
  famille: string;
  note: string;
  cles: Record<string, string>;
};

/** Introspection des defs du registre : racine déclarée + clés déclarées d'une entrée. */
export function introspecterDefs(defs: readonly SchemaDef[]): DefIntrospectee[] {
  return defs
    .map(({ file, schema }) => {
      const def = defDe(schema);
      let entree: unknown = schema;
      let famille = `autre(${def?.type})`;
      if (def?.type === 'array') {
        entree = def.element;
        famille = 'liste';
      } else if (def?.type === 'object') {
        famille = 'config (objet unique)';
      } else if (def?.type === 'record') {
        entree = def.valueType ?? def.value;
        famille = 'record';
      } else if (def?.type === 'union') {
        famille = 'union à la racine';
      } else if (def?.type === 'pipe') {
        entree = def.out ?? def.in;
        famille = 'pipe à la racine';
      } else if (def?.type === 'tuple') {
        famille = 'tuple';
      }
      const { cles, note } = clesDeclarees(entree);
      return { file, racine: classeZod(schema), famille, note, cles };
    })
    .sort((a, b) => a.file.localeCompare(b.file));
}
