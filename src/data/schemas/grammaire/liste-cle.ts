/**
 * CLÉ D'IDENTITÉ d'un élément de liste (#1897) — la liste DÉCLARE ce qui identifie ses éléments, rien
 * ne le devine. `listeCle(element, cle)` construit la liste, y pose l'UNICITÉ de la clé (la valeur en
 * double est le SUJET du message, jamais son emplacement) et MARQUE le nœud rendu : la résolution des
 * fautes (`schemas/validate.ts`, `lieu`) lit la marque pour nommer un élément par sa clé plutôt que par
 * son rang.
 *
 * Une référence vers un autre document se mesure au parse (`mesureDuParse`, `grammaire/ref.ts`) ; une
 * clé d'élément désigne l'IDENTITÉ d'un élément dans SA liste, et se retrouve par la descente unique
 * (`descendre`, `grammaire/descente.ts`). La marque vit sur le nœud RENDU par la fabrique ; un
 * `.min`/`.refine` posé APRÈS le clone et la perd — le compteur anti-perte (`clesPosees`/
 * `clesRetrouvees`) le nomme.
 */
import { z } from 'zod';
import './locale-fr';
import { descendre } from './descente';

/** Clé d'un élément : un CHAMP de l'élément, ou une clé COMPOSÉE nommée (`walls` : `x,y,side,z`). */
export type CleDElement<T> =
  | Extract<keyof T, string>
  | { readonly nom: string; readonly de: (element: T) => string | undefined };

/** Marque posée par `listeCle` : le NOM de la clé (message, compteur) et sa lecture sur un élément BRUT. */
export interface MarqueDeCle {
  readonly nom: string;
  readonly de: (element: unknown) => string | undefined;
}

const CLES = new WeakMap<object, MarqueDeCle>();
const POSEES: object[] = [];

/** La clé LISIBLE d'une valeur : une chaîne vide ne nomme rien (sa forme est refusée par l'élément). */
const texteDeCle = (v: unknown): string | undefined =>
  typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : undefined;

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';

/** Options de FORME de la liste, posées AVANT la marque (un `.min` posé après clonerait le nœud). */
export interface OptionsDeListeCle {
  readonly min?: { readonly taille: number; readonly message: string };
}

/** Liste d'éléments IDENTIFIÉS par `cle`, unique dans la liste. Un élément sans clé lisible n'entre pas
 *  dans le compte (sa forme est refusée ailleurs, par le schéma de l'élément). */
export function listeCle<E extends z.ZodType>(
  element: E,
  cle: CleDElement<z.output<E>>,
  options: OptionsDeListeCle = {},
): z.ZodArray<E> {
  const marqueDeCle: MarqueDeCle =
    typeof cle === 'string'
      ? { nom: cle, de: (el) => (estObjet(el) ? texteDeCle(el[cle]) : undefined) }
      : { nom: cle.nom, de: (el) => (estObjet(el) ? cle.de(el as z.output<E>) : undefined) };
  const base = z.array(element);
  const bornee = options.min ? base.min(options.min.taille, options.min.message) : base;
  const liste = bornee.superRefine((elements, ctx) => {
    const vues = new Set<string>();
    elements.forEach((el, i) => {
      const valeur = marqueDeCle.de(el);
      if (valeur === undefined) return;
      if (vues.has(valeur))
        ctx.addIssue({
          code: 'custom',
          path: [i],
          message: `« ${valeur} » dupliqué : « ${marqueDeCle.nom} » identifie l’élément dans sa liste, il y est unique.`,
        });
      vues.add(valeur);
    });
  });
  CLES.set(liste, marqueDeCle);
  POSEES.push(liste);
  return liste;
}

/** Marque de clé portée par un nœud, `undefined` sinon. */
export const cleDe = (noeud: unknown): MarqueDeCle | undefined => (estObjet(noeud) ? CLES.get(noeud) : undefined);

/** Listes à clé POSÉES depuis le chargement — la référence du compteur anti-perte. */
export function clesPosees(): readonly object[] {
  return POSEES;
}

/** Listes à clé RETROUVÉES par la descente d'un schéma (`descendre`) — la face « recensement ». */
export function clesRetrouvees(schema: unknown): Set<object> {
  const trouvees = new Set<object>();
  descendre([schema], ({ noeud }) => {
    if (CLES.has(noeud)) trouvees.add(noeud);
  });
  return trouvees;
}
