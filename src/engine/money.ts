/**
 * Monnaie impériale (pur). RAW LDB 57 « La monnaie » p.290 : 1 couronne d'or (CO) = 20 pistoles
 * d'argent = 240 sous de cuivre ; 1 pistole = 12 sous. Le champ `brass` du store = le sou de cuivre
 * (= `price.bronze` des données). Interface structurellement identique au `Money` du store (pas
 * d'import → moteur pur). Affichage canon (LDB 57) : CO (couronne d'or), notation `/` pour les
 * pistoles d'argent (« 6/8 », « 20/– »), sc (sou de cuivre). `formatMoney` = SOURCE UNIQUE d'affichage.
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
/** Normalise un montant partiel `{gold?,silver?,brass?}` en `Money` plein (champs manquants = 0).
 *  `toBrass`/`canAfford` n'admettent pas les champs undefined → passer par ici pour un coût authored. */
export function toMoney(p: { gold?: number; silver?: number; brass?: number }): Money {
  return { gold: p.gold ?? 0, silver: p.silver ?? 0, brass: p.brass ?? 0 };
}
/** Affichage canon de la monnaie (LDB 57 « La monnaie », l.25/31/33). Abréviations canon : couronne
 *  d'or = `CO`, sou de cuivre = `sc`, pistole d'argent = la notation `/` (PAS « pa »). Les pistoles
 *  et les sous se combinent en `S/C` — « 6/8 » = 6 pistoles 8 sous, « 20/– » = 20 pistoles sans sou
 *  (le livre écrit « si la monnaie est un peu mélangée : 6/8 »). Sous seuls = `N sc` ; or = `N CO`.
 *  Zéros omis (sauf « 0 sc » si tout est nul). SOURCE UNIQUE d'affichage de la monnaie. */
export function formatMoney(m: Money): string {
  const parts: string[] = [];
  if (m.gold) parts.push(`${m.gold} CO`);
  if (m.silver) parts.push(`${m.silver}/${m.brass || '–'}`); // pistoles (+ sous) : notation canon « S/C »
  else if (m.brass) parts.push(`${m.brass} sc`); // sous seuls (LDB 57 « 240sc »)
  return parts.length ? parts.join(' ') : '0 sc';
}
