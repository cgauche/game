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
 * à l'achat, `sellChance.sellerDR` à la vente) s'ajoutent au DR de LEUR camp. Résolution SYNCHRONE
 * (pas de modale de jet différée) : le prix modulé et son jet sont journalisés — même patron que
 * `portRepairVessel` (lignes rendues).
 */
import { battleRng } from './battleRng';
import { placeOfScene, placeById } from './worldMap';
import { partyAssisted } from '../engine/skills';
import { opposedTest, rollTest, SL_ASTOUNDING } from '../engine/tests';
import { d100 } from '../engine/dice';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import { toBrass, fromBrass, formatMoney, PA_PER_CO, canAfford, subtract, toMoney, priceToMoney } from '../engine/money';
import { findVehicleById, findCrewRoleById } from '../data';
import { weeklyCrewWageBrass } from '../engine/crewMorale';
import {
  rollCargoAvailability, rollMerchantSkill, buySellerDR, cargoBasePrice, rollRandomCargo,
  sellChance, offerPricePct, sellRelation, dumpingPricePct, cargoTotalEnc, findCargoById,
  cargoOverload, overloadMaxEnc,
  type PortProfile, type CargoLot,
} from '../engine/seaVoyage';
import { seasonOfMonth } from '../engine/travelStages';
import { toDate } from '../engine/clock';
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

const log = (get: Get, set: Set, lines: string[]) => {
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

/** VENTE d'un lot de cargaison (l.351-397) : trouver un acheteur (relation du port au bien),
 *  Prix d'offre (% du prix de base par Richesse+Taille+Demande), Marchandage opposé (vendeur PJ +DR).
 *  Retire le lot vendu de la cale, crédite la bourse. */
export function portSellCargo(get: Get, set: Set, cargoIndex: number): void {
  const st = get().port;
  const vessel = get().vessel;
  if (!st || !vessel) return;
  const lot = (vessel.cargo ?? [])[cargoIndex];
  if (!lot) return;
  const cargo = findCargoById(lot.cargoId);
  const rng = battleRng();
  const milles = vessel.lastVoyageMilles ?? 0;
  const chance = sellChance(st.port, lot.cargoId, milles);
  const label = cargo?.label ?? lot.cargoId;

  // 1. Test de Ragot PRÉALABLE éventuel (port qui produit / Surplus, l.366-372).
  if (chance.gossip) {
    const best = partyAssisted(get().party, 'ragot');
    const t = best ? rollTest(best.value, chance.gossip.difficulty, rng) : null;
    if (!t?.success) {
      log(get, set, [`${label} — ce port ${sellRelation(st.port, lot.cargoId) === 'surplus' ? 'en regorge' : 'en produit'} : le Test de Ragot ${best ? `échoue (${t!.roll}/${t!.target})` : 'ne trouve pas de camelot'} — aucun acheteur trouvé.`]);
      return;
    }
    log(get, set, [`${best!.actor.name} — Ragot : ${t.roll}/${t.target} → un acheteur potentiel est approché.`]);
  }

  // 2. Trouver un acheteur (d100 ≤ nombre visé, l.362). Échec → proposer la moitié une fois.
  let sellEnc = lot.enc;
  let found = d100(rng) <= chance.target;
  if (!found && chance.gossip == null) {
    sellEnc = Math.max(1, Math.floor(lot.enc / 2));
    found = d100(rng) <= chance.target;
    if (found) log(get, set, [`↔ ${label} : personne pour tout le lot — la moitié (${sellEnc} Enc) trouve preneur.`]);
  }
  if (!found) { log(get, set, [`${label} : aucun marchand intéressé à ${st.label} (nombre visé ${chance.target}).`]); return; }

  // 3. Prix d'offre (% du prix de base, l.376-383) puis Marchandage opposé (vendeur PJ +DR, l.387-397).
  const offerPct = offerPricePct(st.port, lot.cargoId);
  const best = partyAssisted(get().party, 'marchandage');
  const merchant = rollMerchantSkill(!!st.port.cosmopolite, rng);
  let bargainPctVal = 0;
  let bargainLine = 'Aucun marchandeur — prix d’offre pris tel quel.';
  if (best) {
    const opp = opposedTest(best.value, merchant.value, rng, 'intermediaire', 'intermediaire');
    const sellerSL = opp.attacker.sl + chance.sellerDR; // +DR du vendeur PJ (l.389-397)
    const buyerSL = opp.defender.sl;
    const sellerWins = sellerSL > buyerSL || (sellerSL === buyerSL && best.value > merchant.value);
    const netSL = Math.abs(sellerSL - buyerSL);
    if (sellerWins) bargainPctVal = bargainPct(hasBargainBonus(best.actor), netSL); // le PJ monte le prix
    else if (buyerSL > sellerSL) bargainPctVal = -bargainPct(merchant.negotiator, netSL); // l'acheteur le baisse
    bargainLine = `${best.actor.name} — Marchandage (${opp.attacker.roll} vs ${opp.defender.roll}${chance.sellerDR ? `, vendeur ${chance.sellerDR > 0 ? '+' : ''}${chance.sellerDR} DR` : ''}) : ${bargainPctVal === 0 ? 'sans effet' : bargainPctVal > 0 ? `+${bargainPctVal} %` : `${bargainPctVal} %`}.`;
  }
  const gross = Math.max(0, Math.round(sellEnc * lot.basePriceGold * (offerPct / 100) * (1 + bargainPctVal / 100)));
  const nextCargo = sellEnc >= lot.enc ? (vessel.cargo ?? []).filter((_, i) => i !== cargoIndex) : (vessel.cargo ?? []).map((l, i) => i === cargoIndex ? { ...l, enc: l.enc - sellEnc } : l);
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  const freed = cargoTotalEnc(nextCargo);
  set({
    money: fromBrass(toBrass(get().money) + gross * PA_PER_CO),
    vessel: { ...vessel, cargo: nextCargo },
    port: { ...st, freeEnc: Math.max(0, capacity - freed), maxLoadEnc: Math.max(0, overloadMaxEnc(capacity) - freed) },
  });
  log(get, set, [`${sellEnc} Enc de ${label} vendus (prix d’offre ${offerPct} % du base — ${bargainLine}) : ${formatMoney(fromBrass(gross * PA_PER_CO))}.`]);
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
