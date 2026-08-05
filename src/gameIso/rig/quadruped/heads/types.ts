import type { View } from '../../facing';
import type { QuadBoneId, QuadProps } from '../quadSkeleton';

/**
 * Art d'une VUE : SVG constant, ou FONCTION des axes de gabarit — dans ce cas les axes consommés
 * sont DÉCLARÉS dans `params` (contrat d'axes déclarés, design v2 §1 de #1082). La garde
 * `heads/quad-heads.test.ts` mesure les axes réellement lus et rejette tout axe non déclaré.
 */
export type QuadHeadArt = string | ((p: QuadProps) => string);

/**
 * Une TÊTE de quadrupède = un fichier `heads/defs/<clé>.ts` (patron des parts monstrueuses du
 * bipède, `parts/monster/defs/`). La forme vit sur la donnée de la tête : le socle `quadParts.ts`
 * ne connaît plus aucune clé d'espèce, il compose par lookup.
 *
 *   - `key`    : id de la tête (= `QuadProps.head`) ; l'union `QuadHead` en est DÉRIVÉE (registre généré).
 *   - `art`    : les TROIS vues sont obligatoires (une vue absente ne compile pas).
 *   - `bone`   : os PORTEUR de l'art par vue — défaut `tete`. Les clusters multi-cous (hydre,
 *                chimère, déchiqueteur) dessinent leur profil sur `encolure` (un seul os → le
 *                faisceau ondule d'un bloc) et leurs vues de bout sur `tete`.
 *   - `params` : axes de `QuadProps` consommés par les arts/canaux de cette def.
 *
 * Canaux additionnels — chacun REMPLACE un branchement `p.head === '…'` du socle :
 *   - `bodyWidth`  : demi-largeur du corps vu de bout (épaule de face / croupe de dos).
 *   - `bodyHi`     : calque clair ajouté au haut de la silhouette de PROFIL (pelage, balafres).
 *   - `ridge`      : dorsale propre à la tête, qui remplace celle du jeton `ridge` de l'espèce.
 *   - `chestCrest` : crête de poitrail, vue de face.
 *   - `tailProfile`: queue propre à la tête, qui remplace l'art du jeton `tail` en profil.
 *   - `tailCrest`  : la crête de la queue reptilienne se prolonge jusqu'à la pointe.
 */
export interface QuadHeadDef {
  key: string;
  label: string;
  art: Record<View, QuadHeadArt>;
  bone?: Partial<Record<View, QuadBoneId>>;
  params?: readonly (keyof QuadProps)[];
  bodyWidth?: { front?: number; back?: number };
  bodyHi?: QuadHeadArt;
  ridge?: QuadHeadArt;
  chestCrest?: QuadHeadArt;
  tailProfile?: QuadHeadArt;
  tailCrest?: boolean;
}
