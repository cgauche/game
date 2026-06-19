/**
 * Disponibilité RAW (pur, seedé). Source : Livre de Base FR « Faire son marché » (LDB 59, p.292,
 * l.26-35). Ne rien inventer : la table % et les quantités viennent directement du LDB FR.
 *  - Test de Disponibilité (réussite si d100 ≤ %) : Commune = toujours ; Limitée 30/60/90 ;
 *    Rare 15/30/45 ; Exotique = jamais (sauf curaté/commande).
 *  - Quantité de base si en stock : Village 1 / Ville 1d10 / Cité illimité ; ×2 Commune, ÷2 Rare (ceil).
 */
import { d100, d10, type RNG } from './dice';

export type Availability = 'Commune' | 'Limitée' | 'Rare' | 'Exotique';
export type Settlement = 'village' | 'ville' | 'cite';
export interface CatalogItem { id: string; label: string; availability: Availability | null; }
export interface StockLine { id: string; label: string; qty: number; test?: { roll: number; target: number } }

/** % de Disponibilité (réussite si d100 ≤ %). RAW LDB 59 p.292. */
export const DISPO_PCT: Record<'Limitée' | 'Rare', Record<Settlement, number>> = {
  'Limitée': { village: 30, ville: 60, cite: 90 },
  'Rare': { village: 15, ville: 30, cite: 45 },
};

const CITE_UNLIMITED = 99; // Cité : « autant que le MJ » → modélisé illimité (paramétrable)

/** Quantité de base par agglo si en stock (Village 1 / Ville 1d10 / Cité illimité). */
function baseQty(settlement: Settlement, rng: RNG): number {
  if (settlement === 'village') return 1;
  if (settlement === 'ville') return d10(rng);
  return CITE_UNLIMITED;
}
/** Modulation par classe : ×2 Commune, ÷2 Rare (arrondi sup.), Limitée = base. */
function classQty(av: Availability, base: number): number {
  if (av === 'Commune') return base * 2;
  if (av === 'Rare') return Math.ceil(base / 2);
  return base;
}

export function rollAvailability(av: Availability, settlement: Settlement, rng: RNG): { inStock: boolean; qty: number; test?: { roll: number; target: number } } {
  if (av === 'Commune') return { inStock: true, qty: classQty('Commune', baseQty(settlement, rng)) };
  if (av === 'Exotique') return { inStock: false, qty: 0 };
  const target = DISPO_PCT[av][settlement];
  const roll = d100(rng);
  if (roll > target) return { inStock: false, qty: 0, test: { roll, target } };
  return { inStock: true, qty: Math.max(1, classQty(av, baseQty(settlement, rng))), test: { roll, target } };
}

/** Stock SANS Test de Disponibilité (règle optionnelle « système d'achat/vente simplifié », LDB 59 l.15) :
 *  tout article disponible (Exotique et availability nulle exclus) à sa quantité de classe. Le rng ne sert
 *  qu'à la quantité de base (Ville 1d10). */
export function fullStock(catalog: CatalogItem[], settlement: Settlement, rng: RNG): StockLine[] {
  const out: StockLine[] = [];
  for (const it of catalog) {
    const av = it.availability;
    if (av !== 'Commune' && av !== 'Limitée' && av !== 'Rare') continue; // Exotique + null exclus
    out.push({ id: it.id, label: it.label, qty: Math.max(1, classQty(av, baseQty(settlement, rng))) });
  }
  return out;
}

/** Instantané de stock : pour chaque article du catalogue, Test de Disponibilité (sauf Commune/curaté).
 *  Exotique exclu sauf curaté ; `availability` nulle/inconnue → exclue. Déterministe pour un seed donné. */
export function rollStock(catalog: CatalogItem[], settlement: Settlement, rng: RNG, curated: string[] = []): StockLine[] {
  const out: StockLine[] = [];
  for (const it of catalog) {
    const av = it.availability;
    if (curated.includes(it.id)) {
      out.push({ id: it.id, label: it.label, qty: Math.max(1, classQty(av ?? 'Commune', baseQty(settlement, rng))) });
      continue;
    }
    if (av !== 'Commune' && av !== 'Limitée' && av !== 'Rare' && av !== 'Exotique') continue; // ND/null exclus
    const r = rollAvailability(av, settlement, rng);
    if (r.inStock) out.push({ id: it.id, label: it.label, qty: r.qty, test: r.test });
  }
  return out;
}
