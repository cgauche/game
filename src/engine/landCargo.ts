/**
 * COMMERCE TERRESTRE & FLUVIAL — couche PURE de Mort sur le Reik Compagnon ch.11 « Règles du commerce »
 * (p.70-78), données verbatim `land-cargo.json`. PARENT terrestre du commerce maritime (MDG ch.15) : il
 * réutilise le TRONC COMMUN `cargo.ts` (modèle de lot, tirage saisonnier, prix de base, Marchandage) et
 * n'ajoute QUE ce que le RAW T2C diffère du maritime :
 *  - Disponibilité en DEUX temps (l.22-38) : d'abord une CHANCE de trouver un marchand ((Taille + Richesse)
 *    × 10 %, doublée pour un Emplacement « Commerce »), PUIS la Taille de la cargaison ((Taille + Richesse)
 *    × [1d100 arrondi à la dizaine sup.] ; centre de Commerce → on inverse le d100 et on garde le plus grand).
 *  - Qualité SECRÈTE du Vin (l.93-104) : d10 → échelon de qualité → prix (Kemperbad : +2 échelons) ; Test
 *    d'Évaluation Intermédiaire (Accessible si Résistance à l'alcool ≥ 50).
 *  - Vente (l.133-160) : Demande = Taille × 10 (+30 si Commerce) ; Mise à prix par Richesse ; bradage à la
 *    MOITIÉ du prix de base (l.160, ≠ quart maritime).
 *  - Rumeurs commerciales (l.176-303) : Test de Ragot Complexe (−10) → Emplacement aléatoire → rumeur → un
 *    bien correspondant s'y vend le DOUBLE de son prix de base.
 */
import landCargoJson from '../data/land-cargo.json';
import { d10, d100, roll as rollDice, type RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import type { Difficulty } from './types';
import type { Season } from './travelStages';
import { type CargoDef, rollSeasonalCargo, cargoBasePrice } from './cargo';

/** Un type de cargaison terrestre = `CargoDef` + éventuel marqueur `wine` (prix par table de qualité, non
 *  par la colonne saisonnière). */
export interface LandCargoDef extends CargoDef { wine?: boolean }

interface WineTier { min: number; max: number; label: string; price: number }
interface OfferRow { richesse: number; label: string; pct: number }
interface RumourRow { min: number; max: number; biens: string[]; text: string }

const LAND = landCargoJson as unknown as {
  cargoes: LandCargoDef[];
  wineQuality: WineTier[];
  buy: { availabilityMultiplier: number; merchantSkill: { d10: number; plus: number }; partialSurchargePct: number; minEnc: number; wineEvalDifficulty: Difficulty; wineEvalEasyDifficulty: Difficulty; wineAlcoholResistThreshold: number };
  sell: { targetPerSize: number; commerceBonus: number; dumpingPctOfBase: number; offerByRichesse: OfferRow[] };
  gossip: { difficulty: Difficulty; mod: number };
  rumours: RumourRow[];
};

export const LAND_CARGOES = LAND.cargoes;
export const WINE_QUALITY = LAND.wineQuality;
export const findLandCargoById = (id: string): LandCargoDef | undefined => LAND.cargoes.find((c) => c.id === id);

/** Profil COMMERCIAL d'un Lieu terrestre/fluvial (Index géographique, l.183-278) — porté par le LIEU de
 *  la carte du monde (`MapPlace.market`, donnée d'auteur). Reproduit les colonnes de l'Index. */
export interface LandMarketProfile {
  /** Indice de Taille de la communauté (1 Hameau … 4 Grande ville, l.44-50). */
  taille: number;
  /** Indice de Richesse (1 Pauvre … 5 Florissant ; Misérable = 0/absent, l.52-60). */
  richesse: number;
  /** Colonne Produits : ids de cargaison produits, plus éventuellement `'commerce'` / `'subsistance'`. */
  produits: string[];
  /** Biens en Demande (facultatif) — informatif / futur ; la Demande RAW dépend surtout de Taille+Commerce. */
  demande?: string[];
  /** Le Lieu tire sa Richesse du COMMERCE (colonne Produits « Commerce ») → centre de commerce : on inverse
   *  le d100 de quantité et on garde le plus grand (l.40-42). Dérivé aussi de `produits.includes('commerce')`. */
  commerceRichesse?: boolean;
  /** Régions à Vin/Eau-de-vie supérieurs (Kemperbad, Brandenburg…) : +N échelons de qualité (l.95). */
  wineBonusEchelons?: number;
}

/** Le Lieu est-il une plaque tournante du Commerce (colonne Produits « Commerce », l.28) ? PUR. */
export function hasCommerce(place: LandMarketProfile): boolean {
  return place.produits.includes('commerce');
}

/** % de CHANCE de trouver un marchand ayant une cargaison à vendre (l.24-26) : (Taille + Richesse) × 10. PUR. */
export function availabilityPct(place: LandMarketProfile): number {
  return (place.taille + place.richesse) * LAND.buy.availabilityMultiplier;
}

/** Recherche d'une cargaison à l'ACHAT (l.22-34) : 1d100 ≤ %chance → un marchand est trouvé. Un Emplacement
 *  « Commerce » lance DEUX fois (marchandises locales + une cargaison aléatoire de la table). PUR. */
export function rollFindMerchant(place: LandMarketProfile, rng: RNG = defaultRNG): { pct: number; localRoll: number; localFound: boolean; randomRoll?: number; randomFound?: boolean } {
  const pct = availabilityPct(place);
  const localRoll = d100(rng);
  const out = { pct, localRoll, localFound: localRoll <= pct } as { pct: number; localRoll: number; localFound: boolean; randomRoll?: number; randomFound?: boolean };
  if (hasCommerce(place)) {
    const randomRoll = d100(rng);
    out.randomRoll = randomRoll;
    out.randomFound = randomRoll <= pct;
  }
  return out;
}

const roundUpToTens = (n: number): number => Math.ceil(n / 10) * 10;

/** Inverse d'un d100 (36 → 63, l.42) — inversion des deux chiffres ; 100 et « 00 » restent 100. */
function invertD100(v: number): number {
  if (v >= 100) return 100;
  const inv = (v % 10) * 10 + Math.floor(v / 10);
  return inv === 0 ? 100 : inv;
}

/** TAILLE de la cargaison disponible en points d'Encombrement (l.36-42) : (Taille + Richesse) × [1d100
 *  arrondi à la dizaine SUPÉRIEURE]. Centre de Commerce → on inverse aussi le d100 et on garde le plus
 *  grand des deux arrondis (l.40-42). PUR. */
export function rollCargoQuantity(place: LandMarketProfile, rng: RNG = defaultRNG): { d100: number; enc: number } {
  const r = d100(rng);
  // L'inversion (l.40-42) ne concerne QUE les Lieux « tirant leur Richesse du Commerce » (`commerceRichesse`),
  // pas tout Lieu ayant « Commerce » en Produits — cf. l'exemple Grünburg (Commerce, mais 46 → 50, sans inversion).
  const tens = place.commerceRichesse ? Math.max(roundUpToTens(r), roundUpToTens(invertD100(r))) : roundUpToTens(r);
  return { d100: r, enc: (place.taille + place.richesse) * tens };
}

/** Cargaison ALÉATOIRE de la saison (Tableau des cargaisons aléatoires, l.71-78) — table TERRESTRE. PUR. */
export function rollRandomLandCargo(season: Season, rng: RNG = defaultRNG): LandCargoDef {
  return rollSeasonalCargo(LAND.cargoes, season, rng) as LandCargoDef;
}

/** ÉCHELON de qualité SECRÈTE d'une cargaison de Vin/Eau-de-vie (l.93-104) : 1d10 → qualité → prix de base
 *  (CO par 10 Enc). `bonusEchelons` (Kemperbad, l.95) monte le résultat de N crans dans le tableau. PUR. */
export function rollWineQuality(rng: RNG = defaultRNG, bonusEchelons = 0): { roll: number; label: string; price: number } {
  const roll = d10(rng);
  let idx = LAND.wineQuality.findIndex((w) => roll >= w.min && roll <= w.max);
  if (idx < 0) idx = 0;
  idx = Math.min(LAND.wineQuality.length - 1, idx + Math.max(0, bonusEchelons));
  const tier = LAND.wineQuality[idx];
  return { roll, label: tier.label, price: tier.price };
}

/** Prix de BASE terrestre (CO par 10 Enc) : le Vin/Eau-de-vie passe par la table de qualité SECRÈTE
 *  (`rollWineQuality`, + bonus régional du Lieu) ; les autres biens par la colonne saisonnière. PUR. */
export function landCargoBasePrice(cargo: LandCargoDef, season: Season, place: LandMarketProfile | undefined, rng: RNG = defaultRNG): number {
  if (cargo.wine) return rollWineQuality(rng, place?.wineBonusEchelons ?? 0).price;
  return cargoBasePrice(cargo, season, rng);
}

/** Difficulté du Test d'Évaluation de la qualité du Vin (l.95) : Intermédiaire, ou Accessible si le
 *  personnage a une Compétence Résistance à l'alcool ≥ 50. PUR. */
export function wineEvalDifficulty(alcoholResist: number): Difficulty {
  return alcoholResist >= LAND.buy.wineAlcoholResistThreshold ? LAND.buy.wineEvalEasyDifficulty : LAND.buy.wineEvalDifficulty;
}

/** Surcoût d'un LOT PARTIEL à l'achat (l.131) : « le prix de base par 10 Points d'Encombrement doit être
 *  augmenté de 10 % ». Les marchands ne vendent pas moins de `minEnc` (l.131). */
export const partialSurchargePct = LAND.buy.partialSurchargePct;
export const minCargoEnc = LAND.buy.minEnc;

/** Compétence Marchandage d'un petit marchand pris au hasard (l.129) : 2d10 + 30 (≈ 32-50). PUR. */
export function rollMerchantSkill(rng: RNG = defaultRNG): number {
  return rollDice(2, 10, rng) + LAND.buy.merchantSkill.plus;
}

/** Nombre visé du d100 « trouver un acheteur » à la VENTE (l.146) : Taille × 10, +30 si le Lieu a le
 *  Commerce en Produits. Un échec autorise une 2ᵉ tentative sur la moitié de la cargaison (couche flux). PUR. */
export function sellDemandTarget(place: LandMarketProfile): number {
  return place.taille * LAND.sell.targetPerSize + (hasCommerce(place) ? LAND.sell.commerceBonus : 0);
}

/** Mise à prix d'un acheteur (l.148-156) : % du prix de base selon la Richesse du Lieu (Misérable 50 %,
 *  Pauvre −20 %, Moyen prix de base, Animé +5 %, Prospère +10 %). PUR. Renvoie le POURCENTAGE (ex. 80, 100). */
export function sellOfferPct(place: LandMarketProfile): number {
  const row = [...LAND.sell.offerByRichesse].reverse().find((o) => place.richesse >= o.richesse) ?? LAND.sell.offerByRichesse[0];
  return 100 + row.pct;
}

/** BRADER une cargaison invendable (l.160) : « pour la moitié de son prix de base » à tout Lieu ayant le
 *  Commerce en Produits. `null` si le Lieu ne s'y prête pas. PUR. */
export function landDumpingPct(place: LandMarketProfile): number | null {
  return hasCommerce(place) ? LAND.sell.dumpingPctOfBase : null;
}

/** Difficulté du Test de Ragot pour dénicher une rumeur commerciale (l.180) : Ragot Complexe (−10). */
export const gossipRule = LAND.gossip;

/** Tire une RUMEUR commerciale (Tableau des rumeurs, l.281-303) : d100 → une rumeur pointant les biens très
 *  demandés à un Emplacement. PUR. */
export function rollTradeRumour(rng: RNG = defaultRNG): RumourRow {
  return findTableEntry(LAND.rumours, d100(rng));
}

/** La cargaison `cargoId` correspond-elle à une rumeur (l.180 : « ils peuvent en vendre autant qu'ils le
 *  souhaitent pour le double du prix de base ») → le prix double. PUR. */
export function rumourMatches(rumour: RumourRow, cargoId: string): boolean {
  return rumour.biens.includes(cargoId);
}
