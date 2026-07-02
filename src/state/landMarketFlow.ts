/**
 * ÉCRAN MARCHÉ TERRESTRE / FLUVIAL (Mort sur le Reik Compagnon ch.11 « Règles du commerce ») — le PENDANT
 * TERRESTRE de `portFlow` (commerce maritime, MDG ch.15). Même SHAPE « acheter bas / transporter / revendre »
 * orchestrée côté state contre le moteur PUR `engine/landCargo` (déjà testé) ; SEULES les formules du RAW T2C
 * diffèrent du maritime (disponibilité en 2 temps, qualité secrète du Vin, Demande/Mise à prix, bradage à ½) →
 * elles vivent dans `landCargo.ts`, ce flux ne fait que les jouer.
 *
 * POURQUOI un flux PARALLÈLE et non une factorisation de `portFlow` : le tronc commun (modèle de lot, tirage
 * saisonnier, prix de base, retrait) est DÉJÀ mutualisé dans `engine/cargo.ts` et réutilisé ici. Le reste de
 * `portFlow` est couplé au NAVIRE de campagne (`state.vessel`, Contenance de coque, PortProfile, sellChance/
 * offerPricePct/dumpingPricePct maritimes) ; la cargaison terrestre persiste au niveau GROUPE (`caravanCargo`,
 * transport par chariot — pas de Contenance de coque) et lit `MapPlace.market` (LandMarketProfile). Fusionner
 * les deux imposerait une union `sea|land` et des branches partout → on garde deux flux fins sur le même socle
 * `cargo.ts`. Le Marchandage (Test opposé ±10 %/±20 %) réutilise le MÊME patron que `portFlow`.
 */
import { battleRng } from './battleRng';
import { placeOfScene } from './worldMap';
import { partyAssisted, partyBest, testValue } from '../engine/skills';
import { opposedTest, SL_ASTOUNDING, rollTest } from '../engine/tests';
import { d100 } from '../engine/dice';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import { toBrass, fromBrass, formatMoney, PA_PER_CO, canAfford, subtract, toMoney } from '../engine/money';
import {
  type LandMarketProfile, type RumourRow, rollFindMerchant, rollCargoQuantity, rollRandomLandCargo, landCargoBasePrice,
  findLandCargoById, sellDemandTarget, sellOfferPct, landDumpingPct, rollMerchantSkill, partialSurchargePct, minCargoEnc,
  wineEvalDifficulty, wineEvalReveal, rollTradeRumour, rumourMatches, gossipRule,
} from '../engine/landCargo';
import { type CargoLot, cargoTotalEnc } from '../engine/cargo';
import { seasonOfMonth } from '../engine/travelStages';
import { toDate } from '../engine/clock';
import type { Get, Set } from './flowTypes';

/** Une offre d'achat générée à l'étape (l.36-42) — Enc disponible + prix de base NOTÉ (le Vin fige sa
 *  qualité secrète / son prix ICI, l.93-104). `wine` : cargaison à qualité incertaine. */
export interface LandOffer {
  cargoId: string;
  label: string;
  enc: number;
  basePrice: number;
  wine: boolean;
  /** Vin ÉVALUÉ (Test d'Évaluation joué, l.95) : la qualité affichée (vraie sur un succès, FAUSSE sur un
   *  échec). Absent tant que le lot n'a pas été évalué (« qualité incertaine »). */
  wineTier?: string;
  /** Le Test d'Évaluation a-t-il RÉUSSI (indication fiable) ? Présent une fois évalué. */
  wineEvalOk?: boolean;
}

/** État MARCHÉ TERRESTRE ouvert (généré une fois à l'arrivée — les d100 de disponibilité ne se re-tirent pas
 *  par rendu, comme l'écran Port). */
export interface LandMarketState {
  placeId: string;
  label: string;
  market: LandMarketProfile;
  offers: LandOffer[];
  /** Rumeur commerciale entendue à l'arrivée (Test de Ragot réussi, l.176-180) : signale les biens très
   *  recherchés — ils se vendent au DOUBLE de leur prix de base à ce Lieu. `null`/absent = pas de rumeur. */
  rumour?: RumourRow | null;
}

const log = (get: Get, set: Set, lines: string[]) => {
  if (lines.length) set({ journal: [...get().journal.slice(-40), ...lines] });
};

/** Lieu de commerce terrestre courant (place de la carte dont la scène EST la scène courante + `market`). */
export function currentMarket(get: Get): { placeId: string; label: string; market: LandMarketProfile } | null {
  const map = get().worldMap;
  const place = map ? placeOfScene(map, get().scene?.id) : undefined;
  if (!place?.market) return null;
  return { placeId: place.id, label: place.label, market: place.market };
}

/** Enc total transporté par le groupe (chariot/convoi — pas de Contenance de coque : information, pas plafond). */
export function caravanEnc(get: Get): number {
  return cargoTotalEnc(get().caravanCargo ?? []);
}

/** Génère les offres d'ACHAT à l'arrivée (T2C l.22-42) : disponibilité en 2 temps — d'abord une CHANCE de
 *  trouver un marchand ((Taille+Richesse)×10 %, `rollFindMerchant`), puis la TAILLE de chaque cargaison
 *  (`rollCargoQuantity`). Un Emplacement « Commerce » ajoute une cargaison ALÉATOIRE de la table saisonnière. */
export function openLandMarket(get: Get, set: Set): void {
  const cur = currentMarket(get);
  if (!cur) return;
  const rng = battleRng();
  const season = seasonOfMonth(toDate(get().gameTime).month);
  const { market } = cur;
  const find = rollFindMerchant(market, rng);
  const offers: LandOffer[] = [];
  const addOffer = (cargoId: string) => {
    const cargo = findLandCargoById(cargoId);
    if (!cargo || offers.some((o) => o.cargoId === cargoId)) return;
    const { enc } = rollCargoQuantity(market, rng);
    if (enc <= 0) return;
    offers.push({ cargoId, label: cargo.label, enc, basePrice: landCargoBasePrice(cargo, season, market, rng), wine: !!cargo.wine });
  };
  // Marchandises LOCALES (colonne Produits, hors marqueurs `commerce`/`subsistance`).
  if (find.localFound) for (const id of market.produits.filter((p) => p !== 'commerce' && p !== 'subsistance')) addOffer(id);
  // « Commerce » (l.32-34) : une cargaison ALÉATOIRE de la table saisonnière en plus.
  if (find.randomFound) addOffer(rollRandomLandCargo(season, rng).id);
  // Rumeurs commerciales (l.176-180) : en tendant l'oreille au marché, un Test de Ragot Complexe (−10) ; sur
  // un succès, une rumeur signale les biens très recherchés → ils s'y vendent le DOUBLE (l.180). Roulé APRÈS
  // les offres pour ne pas déplacer leur flux RNG. ADAPTATION assumée : le RAW fait entendre la rumeur dans une
  // AUBERGE, pointant un AUTRE Lieu via l'index géographique du Reikland (absent de la carte de l'arène) ; ici la
  // rumeur vaut pour le Lieu COURANT (modèle minimal endossé par la conception — cf. rapport #58).
  let rumour: RumourRow | null = null;
  const gossip = partyBest(get().party, 'ragot');
  if (gossip) {
    const g = rollTest(gossip.value, gossipRule.difficulty, rng, gossipRule.mod);
    if (g.success) rumour = rollTradeRumour(rng);
  }
  set({ landMarket: { placeId: cur.placeId, label: cur.label, market, offers, rumour } });
  if (rumour) log(get, set, [`Rumeur au marché : forte demande locale — ${rumour.biens.map((id) => findLandCargoById(id)?.label ?? id).join(', ')} s'y vendent le double (T2C ch.11 l.180).`]);
}

/** ÉVALUATION de la qualité SECRÈTE d'un lot de Vin/Eau-de-vie proposé (l.95) : Test d'Évaluation, difficulté
 *  Intermédiaire (Accessible si le meneur a Résistance à l'alcool ≥ 50). Sur un succès, révèle la vraie qualité ;
 *  sur un échec, une FAUSSE indication décalée du degré d'échec. Un lot ne s'évalue qu'une fois. */
export function landEvalWine(get: Get, set: Set, cargoId: string): void {
  const st = get().landMarket;
  if (!st) return;
  const offer = st.offers.find((o) => o.cargoId === cargoId);
  if (!offer || !offer.wine || offer.wineTier) return; // pas du vin, ou déjà évalué
  const best = partyBest(get().party, 'evaluation');
  if (!best) { log(get, set, ['Personne dans le groupe ne sait évaluer un vin.']); return; }
  const diff = wineEvalDifficulty(testValue(best.actor, 'resistance-a-l-alcool'));
  const res = rollTest(best.value, diff, battleRng());
  const rev = wineEvalReveal(offer.basePrice, res.success, res.sl);
  set({ landMarket: { ...st, offers: st.offers.map((o) => o.cargoId === cargoId ? { ...o, wineTier: rev.shownLabel, wineEvalOk: res.success } : o) } });
  log(get, set, [`${best.actor.name} — Évaluation du ${offer.label} (${res.roll}) : qualité jugée « ${rev.shownLabel} »${res.success ? '.' : ' — jugement peu sûr…'}`]);
}

export function closeLandMarket(_get: Get, set: Set): void {
  set({ landMarket: null });
}

/** Magnitude d'un Marchandage gagné (LDB 60, cité T2C l.127) : ±10 %, ±20 % si Négociateur ou DR net Stupéfiant. */
function bargainPct(winnerNegotiator: boolean, netSL: number): number {
  return winnerNegotiator || netSL >= SL_ASTOUNDING ? 20 : 10;
}

/** ACHAT d'une cargaison (T2C l.129-131) : prix = Enc × prix de base, modulé par le Marchandage opposé et
 *  majoré de +10 % si LOT PARTIEL (l.131). Débité, ajouté au convoi du groupe (`caravanCargo`). */
export function landBuyCargo(get: Get, set: Set, cargoId: string, enc: number): void {
  const st = get().landMarket;
  if (!st) return;
  const offer = st.offers.find((o) => o.cargoId === cargoId);
  if (!offer) return;
  const want = Math.max(0, Math.min(Math.floor(enc), offer.enc));
  if (want <= 0) { log(get, set, ['Rien à acheter.']); return; }
  // Lot minimal (l.131) : « Les marchands ne sont pas du tout intéressés par la vente de cargaisons de moins
  // de 10 Points d'Encombrement et orienteront plutôt les Personnages vers un marché. »
  if (want < minCargoEnc) { log(get, set, [`Les marchands ne cèdent pas de lot de moins de ${minCargoEnc} Points d'Encombrement (T2C ch.11 l.131).`]); return; }
  const rng = battleRng();
  const best = partyAssisted(get().party, 'marchandage');
  const merchant = rollMerchantSkill(rng); // petit marchand : 2d10 + 30 (l.129)
  let pct = 0; // % appliqué au prix (négatif = remise pour l'acheteur)
  let bargainLine = 'Aucun marchandeur dans le groupe — prix plein.';
  if (best) {
    const opp = opposedTest(best.value, merchant, rng, 'intermediaire', 'intermediaire');
    const buyerSL = opp.attacker.sl;
    const npcSL = opp.defender.sl;
    const buyerWins = buyerSL > npcSL || (buyerSL === npcSL && best.value > merchant);
    const netSL = Math.abs(buyerSL - npcSL);
    if (buyerWins) pct = -bargainPct(hasBargainBonus(best.actor), netSL); // remise à l'acheteur
    else if (npcSL > buyerSL) pct = bargainPct(false, netSL); // le marchand monte le prix
    bargainLine = `${best.actor.name} — Marchandage (${opp.attacker.roll} vs ${opp.defender.roll}) : ${pct === 0 ? 'prix inchangé' : pct < 0 ? `remise de ${-pct} %` : `surcoût de ${pct} %`}.`;
  }
  // Lot PARTIEL (l.131) : acheter moins que le stock du marchand → +10 % par 10 Enc sur le prix de base.
  const partial = want < offer.enc;
  const surcharge = partial ? partialSurchargePct : 0;
  const price = Math.max(0, Math.round(want * offer.basePrice * (1 + (pct + surcharge) / 100)));
  const cost = toMoney({ gold: price });
  if (!canAfford(get().money, cost)) { log(get, set, [`La bourse ne couvre pas ${price} CO de ${offer.label}.`]); return; }
  const lot: CargoLot = { cargoId, enc: want, basePriceGold: offer.basePrice };
  set({
    money: subtract(get().money, cost)!,
    caravanCargo: [...(get().caravanCargo ?? []), lot],
    landMarket: { ...st, offers: st.offers.map((o) => o.cargoId === cargoId ? { ...o, enc: o.enc - want } : o).filter((o) => o.enc > 0) },
  });
  log(get, set, [`${want} Enc de ${offer.label} chargés — ${bargainLine}${partial ? ' Lot partiel : +10 % (l.131).' : ''} Prix payé : ${formatMoney(fromBrass(toBrass(cost)))}.`]);
}

/** VENTE d'un lot du convoi (T2C l.133-160) : trouver un acheteur (Demande = Taille×10, +30 si Commerce),
 *  Mise à prix (% du prix de base par Richesse), Marchandage opposé. Un échec autorise une 2ᵉ tentative sur
 *  la moitié du lot (l.146). Retire le lot vendu, crédite la bourse. */
export function landSellCargo(get: Get, set: Set, cargoIndex: number): void {
  const st = get().landMarket;
  if (!st) return;
  const lots = get().caravanCargo ?? [];
  const lot = lots[cargoIndex];
  if (!lot) return;
  const label = findLandCargoById(lot.cargoId)?.label ?? lot.cargoId;
  const rng = battleRng();
  const target = sellDemandTarget(st.market); // Taille × 10 (+30 si Commerce), l.146

  // Trouver un acheteur (d100 ≤ Demande). Échec → proposer la moitié du lot une fois.
  let sellEnc = lot.enc;
  let found = d100(rng) <= target;
  if (!found) {
    sellEnc = Math.max(1, Math.floor(lot.enc / 2));
    found = d100(rng) <= target;
    if (found) log(get, set, [`${label} : pas d’acheteur pour tout le lot — la moitié (${sellEnc} Enc) trouve preneur.`]);
  }
  if (!found) { log(get, set, [`${label} : aucun acheteur intéressé à ${st.label} (Demande ${target}).`]); return; }

  // Mise à prix (% du prix de base par Richesse, l.148-156) puis Marchandage opposé (l.127).
  const offerPct = sellOfferPct(st.market);
  const best = partyAssisted(get().party, 'marchandage');
  const merchant = rollMerchantSkill(rng);
  let bargainPctVal = 0;
  let bargainLine = 'Aucun marchandeur — mise à prix prise telle quelle.';
  if (best) {
    const opp = opposedTest(best.value, merchant, rng, 'intermediaire', 'intermediaire');
    const sellerSL = opp.attacker.sl;
    const buyerSL = opp.defender.sl;
    const sellerWins = sellerSL > buyerSL || (sellerSL === buyerSL && best.value > merchant);
    const netSL = Math.abs(sellerSL - buyerSL);
    if (sellerWins) bargainPctVal = bargainPct(hasBargainBonus(best.actor), netSL); // le PJ monte le prix
    else if (buyerSL > sellerSL) bargainPctVal = -bargainPct(false, netSL); // l'acheteur le baisse
    bargainLine = `${best.actor.name} — Marchandage (${opp.attacker.roll} vs ${opp.defender.roll}) : ${bargainPctVal === 0 ? 'sans effet' : bargainPctVal > 0 ? `+${bargainPctVal} %` : `${bargainPctVal} %`}.`;
  }
  // Rumeur commerciale (l.180) : une rumeur du Lieu courant qui vise ce bien le fait vendre au DOUBLE du base.
  const rumourHit = !!st.rumour && rumourMatches(st.rumour, lot.cargoId);
  const rumourMult = rumourHit ? 2 : 1;
  const gross = Math.max(0, Math.round(sellEnc * lot.basePriceGold * (offerPct / 100) * (1 + bargainPctVal / 100) * rumourMult));
  set({
    money: fromBrass(toBrass(get().money) + gross * PA_PER_CO),
    caravanCargo: sellEnc >= lot.enc ? lots.filter((_, i) => i !== cargoIndex) : lots.map((l, i) => i === cargoIndex ? { ...l, enc: l.enc - sellEnc } : l),
  });
  log(get, set, [`${sellEnc} Enc de ${label} vendus (mise à prix ${offerPct} % du base — ${bargainLine}${rumourHit ? ' Rumeur : demande exceptionnelle, prix doublé (l.180) !' : ''}) : ${formatMoney(fromBrass(gross * PA_PER_CO))}.`]);
}

/** BRADER un lot invendable (l.160) : la MOITIÉ du prix de base, dans un Lieu ayant le Commerce en Produits —
 *  sinon refus. */
export function landDumpCargo(get: Get, set: Set, cargoIndex: number): void {
  const st = get().landMarket;
  if (!st) return;
  const lots = get().caravanCargo ?? [];
  const lot = lots[cargoIndex];
  if (!lot) return;
  const pct = landDumpingPct(st.market);
  const label = findLandCargoById(lot.cargoId)?.label ?? lot.cargoId;
  if (pct == null) { log(get, set, [`${label} : ce lieu ne brade pas les cargaisons (pas de Commerce en Produits, T2C ch.11 l.160).`]); return; }
  const gross = Math.max(0, Math.round(lot.enc * lot.basePriceGold * (pct / 100)));
  set({
    money: fromBrass(toBrass(get().money) + gross * PA_PER_CO),
    caravanCargo: lots.filter((_, i) => i !== cargoIndex),
  });
  log(get, set, [`${lot.enc} Enc de ${label} bradés (${pct} % du prix de base) : ${formatMoney(fromBrass(gross * PA_PER_CO))}.`]);
}
