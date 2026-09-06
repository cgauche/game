// INTROSPECTION du côté DÉCLARÉ : les schémas zod des registres des DEUX racines
// (`_registry.generated.ts` + `_registry-scenes.generated.ts`, réunis par `defsDeDocument`).
// Consommée par `scripts/docs/build-structures.mts` pour la colonne « déclaré » et le volet
// « forme DÉCLARÉE jamais observée ».
//
// zod 4.4.3 : la forme d'un nœud se lit sur `s._zod.def` (`type`, `shape`, `element`, `options`,
// `innerType`, `getter`, `in`/`out`).
import type { SchemaDef } from '../../../src/data/schemas/types';
import { defDe, enfantsDe, type DefZod } from '../../../src/data/schemas/grammaire/slots';
import { parUnitesDeCode } from '../../guards/lib/lister.mjs';

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

/**
 * MARCHE MÉMOÏSÉE d'un arbre de schéma : chaque nœud n'est visité qu'UNE fois (mémo par IDENTITÉ),
 * la descente passe par `enfantsDe` SEUL. Bornée en profondeur — un schéma récursif non mémoïsé rend
 * un nœud neuf à chaque `lazy`. C'est la marche des RELEVÉS de ce module (recensement d'un arbre,
 * une visite par nœud) ; la marche des SLOTS (`grammaire/slots.ts`) est l'autre, et n'est PAS
 * mémoïsée à dessein — elle compte une instance partagée par 3 champs comme 3 slots.
 */
export function marcherMemoise(
  schema: unknown,
  visiter: (def: DefZod, noeud: unknown) => void,
  profondeurMax = PROFONDEUR_MEMO,
): void {
  const vus = new Set<unknown>();
  const descendre = (n: unknown, profondeur: number): void => {
    if (!n || typeof n !== 'object' || profondeur > profondeurMax || vus.has(n)) return;
    vus.add(n);
    const def = defDe(n);
    if (!def) return;
    visiter(def, n);
    for (const enfant of enfantsDe(def)) descendre(enfant.noeud, profondeur + 1);
  };
  descendre(schema, 0);
}

/** Borne de la marche mémoïsée de `choixDeclares` (les schémas de scène descendent moins loin ici :
 *  la mémo par identité coupe la récursion avant la borne). */
const PROFONDEUR_MEMO = 12;

/**
 * Borne des relevés NON mémoïsés `classeZod`/`clesDeclarees` (descente par VALEUR, un même nœud se
 * relit sous chaque parent). Atteindre la borne TRONQUE le relevé : la troncature est NOMMÉE
 * (marqueur `MARQUE_TRONCATURE`, remonté par `introspecterDefs.tronquee` et compté dans le doc §2.1)
 * — mesure du 2026-08-26 sur les 125 defs des deux racines : 0 troncature.
 */
const PROFONDEUR_RELEVE = 6;

/** Ce qu'un relevé écrit quand la borne le tronque — le mot que le doc compte. */
export const MARQUE_TRONCATURE = '(profondeur)';

/** Nom de CLASSE de type d'un nœud zod, borné en profondeur (les unions récursives sont légion). */
function classeZod(s: unknown, profondeur = 0): string {
  if (!s || typeof s !== 'object') return `inconnu(${typeof s})`;
  const def = defDe(s);
  if (!def) return 'sans-def';
  if (profondeur > PROFONDEUR_RELEVE) return `${def.type}${MARQUE_TRONCATURE}`;
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
  if (profondeur > PROFONDEUR_RELEVE) return { cles: {}, note: MARQUE_TRONCATURE };
  const d = descente(def);
  if (def.type === 'object') {
    const cles: Record<string, string> = {};
    for (const e of d.cles) cles[e.cle!] = classeZod(e.noeud);
    return { cles, note: '' };
  }
  if (def.type === 'union') {
    const cles: Record<string, string> = {};
    // La note d'une branche REMONTE : sans ça une troncature (`MARQUE_TRONCATURE`) sous une union
    // disparaîtrait avec les clés de sa branche, et la non-silence ne tiendrait plus par ce chemin.
    const notes: string[] = [];
    d.branches.forEach((opt, i) => {
      const sub = clesDeclarees(opt, profondeur + 1);
      for (const [k, v] of Object.entries(sub.cles)) cles[k] = (cles[k] ? `${cles[k]} | ` : '') + `b${i}:${v}`;
      if (sub.note) notes.push(`b${i}:${sub.note}`);
    });
    return { cles, note: [`union(${d.branches.length} branches)`, ...notes].join(' ') };
  }
  if (def.type === 'record') {
    const sub = clesDeclarees(d.valeur, profondeur + 1);
    return { cles: sub.cles, note: `record ${sub.note}`.trim() };
  }
  if (def.type === 'lazy') {
    if (!d.enveloppes.length) return { cles: {}, note: 'lazy inatteignable' };
    return clesDeclarees(d.enveloppes[0], profondeur + 1);
  }
  if (def.type === 'pipe') {
    // SCEAU de `document()` (#1467 L1b) : l'entrée d'un def adopté est un `pipe` dont la SORTIE est un
    // `transform` sans clés. Les clés se lisent sur le nœud PORTEUR — le même critère STRUCTUREL que
    // `introspecterDefs` applique au record enveloppé : le premier des deux bouts qui a des clés.
    // Sans cette descente, tout def adopté rendait ZÉRO clé déclarée, et la comparaison
    // « déclaré × observé » se taisait au lieu de mordre.
    const porteur = d.enveloppes.find((n) => {
      const s = defDe(n);
      return s && descente(s).cles.length > 0;
    });
    if (porteur) return clesDeclarees(porteur, profondeur + 1);
    return { cles: {}, note: 'pipe sans nœud à clés' };
  }
  return { cles: {}, note: `non-objet(${def.type})` };
}

export type DefIntrospectee = {
  file: string;
  racine: string;
  famille: string;
  note: string;
  cles: Record<string, string>;
  /** Le relevé a-t-il été coupé par `PROFONDEUR_RELEVE` ? Compté dans le doc — jamais silencieux. */
  tronquee: boolean;
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
        // L'entrée du doc reste le PIPE lui-même : `clesDeclarees` y applique le critère STRUCTUREL
        // ci-dessous (le bout qui porte des clés), pas le rôle in/out.
        entree = schema;
        famille = 'pipe à la racine';
        // RECORD ENVELOPPÉ (#1467 L1b V-FLIP-RECORD) : la fabrique `document()` SCELLE le document par
        // un `pipe`, mais la CHARGE d'un record reste sa carte clé→valeur sous `entries`. Le critère
        // est STRUCTUREL (la sortie porte un `entries` de type `record`), jamais la déclaration : les
        // entrées du document sont les VALEURS de cette carte, comme pour un record nu.
        // La SORTIE d'un sceau est un `transform` (elle ne porte aucune clé) : la forme du document
        // se lit sur l'ENTRÉE du pipe, seul nœud à clés.
        const porteur = d!.enveloppes.map((n) => defDe(n)).find((s) => s && descente(s).cles.length);
        const carte = porteur ? descente(porteur).cles.find((e) => e.cle === 'entries')?.noeud : undefined;
        const carteDef = carte ? defDe(carte) : undefined;
        if (carteDef?.type === 'record') {
          famille = 'record';
          entree = descente(carteDef).valeur;
        }
      } else if (def?.type === 'tuple') {
        famille = 'tuple';
      }
      const { cles, note } = clesDeclarees(entree);
      const racine = classeZod(schema);
      const tronquee = [racine, note, ...Object.values(cles)].some((t) => t.includes(MARQUE_TRONCATURE));
      return { file, racine, famille, note, cles, tronquee };
    })
    .sort((a, b) => parUnitesDeCode(a.file, b.file));
}

/**
 * LITTÉRAUX D'ENUM déclarés par un schéma, clé par clé, à TOUTE profondeur de son arbre : une clé
 * dont la valeur est l'un de ces littéraux est un DISCRIMINANT (`kind`, `type`, `class`, `op`…),
 * jamais une référence à une entité — même quand la chaîne collisionne avec l'id d'un document.
 * SOURCE consultable, citée verbatim — #1463, commentaire « ## Arbitrages de design L0 (2026-08-23,
 * orchestrateur — suite à la contre-passe du commit 3a6017ebb) », point 3 : « une clé dont la valeur
 * est un littéral d'enum zod (`kind/type/class/op`) n'ouvre jamais une référence ».
 */
export function choixDeclares(defs: readonly SchemaDef[]): Map<string, Map<string, Set<string>>> {
  const out = new Map<string, Map<string, Set<string>>>();
  for (const { file, schema } of defs) {
    const parCle = new Map<string, Set<string>>();
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
    // `enfantsDe` énumère DÉJÀ les clés de `shape` : la descente passe par `marcherMemoise` SEULE.
    marcherMemoise(schema, (def) => {
      for (const [k, v] of Object.entries(def.shape ?? {})) {
        for (const lit of litteraux(v)) {
          if (!parCle.has(k)) parCle.set(k, new Set());
          parCle.get(k)!.add(lit);
        }
      }
    });
    out.set(file, parCle);
  }
  return out;
}
