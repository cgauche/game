import type { QuadProps } from '../quadSkeleton';
import type { QuadArt } from '../partArt';

/**
 * Une QUEUE de quadrupède = un fichier `tails/defs/<clé>.ts` (même patron que les têtes).
 *   - `key`    : id de la queue (= `QuadProps.tail`) ; l'union `QuadTail` en est DÉRIVÉE.
 *   - `art`    : les DEUX vues où l'os `queue` porte un art sont obligatoires — `profile` et `back`.
 *                De FACE la queue est masquée par le corps : le gabarit n'émet pas l'os (cf. `quadParts`),
 *                l'absence est une donnée du PLAN, pas un trou de def.
 *   - `params` : axes de `QuadProps` consommés par l'art (contrat d'axes déclarés, design v2 §1).
 *   - `vide`   : l'espèce ne porte PAS de queue (batracien) — les deux arts sont vides PAR CONTRAT.
 */
export interface QuadTailDef {
  key: string;
  label: string;
  art: { profile: QuadArt; back: QuadArt };
  params?: readonly (keyof QuadProps)[];
  vide?: true;
}
