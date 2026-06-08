/**
 * Monnaie impériale (pur). RAW LDB 57 « La monnaie » p.290 : 1 couronne d'or (CO) = 20 pistoles
 * d'argent = 240 sous de cuivre ; 1 pistole = 12 sous. Le champ `brass` du store = le sou de cuivre
 * (= `price.bronze` des données). Interface structurellement identique au `Money` du store (pas
 * d'import → moteur pur). Affichage = NOMS CANON FR : CO (couronne d'or) / pa (pistole d'argent) /
 * sc (sou de cuivre). `formatMoney` est la SOURCE UNIQUE d'affichage de la monnaie.
 */
export interface Money { gold: number; silver: number; brass: number; }
export const PA_PER_SC = 12;
export const PA_PER_CO = 240; // 20 × 12

export function toBrass(m: Money): number {
  return m.gold * PA_PER_CO + m.silver * PA_PER_SC + m.brass;
}
export function fromBrass(pa: number): Money {
  let r = Math.max(0, Math.round(pa));
  const gold = Math.floor(r / PA_PER_CO);
  r -= gold * PA_PER_CO;
  const silver = Math.floor(r / PA_PER_SC);
  r -= silver * PA_PER_SC;
  return { gold, silver, brass: r };
}
export function add(a: Money, b: Money): Money {
  return fromBrass(toBrass(a) + toBrass(b));
}
/** a − b, ou null si insuffisant. */
export function subtract(a: Money, b: Money): Money | null {
  const d = toBrass(a) - toBrass(b);
  return d < 0 ? null : fromBrass(d);
}
export function canAfford(purse: Money, cost: Money): boolean {
  return toBrass(purse) >= toBrass(cost);
}
export function priceToMoney(p: { gold?: number; silver?: number; bronze?: number }): Money {
  return { gold: p.gold ?? 0, silver: p.silver ?? 0, brass: p.bronze ?? 0 };
}
/** « 2 CO 3 pa », zéros omis (sauf « 0 sc » si tout est nul). Noms canon FR : CO=couronne d'or,
 *  pa=pistole d'argent, sc=sou de cuivre (LDB 57). SOURCE UNIQUE d'affichage de la monnaie. */
export function formatMoney(m: Money): string {
  const parts = [m.gold && `${m.gold} CO`, m.silver && `${m.silver} pa`, m.brass && `${m.brass} sc`].filter(Boolean);
  return parts.length ? parts.join(' ') : '0 sc';
}
