/**
 * Trait de créature **Taille** (LDB `85 - Traits de créature.md` l.279-280 : 7 catégories,
 * Minuscule → Monstrueuse). Modélisé en INDEX ordinal (0..6) car la mécanique est une
 * COMPARAISON d'écart entre combattants, pas une valeur testée. Mod d'à-toucher au TIR selon
 * la Taille de la CIBLE : `14 - _GoBack.md` l.151-170. « Moyenne » = standard implicite des
 * espèces jouables (l.163), sans Trait. Cf. analyse :
 * docs/superpowers/specs/2026-06-07-taille-analyse-reference.md
 */
export type SizeCategory =
  | 'minuscule'
  | 'tresPetite'
  | 'petite'
  | 'moyenne'
  | 'grande'
  | 'enorme'
  | 'monstrueuse';

export const SIZE_ORDER: Record<SizeCategory, number> = {
  minuscule: 0,
  tresPetite: 1,
  petite: 2,
  moyenne: 3,
  grande: 4,
  enorme: 5,
  monstrueuse: 6,
};

export const SIZE_RANGED_MOD: Record<SizeCategory, number> = {
  minuscule: -30,
  tresPetite: -20,
  petite: -10,
  moyenne: 0,
  grande: 20,
  enorme: 40,
  monstrueuse: 60,
};

export const SIZE_LABEL: Record<SizeCategory, string> = {
  minuscule: 'Minuscule',
  tresPetite: 'Très Petite',
  petite: 'Petite',
  moyenne: 'Moyenne',
  grande: 'Grande',
  enorme: 'Énorme',
  monstrueuse: 'Monstrueuse',
};

/** Taille effective (défaut Moyenne : standard implicite des espèces jouables, LDB 14 l.163). */
export const effectiveSize = (size?: SizeCategory): SizeCategory => size ?? 'moyenne';

/** Écart de catégories attaquant − défenseur (> 0 si l'attaquant est plus grand). */
export const sizeGap = (a?: SizeCategory, b?: SizeCategory): number =>
  SIZE_ORDER[effectiveSize(a)] - SIZE_ORDER[effectiveSize(b)];

const SIZE_BY_NORM: Record<string, SizeCategory> = {
  minuscule: 'minuscule',
  trespetite: 'tresPetite',
  petite: 'petite',
  moyenne: 'moyenne',
  grande: 'grande',
  enorme: 'enorme',
  monstrueuse: 'monstrueuse',
};

const stripAccents = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Catégorie depuis un libellé libre (« Énorme », « de Petite à Énorme »…). Une plage narrative
 * est résolue vers sa **borne HAUTE** (choix de design documenté : le RAW ne tranche pas). Renvoie
 * null si aucune catégorie n'est reconnue.
 */
export function parseSizeLabel(raw: string): SizeCategory | null {
  const tokens = stripAccents(raw.toLowerCase()).match(
    /minuscule|tres\s*petite|petite|moyenne|grande|enorme|monstrueuse/g,
  );
  if (!tokens) return null;
  let best: SizeCategory | null = null;
  for (const tok of tokens) {
    const cat = SIZE_BY_NORM[tok.replace(/\s+/g, '')];
    if (cat && (best === null || SIZE_ORDER[cat] > SIZE_ORDER[best])) best = cat;
  }
  return best;
}
