// INTROSPECTION du côté DÉCLARÉ : les 120 schémas zod du registre `src/data/schemas/_registry.generated.ts`.
// Promue de la sonde `scratchprobe/1463/envelope_1463.mts` (exécutée sans échec sur les 120 defs).
// Consommée par `scripts/docs/build-structures.mts` pour la colonne « déclaré » et le volet
// « forme DÉCLARÉE jamais observée ».
//
// zod 4.4.3 : la forme d'un nœud se lit sur `s._zod.def` (`type`, `shape`, `element`, `options`,
// `innerType`, `getter`, `in`/`out`).
import type { SchemaDef } from '../../../src/data/schemas/types';
import { defDe, enfantsDe } from '../../../src/data/schemas/grammaire/slots';

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

/**
 * LITTÉRAUX D'ENUM déclarés par un schéma, clé par clé, à TOUTE profondeur de son arbre : une clé
 * dont la valeur est l'un de ces littéraux est un DISCRIMINANT (`kind`, `type`, `class`, `op`…),
 * jamais une référence à une entité — même quand la chaîne collisionne avec l'id d'un document
 * (#1463, arbitrage de design L0 du 2026-08-23, point 3).
 */
export function choixDeclares(defs: readonly SchemaDef[]): Map<string, Map<string, Set<string>>> {
  const out = new Map<string, Map<string, Set<string>>>();
  for (const { file, schema } of defs) {
    const parCle = new Map<string, Set<string>>();
    const vus = new Set<unknown>();
    /** Littéraux de chaîne portés par le nœud (littéral, enum, ou union/enveloppe qui en contient). */
    const litteraux = (n: unknown, profondeur = 0): string[] => {
      const def = defDe(n);
      if (!def || profondeur > 8) return [];
      switch (def.type) {
        case 'literal':
          return [def.values, def.value].flatMap((v) => (Array.isArray(v) ? v : [v])).filter((v): v is string => typeof v === 'string');
        case 'enum':
          return Object.values(def.entries ?? {}).filter((v): v is string => typeof v === 'string');
        case 'union':
          return (def.options ?? []).flatMap((o) => litteraux(o, profondeur + 1));
        case 'array':
          return litteraux(def.element, profondeur + 1);
        case 'optional':
        case 'nullable':
        case 'default':
        case 'catch':
          return litteraux(def.innerType, profondeur + 1);
        case 'lazy':
          try {
            return litteraux(def.getter?.(), profondeur + 1);
          } catch {
            return [];
          }
        case 'pipe':
          return litteraux(def.out ?? def.in, profondeur + 1);
        default:
          return [];
      }
    };
    const marche = (n: unknown, profondeur = 0): void => {
      if (!n || typeof n !== 'object' || profondeur > 12 || vus.has(n)) return;
      vus.add(n);
      const def = defDe(n);
      if (!def) return;
      for (const [k, v] of Object.entries(def.shape ?? {})) {
        for (const lit of litteraux(v)) {
          if (!parCle.has(k)) parCle.set(k, new Set());
          parCle.get(k)!.add(lit);
        }
      }
      // `enfantsDe` énumère DÉJÀ les clés de `shape` : la descente passe par lui SEUL.
      for (const enfant of enfantsDe(def)) marche(enfant.noeud, profondeur + 1);
    };
    marche(schema);
    out.set(file, parCle);
  }
  return out;
}
