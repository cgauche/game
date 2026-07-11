/**
 * ÉCRAN PORT (MDG 15 « Longs voyages ») — services au navire de campagne à quai, orchestrés côté
 * state (le moteur PUR vit dans `engine/seaVoyage` + `engine/shipBuild`, déjà testé) :
 *  - RÉPARATION / CARÉNAGE / AMÉLIORATIONS : `portRepairVessel` / `portCareenVessel` /
 *    `portInstallUpgrade` (déjà dans `seaVoyageFlow`, #30) — ré-exportés comme actions de store ;
 *  - COMMERCE MARITIME (l.309-436) : achat (Type/Taille/Marchandage) et vente (Trouver un
 *    acheteur/Prix d'offre/Marchandage) + bradage (l.399), résolus ICI contre le moteur.
 *
 * Marchandage : Test opposé de Marchandage (l.335/385, « décrit en page 291 de WFJDR ») — jet direct
 * du meilleur PJ soutenu (LDB 12) contre le commerçant (`rollMerchantSkill`) ; le vainqueur module le
 * prix de ±10 % (±20 % si Négociateur ou DR net Stupéfiant, l.335). Les +DR de vendeur (`buySellerDR`
 * à l'achat, `sellChance.sellerDR` à la vente) s'ajoutent au DR de LEUR camp.
 *
 * VENTE (`portSellCargo`, dernier reliquat #275/#274) : CASCADE (`state/rollSeam.ts` `openRoll` +
 * `state/cascade.ts`) — Ragot (hero-test), recherche d'acheteur (dé de MONDE, `klass:'subi'`,
 * `worldSide`), Marchandage opposé (hero-test pour le héros, le marchand roule via
 * `engine/seaVoyage.rollMerchantOpposition`, moteur pur) sont chacun une étape routée par la policy
 * M/V/I (`resolveSurface`) — chaque continuation ENCHAÎNE l'étape suivante depuis l'applier de la
 * précédente (patron `merchantFlow.ts` Ragot→réassort ; défère via `setTimeout` si la cascade est
 * encore EN COURS de commit, patron `seaVoyageFlow.ts` `sea-desertion`). ACHAT (`portBuyCargo`) et
 * BRADAGE (`portDumpCargo`) restent SYNCHRONES (`opposedTest` direct) — hors périmètre de ce geste,
 * aucun `rollTest`/`d100` inline n'y est présent (non capté par le garde #274).
 */
import { battleRng } from './battleRng';
import { placeOfScene, placeById } from './worldMap';
import { partyAssisted } from '../engine/skills';
import { opposedTest, resolveOpposed, SL_ASTOUNDING, type TestResult } from '../engine/tests';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import { toBrass, fromBrass, formatMoney, PA_PER_CO, canAfford, subtract, toMoney, priceToMoney } from '../engine/money';
import { findVehicleById, findCrewRoleById } from '../data';
import { weeklyCrewWageBrass } from '../engine/crewMorale';
import {
  rollCargoAvailability, rollMerchantSkill, rollMerchantOpposition, buySellerDR, cargoBasePrice, rollRandomCargo,
  sellChance, offerPricePct, sellRelation, dumpingPricePct, cargoTotalEnc, findCargoById,
  cargoOverload, overloadMaxEnc,
  type PortProfile, type CargoLot,
} from '../engine/seaVoyage';
import { seasonOfMonth } from '../engine/travelStages';
import { toDate } from '../engine/clock';
import { registerCascadeApplier } from './cascade';
import { openRoll, freeCons } from './rollSeam';
import { actorIn } from './combatOrParty';
import type { Get, Set } from './flowTypes';

/** Une offre d'achat générée à l'escale (l.319-331) — Enc disponible + prix de base NOTÉ (le Vin fige son 3d10). */
export interface PortOffer {
  cargoId: string;
  label: string;
  enc: number;
  basePrice: number;
  /** Cargaison en Surplus du port (l.341 : +1 DR au vendeur NPC à l'achat). */
  surplus: boolean;
}

/** État PORT ouvert (généré une fois à l'escale — le d10 de disponibilité ne se re-tire pas par rendu). */
export interface PortState {
  placeId: string;
  label: string;
  /** id `naval-ports.json` du lieu-port (#217, `MapPlace.port.ref`) — source de la desc/région du
   *  catalogue pour l'en-tête du hub. Absent = port authoré sans référence de catalogue. */
  ref?: string;
  port: PortProfile;
  /** Contenance libre NOMINALE du navire (Enc) — headroom sans surcharge (l.325). */
  freeEnc: number;
  /** Enc embarquable avant le plafond DUR de surcharge (Contenance × 150 %, MDG 12 l.75) — au-delà de
   *  `freeEnc` = zone de surcharge (l'achat avertit, #243). */
  maxLoadEnc: number;
  offers: PortOffer[];
}

const log = (get: Get, _set: Set, lines: string[]) => {
  if (lines.length) get().log(lines);
};

/** Lieu portuaire courant (place de la carte dont la scène EST la scène courante + `port`). */
export function currentPort(get: Get): { placeId: string; label: string; ref?: string; port: PortProfile; cosmopolite: boolean } | null {
  const map = get().worldMap;
  const place = map ? placeOfScene(map, get().scene?.id) : undefined;
  if (!place?.port) return null;
  return { placeId: place.id, label: place.label, ref: place.port.ref, port: place.port, cosmopolite: !!place.port.cosmopolite };
}

/** Contenance libre NOMINALE du navire (Contenance − cargaison embarquée, min 0) — headroom SANS surcharge. */
export function vesselFreeEnc(get: Get): number {
  const vessel = get().vessel;
  if (!vessel) return 0;
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  return Math.max(0, capacity - cargoTotalEnc(vessel.cargo ?? []));
}

/** Enc EMBARQUABLE avant le plafond DUR de surcharge (MDG 12 l.75 : Contenance × 150 % − cargaison). Au-delà de
 *  la Contenance nominale = zone de SURCHARGE (paliers d'assiette, `cargoOverload`) — l'achat y AVERTIT (#243). */
export function vesselMaxLoadEnc(get: Get): number {
  const vessel = get().vessel;
  if (!vessel) return 0;
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  return Math.max(0, overloadMaxEnc(capacity) - cargoTotalEnc(vessel.cargo ?? []));
}

/** Génère les offres d'ACHAT de l'escale (l.319-331) : Production + Surplus (Enc = (Taille+Richesse+
 *  Surplus)×1d10×10, 1 → rien), et une cargaison aléatoire par « commerce » (3× si cosmopolite, l.347). */
export function openPort(get: Get, set: Set): void {
  const cur = currentPort(get);
  if (!cur || !get().vessel) return;
  const rng = battleRng();
  const season = seasonOfMonth(toDate(get().gameTime).month);
  const { port } = cur;
  const ids = new Set<string>();
  for (const p of port.production) if (p !== 'commerce' && p !== 'minimum-vital') ids.add(p);
  for (const s of Object.keys(port.surplus ?? {})) ids.add(s);
  // « commerce » → cargaison(s) aléatoire(s) (l.321/347).
  if (port.production.includes('commerce')) {
    const draws = cur.cosmopolite ? 3 : 1;
    for (let i = 0; i < draws; i++) ids.add(rollRandomCargo(season, rng).id);
  }
  const offers: PortOffer[] = [];
  for (const cargoId of ids) {
    const cargo = findCargoById(cargoId);
    if (!cargo) continue;
    const avail = rollCargoAvailability(port, cargoId, rng);
    if (avail.enc <= 0) continue; // 1 sur le d10 → aucune de ce type (l.327)
    offers.push({
      cargoId, label: cargo.label, enc: avail.enc,
      basePrice: cargoBasePrice(cargo, season, rng), // le Vin fige son 3d10 ici (l.436)
      surplus: (port.surplus?.[cargoId] ?? 0) > 0,
    });
  }
  set({ port: { placeId: cur.placeId, label: cur.label, ref: cur.ref, port, freeEnc: vesselFreeEnc(get), maxLoadEnc: vesselMaxLoadEnc(get), offers } });
}

export function closePort(_get: Get, set: Set): void {
  set({ port: null });
}

/** Magnitude d'un Marchandage gagné (±10 %, ±20 % si Négociateur ou DR net Stupéfiant, l.335). */
function bargainPct(winnerNegotiator: boolean, netSL: number): number {
  return winnerNegotiator || netSL >= SL_ASTOUNDING ? 20 : 10;
}

/** ACHAT d'une cargaison (l.319-349) : prix = Enc × prix de base, modulé par le Marchandage opposé
 *  (vendeur NPC +DR de lot partiel/Surplus, l.339-341). Débité, ajouté à la cale (Enc plafonné par le
 *  plafond DUR de surcharge, MDG 12 l.75 : Contenance × 150 %). Un achat au-delà de la Contenance nominale
 *  AVERTIT du palier de surcharge atteint (#243). Rafraîchit l'offre restante. */
export function portBuyCargo(get: Get, set: Set, cargoId: string, enc: number): void {
  const st = get().port;
  const vessel = get().vessel;
  if (!st || !vessel) return;
  const offer = st.offers.find((o) => o.cargoId === cargoId);
  if (!offer) return;
  const want = Math.max(0, Math.min(Math.floor(enc), offer.enc, vesselMaxLoadEnc(get)));
  if (want <= 0) { log(get, set, ['La cale a atteint le maximum absolu (surcharge de 150 %) ou la cargaison est épuisée — rien à embarquer.']); return; }
  const partial = want < offer.enc;
  const rng = battleRng();
  const best = partyAssisted(get().party, 'marchandage');
  const merchant = rollMerchantSkill(!!st.port.cosmopolite, rng);
  // Test opposé : le vendeur NPC porte ses +DR de vente (lot partiel / Surplus) sur SON DR (l.339-341).
  const sellerDR = buySellerDR(partial, offer.surplus);
  const opp = best ? opposedTest(best.value, merchant.value, rng, 'intermediaire', 'intermediaire') : null;
  let pct = 0; // % appliqué au prix (négatif = remise pour l'acheteur)
  let bargainLine = 'Aucun marchandeur dans le groupe — prix plein.';
  if (opp && best) {
    // +DR de vendeur : ajoutés au DR du NPC (défenseur). Vainqueur re-calculé sur les DR ajustés.
    const buyerSL = opp.attacker.sl;
    const npcSL = opp.defender.sl + sellerDR;
    const buyerWins = buyerSL > npcSL || (buyerSL === npcSL && best.value > merchant.value);
    const netSL = Math.abs(buyerSL - npcSL);
    if (buyerWins) pct = -bargainPct(hasBargainBonus(best.actor), netSL); // remise à l'acheteur
    else if (npcSL > buyerSL) pct = bargainPct(merchant.negotiator, netSL); // le vendeur monte le prix
    bargainLine = `${best.actor.name} — Marchandage (${opp.attacker.roll} vs ${opp.defender.roll}${sellerDR ? `, vendeur +${sellerDR} DR` : ''}) : ${pct === 0 ? 'prix inchangé' : pct < 0 ? `remise de ${-pct} %` : `surcoût de ${pct} %`}.`;
  }
  const price = Math.max(0, Math.round(want * offer.basePrice * (1 + pct / 100)));
  const cost = toMoney({ gold: price });
  if (!canAfford(get().money, cost)) { log(get, set, [`La bourse ne couvre pas ${price} CO de ${offer.label}.`]); return; }
  const cargo: CargoLot = { cargoId, enc: want, basePriceGold: offer.basePrice };
  const nextCargo = [...(vessel.cargo ?? []), cargo];
  set({
    money: subtract(get().money, cost)!,
    vessel: { ...vessel, cargo: nextCargo },
    port: { ...st, freeEnc: Math.max(0, st.freeEnc - want), maxLoadEnc: st.maxLoadEnc - want, offers: st.offers.map((o) => o.cargoId === cargoId ? { ...o, enc: o.enc - want } : o).filter((o) => o.enc > 0) },
  });
  log(get, set, [`${want} Enc de ${offer.label} embarqués — ${bargainLine} Prix payé : ${formatMoney(fromBrass(toBrass(cost)))}.`]);
  // Surcharge de la cale (MDG 12 l.70-75) : au-delà de la Contenance nominale, avertir du palier d'assiette.
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  const over = cargoOverload(cargoTotalEnc(nextCargo), capacity);
  if (over.palierId) log(get, set, [`Cale SURCHARGÉE (${over.ratioPct} % de la Contenance) : ${over.label} — ${over.mMod} M, ${over.manoeuvreDR} DR Manœuvre (MDG 12 l.70-75).`]);
}

/** Ouvre la cascade différée si la cascade EN COURS n'a pas fini de committer son étape (patron
 *  `seaVoyageFlow.ts` `sea-desertion`) — sinon exécute directement (chemin inline/immédiat). */
function chainStep(get: Get, open: () => void): void {
  if (get().pendingCascade) setTimeout(open, 0);
  else open();
}

/** Finalise la vente : gross = Enc × prix de base × Prix d'offre % × (1 + Marchandage %), retire le
 *  lot (ou la fraction vendue) de la cale, crédite la bourse. SOURCE UNIQUE du dénouement, partagée
 *  par le chemin SANS marchandeur (prix d'offre pris tel quel) et l'applier `PORT_SELL_BARGAIN_KIND`.
 *  Renvoie la ligne de journal (vide si l'état a changé entre-temps). */
function finalizePortSale(get: Get, set: Set, cargoIndex: number, sellEnc: number, offerPct: number, bargainPctVal: number, bargainLine: string): string {
  const st = get().port;
  const vessel = get().vessel;
  const lot = vessel?.cargo?.[cargoIndex];
  if (!st || !vessel || !lot) return '';
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  const gross = Math.max(0, Math.round(sellEnc * lot.basePriceGold * (offerPct / 100) * (1 + bargainPctVal / 100)));
  const nextCargo = sellEnc >= lot.enc ? (vessel.cargo ?? []).filter((_, i) => i !== cargoIndex) : (vessel.cargo ?? []).map((l, i) => i === cargoIndex ? { ...l, enc: l.enc - sellEnc } : l);
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  const freed = cargoTotalEnc(nextCargo);
  set({
    money: fromBrass(toBrass(get().money) + gross * PA_PER_CO),
    vessel: { ...vessel, cargo: nextCargo },
    port: { ...st, freeEnc: Math.max(0, capacity - freed), maxLoadEnc: Math.max(0, overloadMaxEnc(capacity) - freed) },
  });
  return `${sellEnc} Enc de ${label} vendus (prix d’offre ${offerPct} % du base — ${bargainLine}) : ${formatMoney(fromBrass(gross * PA_PER_CO))}.`;
}

/** 3. Marchandage opposé (vendeur PJ +DR, l.387-397) — hero-test (`openRoll`) pour le héros ; le
 *  marchand roule via `rollMerchantOpposition` (moteur pur, appelé par l'applier). Sans marchandeur
 *  dans le groupe, la vente se conclut au prix d'offre pris tel quel (aucun jet). */
function openPortSellBargainStep(get: Get, set: Set, cargoIndex: number, sellEnc: number): void {
  const st = get().port;
  const vessel = get().vessel;
  const lot = vessel?.cargo?.[cargoIndex];
  if (!st || !vessel || !lot) return;
  const offerPct = offerPricePct(st.port, lot.cargoId);
  const best = partyAssisted(get().party, 'marchandage');
  // Toujours tiré (même sans marchandeur) — préserve l'ordre des tirages RNG de l'ancienne résolution
  // synchrone (déterminisme seedé conservé, la porte du seam ne touche pas le rng).
  const merchant = rollMerchantSkill(!!st.port.cosmopolite, battleRng());
  if (!best) {
    log(get, set, [finalizePortSale(get, set, cargoIndex, sellEnc, offerPct, 0, 'Aucun marchandeur — prix d’offre pris tel quel.')]);
    return;
  }
  const sellerDR = sellChance(st.port, lot.cargoId, vessel.lastVoyageMilles ?? 0).sellerDR;
  openRoll(get, set, {
    side: { partyBest: { skill: 'marchandage' } },
    test: { skill: 'marchandage', label: 'Marchandage — vente' },
    difficulty: 'intermediaire',
    klass: 'hero-test',
  }, PORT_SELL_BARGAIN_KIND, { cargoIndex, sellEnc, offerPct, merchantValue: merchant.value, merchantNegotiator: merchant.negotiator, sellerDR });
}

const PORT_SELL_BARGAIN_KIND = 'port-sell-bargain';
registerCascadeApplier(PORT_SELL_BARGAIN_KIND, (get, set, step) => {
  if (!step.result) return {};
  const cargoIndex = Number(step.meta?.cargoIndex ?? -1);
  const sellEnc = Number(step.meta?.sellEnc ?? 0);
  const offerPct = Number(step.meta?.offerPct ?? 100);
  const merchantValue = Number(step.meta?.merchantValue ?? 0);
  const merchantNegotiator = !!step.meta?.merchantNegotiator;
  const sellerDR = Number(step.meta?.sellerDR ?? 0);
  const actor = step.actorId ? actorIn(get(), step.actorId) : undefined;
  const heroTR: TestResult = { roll: step.result.roll, target: step.result.target, success: step.result.success, sl: step.result.sl, isDouble: false };
  const merchantRoll = rollMerchantOpposition(merchantValue, battleRng());
  const opp = resolveOpposed(heroTR, merchantRoll);
  const sellerSL = opp.attacker.sl + sellerDR; // +DR du vendeur PJ (l.389-397)
  const buyerSL = opp.defender.sl;
  const sellerWins = sellerSL > buyerSL || (sellerSL === buyerSL && heroTR.target > merchantRoll.target);
  const netSL = Math.abs(sellerSL - buyerSL);
  let bargainPctVal = 0;
  if (sellerWins) bargainPctVal = bargainPct(actor ? hasBargainBonus(actor) : false, netSL); // le PJ monte le prix
  else if (buyerSL > sellerSL) bargainPctVal = -bargainPct(merchantNegotiator, netSL); // l'acheteur le baisse
  const bargainLine = `${actor?.name ?? '?'} — Marchandage (${heroTR.roll} vs ${merchantRoll.roll}${sellerDR ? `, vendeur ${sellerDR > 0 ? '+' : ''}${sellerDR} DR` : ''}) : ${bargainPctVal === 0 ? 'sans effet' : bargainPctVal > 0 ? `+${bargainPctVal} %` : `${bargainPctVal} %`}.`;
  return { consequences: freeCons([finalizePortSale(get, set, cargoIndex, sellEnc, offerPct, bargainPctVal, bargainLine)]) };
});

/** 2. Trouver un acheteur (dé de MONDE, `klass:'subi'`, `worldSide` — l.362) : cible = `chance.target`
 *  (posé en `meta.baseValue`, difficulté Intermédiaire = modificateur nul, la cible passe telle
 *  quelle). Échec sur la 1ʳᵉ tentative SANS Ragot préalable → 2ᵉ tentative sur la moitié du lot
 *  (`attempt:2`) ; le message « la moitié trouve preneur » ne s'affiche QUE si cette 2ᵉ tentative
 *  réussit (parité stricte avec l'ancienne résolution synchrone). */
function openPortSellBuyerStep(get: Get, set: Set, cargoIndex: number, sellEnc: number, allowHalfRetry: boolean, attempt: 1 | 2): void {
  const st = get().port;
  const vessel = get().vessel;
  const lot = vessel?.cargo?.[cargoIndex];
  if (!st || !vessel || !lot) return;
  const milles = vessel.lastVoyageMilles ?? 0;
  const chance = sellChance(st.port, lot.cargoId, milles);
  openRoll(get, set, {
    side: { worldSide: 'world', ownerId: vessel.vehicleId },
    test: { label: 'Recherche d’acheteur' },
    difficulty: 'intermediaire',
    klass: 'subi',
  }, PORT_SELL_BUYER_KIND, { cargoIndex, sellEnc, retryHalf: allowHalfRetry, attempt, baseValue: chance.target });
}

const PORT_SELL_BUYER_KIND = 'port-sell-buyer';
registerCascadeApplier(PORT_SELL_BUYER_KIND, (get, set, step) => {
  if (!step.result) return {};
  const cargoIndex = Number(step.meta?.cargoIndex ?? -1);
  const sellEnc = Number(step.meta?.sellEnc ?? 0);
  const retryHalf = !!step.meta?.retryHalf;
  const attempt = Number(step.meta?.attempt ?? 1);
  const st = get().port;
  const vessel = get().vessel;
  const lot = vessel?.cargo?.[cargoIndex];
  if (!st || !vessel || !lot) return {};
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  if (step.result.success) {
    chainStep(get, () => openPortSellBargainStep(get, set, cargoIndex, sellEnc));
    return attempt === 2 ? { consequences: freeCons([`↔ ${label} : personne pour tout le lot — la moitié (${sellEnc} Enc) trouve preneur.`]) } : {};
  }
  if (attempt === 1 && retryHalf) {
    const half = Math.max(1, Math.floor(lot.enc / 2));
    chainStep(get, () => openPortSellBuyerStep(get, set, cargoIndex, half, false, 2));
    return {};
  }
  return { consequences: freeCons([`${label} : aucun marchand intéressé à ${st.label} (nombre visé ${step.result.target}).`]) };
});

/** 1. Test de Ragot PRÉALABLE éventuel (port qui produit / Surplus, l.366-372, hero-test). Aucun
 *  candidat au Ragot → même message qu'avant, aucun jet à ouvrir. */
const PORT_SELL_GOSSIP_KIND = 'port-sell-gossip';
registerCascadeApplier(PORT_SELL_GOSSIP_KIND, (get, set, step) => {
  if (!step.result) return {};
  const cargoIndex = Number(step.meta?.cargoIndex ?? -1);
  const st = get().port;
  const vessel = get().vessel;
  const lot = vessel?.cargo?.[cargoIndex];
  if (!st || !vessel || !lot) return {};
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  const actor = step.actorId ? actorIn(get(), step.actorId) : undefined;
  if (!step.result.success) {
    return { consequences: freeCons([`${label} — ce port ${sellRelation(st.port, lot.cargoId) === 'surplus' ? 'en regorge' : 'en produit'} : le Test de Ragot (${actor?.name ?? '?'} ${step.result.roll}/${step.result.target}) échoue — aucun acheteur trouvé.`]) };
  }
  chainStep(get, () => openPortSellBuyerStep(get, set, cargoIndex, lot.enc, false, 1));
  return { consequences: freeCons([`${actor?.name ?? 'Le groupe'} — Ragot : ${step.result.roll}/${step.result.target} → un acheteur potentiel est approché.`]) };
});

/** VENTE d'un lot de cargaison (l.351-397) : trouver un acheteur (relation du port au bien),
 *  Prix d'offre (% du prix de base par Richesse+Taille+Demande), Marchandage opposé (vendeur PJ +DR).
 *  Retire le lot vendu de la cale, crédite la bourse. CASCADE (Ragot → acheteur → Marchandage) —
 *  chaque étape routée par la policy M/V/I (cf. docstring d'en-tête). */
export function portSellCargo(get: Get, set: Set, cargoIndex: number): void {
  const st = get().port;
  const vessel = get().vessel;
  if (!st || !vessel) return;
  const lot = (vessel.cargo ?? [])[cargoIndex];
  if (!lot) return;
  const milles = vessel.lastVoyageMilles ?? 0;
  const chance = sellChance(st.port, lot.cargoId, milles);
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;

  if (chance.gossip) {
    const best = partyAssisted(get().party, 'ragot');
    if (!best) {
      log(get, set, [`${label} — ce port ${sellRelation(st.port, lot.cargoId) === 'surplus' ? 'en regorge' : 'en produit'} : le Test de Ragot ne trouve pas de camelot — aucun acheteur trouvé.`]);
      return;
    }
    openRoll(get, set, {
      side: { partyBest: { skill: 'ragot' } },
      test: { skill: 'ragot', label: 'Ragot — recherche d’acheteur' },
      difficulty: chance.gossip.difficulty,
      klass: 'hero-test',
    }, PORT_SELL_GOSSIP_KIND, { cargoIndex });
    return;
  }
  openPortSellBuyerStep(get, set, cargoIndex, lot.enc, true, 1);
}

/** BRADER un lot (l.399) : ¼ du prix de base dans un port « commerce » ou en Demande — sinon refus. */
export function portDumpCargo(get: Get, set: Set, cargoIndex: number): void {
  const st = get().port;
  const vessel = get().vessel;
  if (!st || !vessel) return;
  const lot = (vessel.cargo ?? [])[cargoIndex];
  if (!lot) return;
  const pct = dumpingPricePct(st.port, lot.cargoId);
  const label = findCargoById(lot.cargoId)?.label ?? lot.cargoId;
  if (pct == null) { log(get, set, [`${label} : ce port ne rachète pas les cargaisons à brader (ni « commerce » ni Demande, MDG 15 l.399).`]); return; }
  const gross = Math.max(0, Math.round(lot.enc * lot.basePriceGold * (pct / 100)));
  const nextCargo = (vessel.cargo ?? []).filter((_, i) => i !== cargoIndex);
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  const freed = cargoTotalEnc(nextCargo);
  set({
    money: fromBrass(toBrass(get().money) + gross * PA_PER_CO),
    vessel: { ...vessel, cargo: nextCargo },
    port: { ...st, freeEnc: Math.max(0, capacity - freed), maxLoadEnc: Math.max(0, overloadMaxEnc(capacity) - freed) },
  });
  log(get, set, [`${lot.enc} Enc de ${label} bradés (${pct} % du prix de base) : ${formatMoney(fromBrass(gross * PA_PER_CO))}.`]);
}

/** RECRUTEMENT à quai (#228, escale-hub) : embauche `count` PNJ salariés au rôle `roleId` — fusionné
 *  dans le roster `vessel.crew` (`CrewHire[]`, #216). La solde HEBDOMADAIRE (`crew-roles.json`,
 *  MDG 14 l.293-302) est prélevée à l'entretien (`resolveVesselWeek`) : le moteur ne débite JAMAIS à
 *  l'embauche (aucune avance dans le modèle), la bourse ne bouge pas ici. Un rôle sans barème (`wage`
 *  absent) n'est pas recrutable. Renvoie le journal (ligne de solde totale recalculée). */
export function portHireCrew(get: Get, set: Set, roleId: string, count = 1): string[] {
  const vessel = get().vessel;
  if (!vessel || count <= 0) return [];
  const role = findCrewRoleById(roleId);
  if (!role?.wage) return [];
  const crew = vessel.crew ?? [];
  const next = crew.some((h) => h.roleId === roleId)
    ? crew.map((h) => h.roleId === roleId ? { ...h, count: h.count + count } : h)
    : [...crew, { roleId, count }];
  set({ vessel: { ...vessel, crew: next } });
  const lines = [`${count} ${role.label} embauché(s) à ${formatMoney(priceToMoney(role.wage.weekly))}/semaine — solde hebdomadaire de l'équipage : ${formatMoney(fromBrass(weeklyCrewWageBrass(next)))}.`];
  log(get, set, lines);
  return lines;
}

/** DÉBARQUEMENT d'un membre salarié à quai (#228) : retire `count` PNJ du rôle `roleId` (poste supprimé
 *  s'il tombe à 0). Aucune indemnité modélisée (le moteur ne débite qu'à la paie). Renvoie le journal. */
export function portDismissCrew(get: Get, set: Set, roleId: string, count = 1): string[] {
  const vessel = get().vessel;
  if (!vessel || count <= 0) return [];
  const crew = vessel.crew ?? [];
  const cur = crew.find((h) => h.roleId === roleId);
  if (!cur) return [];
  const left = cur.count - count;
  const next = left > 0 ? crew.map((h) => h.roleId === roleId ? { ...h, count: left } : h) : crew.filter((h) => h.roleId !== roleId);
  set({ vessel: { ...vessel, crew: next } });
  const role = findCrewRoleById(roleId);
  const lines = [`${Math.min(count, cur.count)} ${role?.label ?? roleId} débarqué(s) — solde hebdomadaire de l'équipage : ${formatMoney(fromBrass(weeklyCrewWageBrass(next)))}.`];
  log(get, set, lines);
  return lines;
}

// Ré-exports des services de coque (déjà dans seaVoyageFlow) — l'écran Port les appelle par le store.
export { portRepairVessel, portCareenVessel, portInstallUpgrade } from './seaVoyageFlow';

/** Bande de prix par LIEU pour l'affichage (place courante fournie). PUR. */
export function portPlaceLabel(get: Get, placeId: string): string {
  const map = get().worldMap;
  return (map && placeById(map, placeId)?.label) || placeId;
}
