/**
 * REGISTRE DES SLOTS (#1466 L1a) — où vivent les références déclarées, lu PAR MARCHE du schéma
 * composé plutôt que poussé à la construction : un slot par référence RÉELLE, à son path exact.
 *
 * La marque est posée sur la FEUILLE porteuse de la référence (`idDe`, `actorRefSchema`), jamais sur
 * l'enveloppe qui la contient : une enveloppe marquée disparaît du WeakMap dès qu'un `.refine`
 * EXTERNE la clone (zod 4.4.3 clone à chaque check ajouté), et la marche rendrait zéro sans erreur.
 *
 * La DESCENTE (`defDe`, `enfantsDe`) est la machinerie de `scripts/docs/lib/zod-introspect.mts` :
 * une seule définition, deux consommateurs (le doc `structures-donnees.md` et ce registre).
 */
import type { RacineDocument } from '../types';

/** Forme d'un nœud zod 4.4.3 telle qu'elle se lit sur `_zod.def`. */
export type DefZod = {
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

type Noeud = { _zod?: { def?: DefZod }; def?: DefZod };

/** Définition zod d'un nœud, ou `undefined` si ce n'en est pas un. */
export const defDe = (s: unknown): DefZod | undefined => (s as Noeud | null)?._zod?.def ?? (s as Noeud | null)?.def;

/** Un enfant d'un nœud, avec le SEGMENT de path qu'il ajoute (`''` pour une enveloppe transparente). */
export interface EnfantZod {
  readonly noeud: unknown;
  /** Clé d'objet quand l'enfant en est une (le doc en tire les clés déclarées). */
  readonly cle?: string;
  readonly segment: string;
}

/**
 * Enfants d'un nœud, dans l'ORDRE de descente : clés d'objet, puis élément de liste, enveloppes
 * (`innerType`/`in`/`out`), valeur de record, branches d'union, éléments de tuple, cible d'un `lazy`.
 * Syntaxe des segments : `.clé`, `[]` liste, `{}` record, `|N` branche d'union, `[N]` tuple. Le point
 * d'une clé est un SÉPARATEUR : il tombe quand la clé ouvre le path (`joindrePath`).
 */
export function enfantsDe(def: DefZod): EnfantZod[] {
  const enfants: EnfantZod[] = [];
  for (const [cle, noeud] of Object.entries(def.shape ?? {})) enfants.push({ noeud, cle, segment: '.' + cle });
  if (def.element !== undefined) enfants.push({ noeud: def.element, segment: '[]' });
  if (def.innerType !== undefined) enfants.push({ noeud: def.innerType, segment: '' });
  if (def.valueType !== undefined) enfants.push({ noeud: def.valueType, segment: '{}' });
  if (def.value !== undefined) enfants.push({ noeud: def.value, segment: '{}' });
  if (def.in !== undefined) enfants.push({ noeud: def.in, segment: '' });
  if (def.out !== undefined) enfants.push({ noeud: def.out, segment: '' });
  (def.options ?? []).forEach((noeud, i) => enfants.push({ noeud, segment: '|' + i }));
  (def.items ?? []).forEach((noeud, i) => enfants.push({ noeud, segment: '[' + i + ']' }));
  if (def.type === 'lazy') {
    try {
      enfants.push({ noeud: def.getter?.(), segment: '' });
    } catch {
      return enfants;
    }
  }
  return enfants;
}

/** Ce que le slot DÉSIGNE : l'id d'une entité de son dataset cible, ou l'acteur d'une mécanique. */
export type EspeceDeSlot = 'id' | 'acteur';

/** Marque posée par une fabrique sur la feuille qu'elle construit. */
export interface MarqueDeSlot {
  readonly espece: EspeceDeSlot;
  /** Type d'entité visé (`TypeEntite`), pour l'espèce `id`. */
  readonly type?: string;
  /** Fabrique qui a posé la marque — ce que le compteur NOMME quand une marque se perd. */
  readonly site: string;
}

/** Un slot RETROUVÉ par la marche d'un schéma de document. */
export interface Slot {
  readonly root: RacineDocument;
  readonly dataset: string;
  /** Chemin du slot dans le document (`[].id`, `t.id`, `|0.of[].id`, `{}.id`). */
  readonly path: string;
  readonly type?: string;
  readonly espece: EspeceDeSlot;
  readonly cardinalite: 'un' | 'liste';
}

const MARQUES = new WeakMap<object, MarqueDeSlot>();
const POSÉES: { readonly noeud: object; readonly marque: MarqueDeSlot }[] = [];

/** Pose la marque sur la feuille et la rend telle quelle (les fabriques composent dessus). */
export function marque<S>(noeud: S, m: MarqueDeSlot): S {
  MARQUES.set(noeud as object, m);
  POSÉES.push({ noeud: noeud as object, marque: m });
  return noeud;
}

/** Marque portée par un nœud, `undefined` sinon. */
export const marqueDe = (noeud: unknown): MarqueDeSlot | undefined =>
  noeud && typeof noeud === 'object' ? MARQUES.get(noeud as object) : undefined;

/** Recensement des marques POSÉES depuis le chargement — la référence du compteur anti-perte. */
export function marquesPosées(): readonly { readonly noeud: object; readonly marque: MarqueDeSlot }[] {
  return POSÉES;
}

/**
 * Un schéma récursif non mémoïsé rend un nouveau nœud à chaque `lazy` : la descente est bornée.
 * La borne est BRUYANTE — atteindre la coupe LÈVE en nommant le path : la marge mesurée sur le
 * corpus est NULLE (`spells.json` descend à 20 pile), une enveloppe de plus perdrait des slots.
 */
export const PROFONDEUR_MAX = 20;

/**
 * Marche UNIQUE d'un schéma composé : visite chaque nœud MARQUÉ avec son path. Les cycles sont
 * coupés par la PILE D'ANCÊTRES, jamais par un ensemble global de nœuds vus — une instance partagée
 * par 3 champs vaut 3 slots, pas 1.
 */
/** Le point séparateur d'une clé ne s'écrit pas en tête de path (`t.id`, jamais `.t.id`). */
const joindrePath = (path: string, segment: string): string => (path === '' && segment.startsWith('.') ? segment.slice(1) : path + segment);

function marcher(schema: unknown, visite: (noeud: object, marque: MarqueDeSlot, path: string) => void): void {
  const descendre = (noeud: unknown, path: string, ancêtres: ReadonlySet<unknown>, profondeur: number): void => {
    if (!noeud || typeof noeud !== 'object' || ancêtres.has(noeud)) return;
    if (profondeur > PROFONDEUR_MAX)
      throw new Error(
        `slots : descente coupée à PROFONDEUR_MAX=${PROFONDEUR_MAX} sous « ${path} » — le schéma est plus profond que la borne, ses slots seraient perdus sans un mot.`,
      );
    const m = marqueDe(noeud);
    if (m) visite(noeud as object, m, path);
    const def = defDe(noeud);
    if (!def) return;
    const pile = new Set(ancêtres).add(noeud);
    for (const e of enfantsDe(def)) descendre(e.noeud, joindrePath(path, e.segment), pile, profondeur + 1);
  };
  descendre(schema, '', new Set(), 0);
}

/**
 * Slots de référence d'un schéma de document, à leur path exact. La cardinalité se DÉDUIT du path :
 * une liste (`[]`) ou un record (`{}`) en amont ⇒ `liste`.
 */
export function slotsDe(root: RacineDocument, dataset: string, schema: unknown): Slot[] {
  const slots: Slot[] = [];
  marcher(schema, (_noeud, m, path) => {
    slots.push({ root, dataset, path, type: m.type, espece: m.espece, cardinalite: path.includes('[]') || path.includes('{}') ? 'liste' : 'un' });
  });
  return slots;
}

/** Nœuds marqués RETROUVÉS par la marche — la face « recensement » de `slotsDe`, même machinerie. */
export function marquesRetrouvées(schema: unknown): Set<object> {
  const trouvées = new Set<object>();
  marcher(schema, (noeud) => {
    trouvées.add(noeud);
  });
  return trouvées;
}
