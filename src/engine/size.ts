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

/** Multiplicateur de Dégâts si l'attaquant est plus grand (LDB 85 l.297) : ×2 à +2 cat, ×3 à +3…
 *  (+1 cat = ×1, no-op — le bonus à +1 est l'Atout Dévastatrice). Jamais < 1. */
export function sizeDamageMultiplier(attacker?: SizeCategory, target?: SizeCategory): number {
  const gap = sizeGap(attacker, target);
  return gap >= 2 ? gap : 1;
}

/** Atouts conférés par l'écart de Taille (LDB 85 l.295) : Dévastatrice à +1 cat, Percutante à +2 — CUMUL. */
export function sizeGrantedQualities(attacker?: SizeCategory, target?: SizeCategory): string[] {
  const gap = sizeGap(attacker, target);
  if (gap >= 2) return ['Dévastatrice', 'Percutante'];
  if (gap >= 1) return ['Dévastatrice'];
  return [];
}

/** Issue d'un Test de Force opposé selon la Taille (LDB 85 l.311-312), du point de vue de `a` :
 *  a ≥ +2 cat → `autoWin` ; a plus petit (gap ≤ −1) → `needCrit` (doit un Critique pour s'opposer) ; sinon `normal`. */
export function forceOpposedOutcome(a?: SizeCategory, b?: SizeCategory): 'autoWin' | 'needCrit' | 'normal' {
  const gap = sizeGap(a, b);
  if (gap >= 2) return 'autoWin';
  if (gap <= -1) return 'needCrit';
  return 'normal';
}

/** Points de Blessure de base par catégorie de Taille (LDB 85 l.332-352). bf/be/bfm = Bonus de F/E/FM. */
export function woundsForSize(bf: number, be: number, bfm: number, size: SizeCategory = 'moyenne'): number {
  const moyenne = bf + 2 * be + bfm;
  switch (size) {
    case 'minuscule':
      return 1;
    case 'tresPetite':
      return be;
    case 'petite':
      return 2 * be + bfm;
    case 'moyenne':
      return moyenne;
    case 'grande':
      return moyenne * 2;
    case 'enorme':
      return moyenne * 4;
    case 'monstrueuse':
      return moyenne * 8;
  }
}
