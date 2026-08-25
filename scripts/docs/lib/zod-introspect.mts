// INTROSPECTION du côté DÉCLARÉ : les 120 schémas zod du registre `src/data/schemas/_registry.generated.ts`.
// Promue de la sonde `scratchprobe/1463/envelope_1463.mts` (exécutée sans échec sur les 120 defs).
// Consommée par `scripts/docs/build-structures.mts` pour la colonne « déclaré » et le volet
// « forme DÉCLARÉE jamais observée ».
//
// zod 4.4.3 : la forme d'un nœud se lit sur `s._zod.def` (`type`, `shape`, `element`, `options`,
// `innerType`, `getter`, `in`/`out`).
import type { SchemaDef } from '../../../src/data/schemas/types';
import { defDe, enfantsDe, type DefZod } from '../../../src/data/schemas/grammaire/slots';

/**
 * DESCENTE UNIQUE : les enfants d'un nœud, triés par RÔLE selon le SEGMENT de path qu'`enfantsDe`
 * (`grammaire/slots.ts`) leur donne — `.clé` clé d'objet, `[]` élément de liste, `{}` valeur de
 * record, `|N` branche d'union, `[N]` élément de tuple, `''` enveloppe (`innerType`, `in`/`out`,
 * cible d'un `lazy`, dans cet ordre). Aucun champ de `_zod.def` n'est lu à la main ici : une
 * enveloppe que la descente apprendrait à traverser profite à TOUS les relevés de ce module.
 */
function descente(def: DefZod) {
  const enfants = enfantsDe(def);
  return {
    cles: enfants.filter((e) => e.cle !== undefined),
    element: enfants.find((e) => e.segment === '[]')?.noeud,
    valeur: enfants.find((e) => e.segment === '{}')?.noeud,
    branches: enfants.filter((e) => e.segment.startsWith('|')).map((e) => e.noeud),
    tuple: enfants.filter((e) => /^\[\d/.test(e.segment)).map((e) => e.noeud),
    /** Enveloppes dans l'ordre de déclaration : `[innerType]`, `[in, out]`, `[cible du lazy]`. */
    enveloppes: enfants.filter((e) => e.segment === '').map((e) => e.noeud),
  };
}

/** Nom de CLASSE de type d'un nœud zod, borné en profondeur (les unions récursives sont légion). */
function classeZod(s: unknown, profondeur = 0): string {
  if (!s || typeof s !== 'object') return `inconnu(${typeof s})`;
  const def = defDe(s);
  if (!def) return 'sans-def';
  if (profondeur > 6) return `${def.type}(profondeur)`;
  const d = descente(def);
  switch (def.type) {
    case 'literal':
      return `literal ${JSON.stringify(def.values ?? def.value)}`;
    case 'enum':
      return `enum(${Object.values(def.entries ?? {}).length})`;
    case 'array':
      return `array<${classeZod(d.element, profondeur + 1)}>`;
    case 'object':
      return 'object';
    case 'tuple':
      return `tuple(${d.tuple.length})`;
    case 'union':
      return `union<${d.branches.map((o) => classeZod(o, profondeur + 1)).join('|')}>`;
    case 'optional':
    case 'nullable':
    case 'default':
    case 'catch':
      return `${def.type}<${classeZod(d.enveloppes[0], profondeur + 1)}>`;
    case 'lazy':
      // Un `lazy` dont le getter LÈVE ne rend AUCUN enfant (`enfantsDe` absorbe) : la cible est dite
      // inatteignable plutôt que muette — elle se verrait dans le doc.
      return d.enveloppes.length ? `lazy<${classeZod(d.enveloppes[0], profondeur + 1)}>` : 'lazy(inatteignable)';
    case 'pipe':
      return `pipe<${classeZod(d.enveloppes[0], profondeur + 1)}=>${classeZod(d.enveloppes[1], profondeur + 1)}>`;
    default:
      return def.type;
  }
}

/** Clés DÉCLARÉES d'un nœud d'entrée (objet, union de branches, record, lazy). */
function clesDeclarees(s: unknown, profondeur = 0): { cles: Record<string, string>; note: string } {
  const def = defDe(s);
  if (!def) return { cles: {}, note: 'sans-def' };
  if (profondeur > 6) return { cles: {}, note: 'profondeur' };
  const d = descente(def);
  if (def.type === 'object') {
    const cles: Record<string, string> = {};
    for (const e of d.cles) cles[e.cle!] = classeZod(e.noeud);
    return { cles, note: '' };
  }
  if (def.type === 'union') {
    const cles: Record<string, string> = {};
    d.branches.forEach((opt, i) => {
      const sub = clesDeclarees(opt, profondeur + 1);
      for (const [k, v] of Object.entries(sub.cles)) cles[k] = (cles[k] ? `${cles[k]} | ` : '') + `b${i}:${v}`;
    });
    return { cles, note: `union(${d.branches.length} branches)` };
  }
  if (def.type === 'record') {
    const sub = clesDeclarees(d.valeur, profondeur + 1);
    return { cles: sub.cles, note: `record ${sub.note}`.trim() };
  }
  if (def.type === 'lazy') {
    if (!d.enveloppes.length) return { cles: {}, note: 'lazy inatteignable' };
    return clesDeclarees(d.enveloppes[0], profondeur + 1);
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
      const d = def ? descente(def) : undefined;
      let entree: unknown = schema;
      let famille = `autre(${def?.type})`;
      if (def?.type === 'array') {
        entree = d!.element;
        famille = 'liste';
      } else if (def?.type === 'object') {
        famille = 'config (objet unique)';
      } else if (def?.type === 'record') {
        entree = d!.valeur;
        famille = 'record';
      } else if (def?.type === 'union') {
        famille = 'union à la racine';
      } else if (def?.type === 'pipe') {
        // Enveloppes d'un `pipe` : `[in, out]` — l'entrée du doc est la SORTIE (ce qui est rendu).
        entree = d!.enveloppes[d!.enveloppes.length - 1];
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
      const d = descente(def);
      switch (def.type) {
        case 'literal':
          return [def.values, def.value].flatMap((v) => (Array.isArray(v) ? v : [v])).filter((v): v is string => typeof v === 'string');
        case 'enum':
          return Object.values(def.entries ?? {}).filter((v): v is string => typeof v === 'string');
        case 'union':
          return d.branches.flatMap((o) => litteraux(o, profondeur + 1));
        case 'array':
          return litteraux(d.element, profondeur + 1);
        case 'optional':
        case 'nullable':
        case 'default':
        case 'catch':
        case 'lazy':
          return litteraux(d.enveloppes[0], profondeur + 1);
        case 'pipe':
          // `[in, out]` : les littéraux se lisent sur la SORTIE.
          return litteraux(d.enveloppes[d.enveloppes.length - 1], profondeur + 1);
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
