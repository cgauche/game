/**
 * COLLECTION À CLÉ (#1897, #1463) — une collection dont chaque élément a une IDENTITÉ, DÉCLARÉE au
 * nœud qui la porte, jamais devinée. Deux instances : une LISTE (la clé se lit dans chaque élément) et
 * un RECORD (les noms de propriété). `marquerCollection(noeud, marque)` est la seule primitive : elle
 * pose sur le nœud FINAL l'UNICITÉ de la clé d'une liste (la valeur en double est le SUJET du message,
 * jamais son emplacement) et la MARQUE. `listeCle(element, cle)` construit une liste à clé ; `document()`
 * (`grammaire/document.ts`) marque la charge d'un document après son affinage.
 *
 * La marque se lit à trois endroits : la résolution des fautes (`schemas/validate.ts`, `lieu`) nomme un
 * élément par sa clé plutôt que par son rang ; le parse de mesure en mode `espaces` (`mesureDuParse`,
 * `grammaire/ref.ts`) relève chaque collection marquée à son path de DONNÉE, dont
 * `scripts/docs/lib/slots-registre.mts` (`collectionsDuParse`) écrit la CLÉ DE COLLECTION ; la descente
 * unique (`descendre`, `grammaire/descente.ts`) la retrouve. Un `.min`/`.refine` posé APRÈS clone le
 * nœud : le clone garde le CONTRÔLE de la marque sans la marque, et `collectionsPerdues` le nomme.
 *
 * Une collection n'est un ESPACE DE NOMS que si sa marque porte `espace` : une clé d'unicité seule
 * (`members`, `stations`, `layers`, `walls` de `defs-scenes/scene.ts`) n'en ouvre aucun, et une clé
 * d'élément qui est une feuille `idDe` (une RÉFÉRENCE) n'en ouvre jamais.
 */
import { z } from 'zod';
import './locale-fr';
import { defDe, descendre, enfantsDe } from './descente';
import { estFeuilleDId, marquerCollectionAtteinte } from './ref';

/** Clé d'un élément : un CHAMP de l'élément, ou une clé COMPOSÉE nommée (`walls` : `x,y,side,z`). */
export type CleDElement<T> =
  | Extract<keyof T, string>
  | { readonly nom: string; readonly de: (element: T) => string | undefined };

/** Paramètres d'un ESPACE DE NOMS — une collection marquée `espace` en ouvre un. */
export type EspaceDeNoms = Readonly<Record<string, never>>;

/**
 * Marque d'une collection à clé. `liste` : le NOM de la clé (message, compteur) et sa lecture sur un
 * élément BRUT. `record` : les ids sont les noms de propriété de la carte, portée par le champ `sous`
 * de la valeur marquée (`entries` d'un document `record`), ou par la valeur elle-même.
 */
export type MarqueDeCollection =
  | {
      readonly forme: 'liste';
      readonly nom: string;
      readonly de: (element: unknown) => string | undefined;
      readonly espace?: EspaceDeNoms;
    }
  | { readonly forme: 'record'; readonly sous?: string; readonly espace?: EspaceDeNoms };

const COLLECTIONS = new WeakMap<object, MarqueDeCollection>();
/** Le contrôle que `marquerCollection` pose, et sa marque : un clone du nœud marqué le recopie. */
const CONTROLES = new WeakMap<object, MarqueDeCollection>();

/** La clé LISIBLE d'une valeur : une chaîne vide ne nomme rien (sa forme est refusée par l'élément). */
const texteDeCle = (v: unknown): string | undefined =>
  typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : undefined;

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';

/** Marque d'une LISTE dont `cle` identifie les éléments. */
export function marqueDeListe<T>(cle: CleDElement<T>, espace?: EspaceDeNoms): MarqueDeCollection {
  const lecture =
    typeof cle === 'string'
      ? { nom: cle, de: (el: unknown) => (estObjet(el) ? texteDeCle(el[cle]) : undefined) }
      : { nom: cle.nom, de: (el: unknown) => (estObjet(el) ? cle.de(el as T) : undefined) };
  return espace ? { forme: 'liste', ...lecture, espace } : { forme: 'liste', ...lecture };
}

/** Marque d'un RECORD dont les noms de propriété sont les ids — la carte au champ `sous`, s'il est donné. */
export function marqueDeRecord(options: { readonly sous?: string; readonly espace?: EspaceDeNoms } = {}): MarqueDeCollection {
  return { forme: 'record', ...options };
}

/** Les ids d'une collection marquée, dans l'ordre de la donnée (un élément sans clé lisible n'en porte pas). */
export function idsDeCollection(marque: MarqueDeCollection, valeur: unknown): string[] {
  if (marque.forme === 'liste') return Array.isArray(valeur) ? valeur.map(marque.de).filter((c): c is string => c !== undefined) : [];
  const carte = marque.sous === undefined ? valeur : estObjet(valeur) ? valeur[marque.sous] : undefined;
  return estObjet(carte) ? Object.keys(carte) : [];
}

/** Les enfants d'un nœud par un segment donné, à travers les enveloppes (`''`) et les unions (`|N`). */
function parSegment(noeuds: readonly unknown[], admis: (segment: string) => boolean): unknown[] {
  const out: unknown[] = [];
  const vus = new Set<unknown>();
  const file = [...noeuds];
  while (file.length) {
    const n = file.shift();
    if (vus.has(n)) continue;
    vus.add(n);
    for (const e of enfantsDe(n)) {
      if (e.segment === '' || e.segment.startsWith('|')) file.push(e.noeud);
      else if (admis(e.segment)) out.push(e.noeud);
    }
  }
  return out;
}

/** Les nœuds de schéma qui portent la CLÉ d'un élément de la collection marquée. */
function noeudsDeCle(noeud: unknown, marque: MarqueDeCollection): unknown[] {
  if (marque.forme === 'liste') return parSegment(parSegment([noeud], (s) => s === '[]'), (s) => s === `.${marque.nom}`);
  const cartes = marque.sous === undefined ? [noeud] : parSegment([noeud], (s) => s === `.${marque.sous}`);
  return parSegment(cartes, (s) => s === '{clé}');
}

/** Une feuille `idDe` est-elle atteinte depuis `noeud`, à travers ses seules enveloppes ? */
function porteUneFeuilleDId(noeud: unknown): boolean {
  if (estFeuilleDId(noeud)) return true;
  return enfantsDe(noeud).some((e) => e.segment === '' && porteUneFeuilleDId(e.noeud));
}

/**
 * Marque la collection `noeud` et rend le nœud FINAL qui porte la marque. Une liste y gagne l'UNICITÉ
 * de sa clé (un élément sans clé lisible n'entre pas dans le compte : sa forme est refusée ailleurs,
 * par le schéma de l'élément). FAIL-FAST à la CONSTRUCTION : `espace` sur une collection dont la clé
 * d'élément est une feuille `idDe` — une liste de RÉFÉRENCES n'est jamais un espace de noms.
 */
export function marquerCollection<N extends z.ZodType>(noeud: N, marque: MarqueDeCollection): N {
  if (marque.espace && noeudsDeCle(noeud, marque).some(porteUneFeuilleDId)) {
    const cle = marque.forme === 'liste' ? `la clé « ${marque.nom} »` : 'la clé de record';
    throw new Error(`marquerCollection : \`espace\` refusé — ${cle} est une feuille \`idDe\`, la collection est une liste de RÉFÉRENCES.`);
  }
  const marquee = noeud.superRefine((valeur, ctx) => {
    marquerCollectionAtteinte(ctx, marque);
    if (marque.forme !== 'liste' || !Array.isArray(valeur)) return;
    const vues = new Set<string>();
    valeur.forEach((el, i) => {
      const cle = marque.de(el);
      if (cle === undefined) return;
      if (vues.has(cle))
        ctx.addIssue({
          code: 'custom',
          path: [i],
          message: `« ${cle} » dupliqué : « ${marque.nom} » identifie l’élément dans sa liste, il y est unique.`,
        });
      vues.add(cle);
    });
  }) as N;
  COLLECTIONS.set(marquee, marque);
  const controles = defDe(marquee)?.checks ?? [];
  const controle = controles[controles.length - 1];
  if (typeof controle === 'object' && controle !== null) CONTROLES.set(controle, marque);
  return marquee;
}

/** Options de FORME de la liste, posées AVANT la marque (un `.min` posé après clonerait le nœud). */
export interface OptionsDeListeCle {
  readonly min?: { readonly taille: number; readonly message: string };
  readonly espace?: EspaceDeNoms;
}

/** Liste d'éléments IDENTIFIÉS par `cle`, unique dans la liste. */
export function listeCle<E extends z.ZodType>(
  element: E,
  cle: CleDElement<z.output<E>>,
  options: OptionsDeListeCle = {},
): z.ZodArray<E> {
  const base = z.array(element);
  const bornee = options.min ? base.min(options.min.taille, options.min.message) : base;
  return marquerCollection(bornee, marqueDeListe(cle, options.espace));
}

/** Marque de collection portée par un nœud, `undefined` sinon. */
export const collectionDe = (noeud: unknown): MarqueDeCollection | undefined => (estObjet(noeud) ? COLLECTIONS.get(noeud) : undefined);

/** Collections à clé RETROUVÉES par la descente d'un schéma (`descendre`). */
export function collectionsRetrouvees(schema: unknown): Set<object> {
  const trouvees = new Set<object>();
  descendre([schema], ({ noeud }) => {
    if (COLLECTIONS.has(noeud)) trouvees.add(noeud);
  });
  return trouvees;
}

/** Collections à clé PERDUES dans un schéma : les nœuds qui portent le contrôle d'une marque sans la
 *  marque — le clone d'une collection marquée, par un `.min`/`.refine` posé APRÈS `marquerCollection`. */
export function collectionsPerdues(schema: unknown): MarqueDeCollection[] {
  const perdues: MarqueDeCollection[] = [];
  descendre([schema], ({ noeud, def }) => {
    if (COLLECTIONS.has(noeud)) return;
    for (const c of def.checks ?? []) {
      const marque = typeof c === 'object' && c !== null ? CONTROLES.get(c) : undefined;
      if (marque) perdues.push(marque);
    }
  });
  return perdues;
}
