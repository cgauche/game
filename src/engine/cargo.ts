/**
 * TRONC COMMUN du COMMERCE DE CARGAISON — primitives PURES partagées par le commerce MARITIME
 * (Mer des Griffes ch.15, `seaVoyage.ts`) et le commerce TERRESTRE / FLUVIAL (Mort sur le Reik
 * Compagnon ch.11, `landCargo.ts`). Le RAW des deux livres suit la même structure « acheter bas /
 * transporter / revendre » ; SEULES les FORMULES (disponibilité, prix d'offre, bradage) et les
 * TABLEAUX (cargaisons, prix) diffèrent → ils vivent dans le module propre à chaque livre, ces
 * briques-ci (modèle de lot, tirage saisonnier, prix de base, Marchandage) NE SONT PAS dupliquées.
 */
import { d100, rollExpr, type RNG, defaultRNG } from './dice';
import type { Season } from './travelStages';

/** Un type de cargaison (bien volumineux) : plages saisonnières d100 (Tableau des cargaisons) + prix de
 *  base par saison (CO par 10 points d'Encombrement) — ou un jet de dés (`{dice}`, ex. Vin maritime 3d10). */
export interface CargoDef {
  id: string;
  label: string;
  avail: Record<Season, [number, number]>;
  price: Record<Season, number> | { dice: string };
}

/** Cargaison ALÉATOIRE de la saison : d100 dans la colonne saisonnière du tableau fourni (T2C l.71-78,
 *  MDG l.402-418). PUR. Repli sur la dernière entrée si aucune plage ne matche (tableaux exhaustifs 01-00). */
export function rollSeasonalCargo(cargoes: CargoDef[], season: Season, rng: RNG = defaultRNG): CargoDef {
  const r = d100(rng);
  return cargoes.find((c) => r >= c.avail[season][0] && r <= c.avail[season][1]) ?? cargoes[cargoes.length - 1];
}

/** Prix de BASE d'une cargaison (CO par 10 points d'Encombrement) pour la saison (T2C l.80-90, MDG
 *  l.420-436). Prix « à dés » (Vin maritime 3d10) tiré une fois à l'achat et NOTÉ. PUR (RNG injecté). */
export function cargoBasePrice(cargo: CargoDef, season: Season, rng: RNG = defaultRNG): number {
  if ('dice' in cargo.price) return rollExpr(cargo.price.dice, rng);
  return cargo.price[season];
}

/** Ampleur du Marchandage (LDB p.291, cité T2C l.127 & MDG) : le prix bouge de ±10 %, ou ±20 % si le
 *  négociant possède le Talent Négociateur. PUR. */
export function bargainDeltaPct(negotiator: boolean): number {
  return negotiator ? 20 : 10;
}

/** Un LOT de cargaison en cale/soute (`basePriceGold` = prix de base NOTÉ à l'achat, CO par point d'Enc —
 *  le Vin fige sa qualité/son 3d10 à ce moment). Modèle commun aux deux commerces. */
export interface CargoLot {
  cargoId: string;
  enc: number;
  basePriceGold: number;
}

/** Enc TOTAL embarqué (pénalités de Contenance, avaries « gâtent 1d10 Enc »…). PUR. */
export function cargoTotalEnc(lots: CargoLot[]): number {
  return lots.reduce((s, l) => s + Math.max(0, l.enc), 0);
}

/** RETIRE `enc` points d'une cargaison (avarie, vol, vente partielle) — au fil des lots de cet id ; les
 *  lots vidés disparaissent. PUR (nouvelle liste). */
export function removeCargo(lots: CargoLot[], cargoId: string, enc: number): { lots: CargoLot[]; removed: number } {
  let left = Math.max(0, enc);
  let removed = 0;
  const out: CargoLot[] = [];
  for (const l of lots) {
    if (l.cargoId !== cargoId || left <= 0) { out.push(l); continue; }
    const take = Math.min(l.enc, left);
    left -= take;
    removed += take;
    if (l.enc - take > 0) out.push({ ...l, enc: l.enc - take });
  }
  return { lots: out, removed };
}
