/**
 * Actions MARCHAND (#2, LDB 59/60) extraites de store.ts pour le garder navigable — même patron
 * `(get, set)` que combatFlow : ouverture/réassort, panier, achat/vente/réparation, Marchandage
 * (Test opposé), Évaluation. Refacto pure — comportement préservé.
 */
import type { GameState } from './store';
import { Combatant, ItemInstance } from '../engine/types';
import { recomputeLoadout, itemFromTrappingById, addItemToHero } from '../engine/items';
import { isRepairable, itemRepairCostBrass } from '../engine/repair';
import { bargainBuyFactor, bargainSellFactor } from '../engine/bargain';
import { SL_ASTOUNDING } from '../engine/tests';
import { craftPriceFactor, shiftAvailability } from '../engine/qualities/craftEconomy';
import { rule } from '../engine/policy';
import { partyAssisted } from '../engine/skills';
import { hasBargainBonus } from '../engine/combatFeatures/dispatch';
import { appraiseEstimate } from '../engine/appraisal';
import { makeRNG } from '../engine/dice';
import { rollStock, fullStock, availabilitySearchBonus, barterRatio, availabilityAfterHalvings, priceAfterHalvings, type Settlement, type CatalogItem } from '../engine/disponibilite';
import type { Availability } from '../engine/types';
import { priceToMoney, subtract as moneySub, add as moneyAdd, canAfford, fromBrass, toBrass, formatMoney, statusBudgetBrass, type StatusTier } from '../engine/money';
import { actorStatus } from '../engine/social';
import { MINUTES_PER_DAY } from '../engine/clock';
import { findTrappingById, findCareerById, trappings } from '../data/index';
import { slugId } from '../data/slug';
import { MERCHANTS } from './merchants/index';
import { describeBargain } from './flowOutcomes';

import type { Get, Set } from './flowTypes';

/** Issue d'un Marchandage conclu (achat OU vente) — module les prix de la visite. */
export interface BargainOutcome {
  won: boolean;
  drNet: number;
  negotiator: boolean;
}

/** Boutique OUVERTE (état de la visite en cours). Le stock persistant vit dans `merchantStocks`. */
export interface MerchantState {
  entityId: string;
  archetype: string;
  settlement: Settlement;
  resaleRate: number;
  buyMarkup?: number;
  /** Stock & panier keyés par `trappingId` (`TrappingData.id`) — le libellé est résolu à l'affichage. */
  stock: { id: string; qty: number }[];
  bargainBuy?: BargainOutcome | null;
  bargainSell?: BargainOutcome | null;
  /** Botch (« rater de beaucoup », LDB 60 l.12) : le marchand se méfie — plus de marchandage cette visite. */
  soured?: boolean;
  cart: { id: string; qty: number }[];
  /** Panier de VENTE (#22b) : instances d'objets sélectionnées chez leur porteur, vendues d'un coup
   *  (`confirmSell`) — parité avec le panier d'achat. Une instance est unique (pas de quantité). */
  sellCart?: { uid: string; heroId: string }[];
  /** « Baisse des prix » (LDB 59 l.60) : par instance vendue, nombre de fois où le vendeur divise son
   *  prix par deux pour trouver un acheteur (chaque division monte la Disponibilité d'un cran). */
  sellHalvings?: Record<string, number>;
  pendingDistribution?: { item: ItemInstance; heroId: string }[] | null;
  bargainLocked: boolean;
  bargainPaid?: boolean;
  bargainSellUsed?: boolean;
}

/** Stock PERSISTANT par marchand (la déplétion survit aux visites ; réassort par l'horloge, #T3). */
export type MerchantStocks = Record<string, { stock: { id: string; qty: number }[]; rolledAt: number; bargainLocked?: boolean }>;

/** Prix listé d'un objet en sous de cuivre (catalogue × qualité d'artisanat) — la référence du seuil
 *  « Tenir les comptes » ET du Troc (avant majoration/Marchandage). null (0) si prix non chiffré. */
function listedBrassOf(t: { price: { gold?: number; silver?: number; bronze?: number }; qualities?: unknown[] }): number {
  const b = toBrass(priceToMoney(t.price)) * craftPriceFactor({ qualities: t.qualities as never });
  return Number.isFinite(b) ? Math.round(b) : 0;
}

/** Meilleur seuil « Tenir les comptes » du groupe (LDB 59 l.9-11) : le plus haut budget de Statut
 *  (Bronze N = N sous / Argent N = N pistoles / Or N = N couronnes) parmi les héros — le membre le plus
 *  huppé couvre les achats courants. Consomme `statusBudgetBrass` (engine/money). */
function partyStatusBudgetBrass(party: Combatant[]): number {
  let best = 0;
  for (const h of party) {
    const st = actorStatus(h);
    best = Math.max(best, statusBudgetBrass(st.tier.toLowerCase() as StatusTier, st.standing));
  }
  return best;
}

/** « Tenir les comptes » (LDB 59 l.9-11, option `market-tenir-comptes`) : un objet dont le prix listé
 *  est ≤ au niveau de Statut du groupe s'achète « autant de fois que nécessaire », sans débit. */
function comptesFree(party: Combatant[], listedBrass: number): boolean {
  return !!rule('market-tenir-comptes') && listedBrass > 0 && listedBrass <= partyStatusBudgetBrass(party);
}

/** Bonus de recherche de Disponibilité du groupe (LDB 59 l.50) : +10 si un héros a une Carrière
 *  cohérente (« Marchand ou Receleur », l.50). Le +10 « assidu » et le +10 « journée entière + Ragot »
 *  restent des circonstances de scène (non auto-déclenchées ici — pas de sous-système « passer la
 *  journée »). Renvoie le % à ajouter aux Tests de Disponibilité du stock. */
function partyAvailabilityBonus(party: Combatant[]): number {
  const coherent = party.some((h) => /marchand|receleur/i.test(findCareerById(h.career ?? '')?.label ?? ''));
  return availabilitySearchBonus({ coherentCareer: coherent });
}

export function openMerchant(get: Get, set: Set, entityId: string): void {
  const ent = get().scene?.entities.find((e) => e.id === entityId);
  if (!ent?.merchant) return;
  const arch = MERCHANTS[ent.merchant.archetype];
  if (!arch) { get().log(`Archétype marchand inconnu : « ${ent.merchant.archetype} ».`); return; }
  const settlement: Settlement = ent.merchant.settlement ?? arch.settlement;
  const resaleRate = ent.merchant.resaleRate ?? arch.resaleRate;
  const buyMarkup = ent.merchant.buyMarkup ?? arch.buyMarkup ?? 1; // majoration d’achat (1 = prix listé ; >1 = vend plus cher)
  const restockPeriod = (ent.merchant.restockDays ?? arch.restockDays ?? 1) * MINUTES_PER_DAY; // réassort (#T3)
  const now = get().gameTime;
  const prev = get().merchantStocks[entityId];
  // Re-stock dans le temps (#T3) : on conserve le stock DÉPLÉTÉ entre visites ; on ne re-tire un stock
  // FRAIS (nouvelle Disponibilité) que si `restockPeriod` s'est écoulé depuis le dernier tirage.
  // Règles optionnelles « Marché » (LDB 59/60) : Guildes d'Artisans (Atouts/Défauts inversent la
  // Disponibilité) ; système simplifié (pas de Test de Disponibilité) ; cf. `market-guild`/`market-mode`.
  const guild = !!rule('market-guild');
  const marketMode = rule('market-mode') as string;
  let stock = prev?.stock;
  if (!prev || now - prev.rolledAt >= restockPeriod) {
    const cat: CatalogItem[] = trappings
      .filter((t) => (!arch.category.types || arch.category.types.includes(t.type)) && (!arch.category.subTypes || (t.subType != null && arch.category.subTypes.includes(t.subType))))
      .map((t) => {
        const base = (t.availability as CatalogItem['availability']) ?? null;
        const av = guild && base ? shiftAvailability(base, { qualities: t.qualities }, { guild: true }) : base;
        return { id: t.id, label: t.label, availability: av };
      });
    // Seed dérivé de l'entité ET de la PÉRIODE de réassort → chaque réassort a un stock frais déterministe.
    const period = Math.floor(now / restockPeriod);
    const seed = [...`${entityId}:${period}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) >>> 0;
    // Recherche active (LDB 59 l.50) : Carrière cohérente (Marchand/Receleur) du groupe → +10 % aux
    // Tests de Disponibilité (sans effet sur le système simplifié « tout en stock »).
    const dispoBonus = partyAvailabilityBonus(get().party);
    const lines = marketMode === 'sans-disponibilite' || marketMode === 'simplifie'
      ? fullStock(cat, settlement, makeRNG(seed))
      : rollStock(cat, settlement, makeRNG(seed), arch.curated, dispoBonus);
    stock = lines.map((l) => ({ id: l.id, qty: l.qty }));
    const tested = lines.filter((l) => l.test);
    if (tested.length) get().log(`Marché (${settlement}) : ${tested.map((l) => `${l.label} ✔×${l.qty}`).join(', ')}.`);
    set((s) => ({ merchantStocks: { ...s.merchantStocks, [entityId]: { stock: stock!, rolledAt: now, bargainLocked: false } } })); // réassort → on peut de nouveau marchander
  }
  const persisted = get().merchantStocks[entityId];
  set({ merchant: { entityId, archetype: ent.merchant.archetype, settlement, resaleRate, buyMarkup, stock: stock!, cart: [], bargainLocked: persisted?.bargainLocked ?? false } });
}

export function closeMerchant(get: Get, set: Set): void {
  const m = get().merchant;
  // Négocié mais NON honoré (achat non payé, OU vente sans rien vendre) → verrou partagé jusqu'au réassort.
  const renege = !!m && ((m.bargainBuy != null && !m.bargainPaid) || (m.bargainSell != null && !m.bargainSellUsed));
  if (m && renege) {
    set((s) => ({ merchantStocks: { ...s.merchantStocks, [m.entityId]: { ...s.merchantStocks[m.entityId], bargainLocked: true } } }));
    get().log('Vous quittez sans conclure le marché : le marchand refuse de re-marchander (achat ni vente) jusqu’à son prochain réassort.');
  }
  get().confirmDistribution(); // ne pas perdre les objets payés non répartis
  set({ merchant: null });
}

export function buyItem(get: Get, set: Set, id: string, heroId?: string): void {
  const m = get().merchant; if (!m) return;
  const line = m.stock.find((l) => l.id === id); if (!line || line.qty <= 0) return;
  const t = findTrappingById(id); if (!t) return;
  const factor = m.bargainBuy ? bargainBuyFactor(m.bargainBuy.won, m.bargainBuy.drNet, m.bargainBuy.negotiator) : 1;
  // « Tenir les comptes » (LDB 59 l.9-11) : objet ≤ Statut du groupe → acquis sans compter les pièces.
  const free = comptesFree(get().party, listedBrassOf(t));
  const cost = free ? fromBrass(0) : fromBrass(Math.round(toBrass(priceToMoney(t.price)) * craftPriceFactor({ qualities: t.qualities }) * (m.buyMarkup ?? 1) * factor));
  if (!free && !canAfford(get().money, cost)) { get().log(`Bourse insuffisante pour ${t.label}.`); return; }
  const it = itemFromTrappingById(id); if (!it) return;
  const dest = heroId ?? get().party[0]?.id;
  const decr = (st: { id: string; qty: number }[]) => st.map((l) => (l.id === id ? { ...l, qty: l.qty - 1 } : l));
  set((s) => {
    const newStock = decr(s.merchant!.stock);
    const eid = s.merchant!.entityId;
    const persisted = s.merchantStocks[eid];
    return {
      money: moneySub(s.money, cost)!,
      party: s.party.map((h) => (h.id === dest ? addItemToHero(h, id) : h)), // flux objet→héros mutualisé

      merchant: { ...s.merchant!, stock: newStock },
      // Déplétion PERSISTANTE (#T3) : la quantité reste réduite entre visites (rolledAt inchangé).
      merchantStocks: { ...s.merchantStocks, [eid]: { stock: newStock, rolledAt: persisted?.rolledAt ?? s.gameTime } },
    };
  });
  get().log(free ? `Achat : ${t.label} (dans les moyens du Statut du groupe — Tenir les comptes).` : `Achat : ${t.label}.`);
}

export function addToCart(_get: Get, set: Set, id: string): void {
  set((s) => {
    const m = s.merchant; if (!m || m.bargainBuy != null) return {}; // marché conclu → panier scellé
    const stockQty = m.stock.find((l) => l.id === id)?.qty ?? 0;
    const cart = m.cart ?? [];
    const cur = cart.find((c) => c.id === id)?.qty ?? 0;
    if (cur >= stockQty) return {}; // jamais plus que le stock disponible
    const next = cart.some((c) => c.id === id)
      ? cart.map((c) => (c.id === id ? { ...c, qty: c.qty + 1 } : c))
      : [...cart, { id, qty: 1 }];
    return { merchant: { ...m, cart: next } };
  });
}

// Retrait TOUJOURS permis (même après Marchandage : « j'en prends un de moins car je n'ai que 5€ »).
export function decFromCart(_get: Get, set: Set, id: string): void {
  set((s) => {
    const m = s.merchant; if (!m) return {};
    const next = (m.cart ?? []).map((c) => (c.id === id ? { ...c, qty: c.qty - 1 } : c)).filter((c) => c.qty > 0);
    return { merchant: { ...m, cart: next } };
  });
}

export function removeFromCart(_get: Get, set: Set, id: string): void {
  set((s) => (s.merchant ? { merchant: { ...s.merchant, cart: (s.merchant.cart ?? []).filter((c) => c.id !== id) } } : {}));
}

export function clearCart(_get: Get, set: Set): void {
  set((s) => (s.merchant ? { merchant: { ...s.merchant, cart: [] } } : {}));
}

export function refuseBargain(get: Get, set: Set, mode: 'buy' | 'sell'): void {
  const m = get().merchant; if (!m || (mode === 'buy' ? m.bargainBuy : m.bargainSell) == null) return;
  // Refuser une négociation → annule ce côté + VERROU PARTAGÉ (plus de marchandage achat NI vente jusqu'au réassort).
  const patch = mode === 'buy' ? { cart: [], bargainBuy: null } : { bargainSell: null };
  set((s) => ({
    merchant: { ...s.merchant!, ...patch, bargainLocked: true },
    merchantStocks: { ...s.merchantStocks, [m.entityId]: { ...s.merchantStocks[m.entityId], bargainLocked: true } },
  }));
  get().log('Vous refusez le marché ; le marchand ne marchandera plus (ni achat ni vente) jusqu’à son prochain réassort.');
}

export function payCart(get: Get, set: Set): void {
  const m = get().merchant; if (!m) return;
  const cart = m.cart ?? []; if (!cart.length) return;
  const factor = m.bargainBuy ? bargainBuyFactor(m.bargainBuy.won, m.bargainBuy.drNet, m.bargainBuy.negotiator) : 1;
  const party = get().party;
  // « Tenir les comptes » (LDB 59 l.9-11) : une ligne ≤ Statut du groupe n'est pas comptée (0 sc).
  const unitBrass = (id: string) => {
    const t = findTrappingById(id); if (!t) return 0;
    if (comptesFree(party, listedBrassOf(t))) return 0;
    return Math.round(toBrass(priceToMoney(t.price)) * craftPriceFactor({ qualities: t.qualities }) * (m.buyMarkup ?? 1) * factor);
  };
  let totalBrass = 0;
  for (const c of cart) totalBrass += unitBrass(c.id) * c.qty;
  const total = fromBrass(totalBrass);
  if (!canAfford(get().money, total)) { get().log('Bourse insuffisante pour payer le panier.'); return; }
  // Crée les objets achetés (par UNITÉ) en attente de répartition + déplète le stock.
  const dest = get().party[0]?.id ?? '';
  const staged: { item: ItemInstance; heroId: string }[] = [];
  let newStock = m.stock;
  for (const c of cart) {
    for (let i = 0; i < c.qty; i++) { const it = itemFromTrappingById(c.id); if (it) staged.push({ item: it, heroId: dest }); }
    newStock = newStock.map((l) => (l.id === c.id ? { ...l, qty: Math.max(0, l.qty - c.qty) } : l));
  }
  const count = cart.reduce((a, c) => a + c.qty, 0);
  set((s) => {
    const eid = s.merchant!.entityId;
    const persisted = s.merchantStocks[eid];
    return {
      money: moneySub(s.money, total)!,
      // bargainPaid : le marché est SCELLÉ (payé) → pas de blocage du Marchandage au départ.
      merchant: { ...s.merchant!, stock: newStock, cart: [], pendingDistribution: staged, bargainPaid: true },
      merchantStocks: { ...s.merchantStocks, [eid]: { ...persisted, stock: newStock, rolledAt: persisted?.rolledAt ?? s.gameTime } },
    };
  });
  get().log(`Payé : ${formatMoney(total)} (${count} article${count > 1 ? 's' : ''}).`);
}

export function assignDistribution(_get: Get, set: Set, index: number, heroId: string): void {
  set((s) => {
    const m = s.merchant; if (!m?.pendingDistribution) return {};
    const pd = m.pendingDistribution.map((d, i) => (i === index ? { ...d, heroId } : d));
    return { merchant: { ...m, pendingDistribution: pd } };
  });
}

export function confirmDistribution(_get: Get, set: Set): void {
  set((s) => {
    const m = s.merchant; const dist = m?.pendingDistribution; if (!m || !dist || !dist.length) return {};
    const byHero: Record<string, ItemInstance[]> = {};
    for (const d of dist) (byHero[d.heroId] ??= []).push(d.item);
    const party = s.party.map((h) => {
      const add = byHero[h.id]; if (!add) return h;
      const clone: Combatant = structuredClone(h);
      clone.items = [...(clone.items ?? []), ...add.map((it) => ({ ...it, equipped: false }))];
      recomputeLoadout(clone);
      return clone;
    });
    return { party, merchant: { ...m, pendingDistribution: null } };
  });
}

/** Gain de revente d'un objet (catalogue × qualité × resaleRate × facteur de Marchandage). SOURCE UNIQUE
 *  du prix de vente — partagée par `sellItem`, `confirmSell` ET l'aperçu UI (pas de formule dupliquée).
 *  Option 2 (LDB 60 l.22) : ¼ par défaut (resaleRate/2) ; ½ si le Marchandage de vente est GAGNÉ. */
export function sellGain(item: ItemInstance, m: MerchantState): ReturnType<typeof fromBrass> {
  const sellFactor = m.bargainSell ? bargainSellFactor(m.bargainSell.won, m.bargainSell.drNet, m.bargainSell.negotiator) : 0.5;
  // « Baisse des prix » (LDB 59 l.60) : chaque division du prix par deux monte la Disponibilité d'un
  // acheteur d'un cran — appliquée au gain FINAL (le vendeur accepte moins pour écouler un objet rare).
  const halve = (b: number) => priceAfterHalvings(b, m.sellHalvings?.[item.uid] ?? 0);
  // Objet PRÉ-VALUÉ (pièces de monstre récoltées, ZI Précieuses Entrailles) : sa valeur de marché est
  // déjà nette (rareté × dangerosité × Taille × Conservation) → revendu en DIRECT, sans le taux de revente
  // catalogue. Le Marchandage de vente joue quand même (sellFactor/0.5 : ×1 par défaut, ×plus si gagné).
  if (item.price) return fromBrass(halve(Math.round(toBrass(item.price) * (sellFactor / 0.5))));
  const t = item.trappingId ? findTrappingById(item.trappingId) : undefined;
  const base = t ? toBrass(priceToMoney(t.price)) * craftPriceFactor(item) : 0;
  return fromBrass(halve(Math.round(base * m.resaleRate * sellFactor)));
}

/** Disponibilité d'un ACHETEUR pour un objet vendu (LDB 59 l.52-62) : sa Disponibilité catalogue montée
 *  d'un cran par baisse de prix consentie (`halvings`). Sert d'affichage au vendeur (plus le cran est
 *  bon, plus un acheteur se trouve vite). `Commune` par défaut si l'objet n'a pas de Disponibilité. */
export function sellBuyerAvailability(item: ItemInstance, halvings: number): Availability {
  const t = item.trappingId ? findTrappingById(item.trappingId) : undefined;
  const av = t?.availability;
  const base: Availability = av === 'Commune' || av === 'Limitée' || av === 'Rare' || av === 'Exotique' ? av : 'Commune';
  return availabilityAfterHalvings(base, halvings);
}

/** « Baisse des prix » (LDB 59 l.60) : (dé)crémente le nombre de divisions par deux consenties pour
 *  l'instance `uid` (0..4). Améliore la Disponibilité de l'acheteur, réduit le gain (via `sellGain`). */
export function setSellHalving(get: Get, set: Set, uid: string, delta: number): void {
  const m = get().merchant; if (!m) return;
  const cur = m.sellHalvings?.[uid] ?? 0;
  const next = Math.max(0, Math.min(4, cur + delta));
  set({ merchant: { ...m, sellHalvings: { ...(m.sellHalvings ?? {}), [uid]: next } } });
}

// ── Troc (LDB 59 l.64-76) ───────────────────────────────────────────────────────────────────────
/** Disponibilité d'un trapping pour le Troc (Commune si absente/non chiffrée). */
function availabilityOf(id: string): Availability {
  const av = findTrappingById(id)?.availability;
  return av === 'Commune' || av === 'Limitée' || av === 'Rare' || av === 'Exotique' ? av : 'Commune';
}

export interface BarterQuote {
  ratio: { give: number; get: number };
  giveAv: Availability;
  getAv: Availability;
  /** Unités du bien DONNÉ requises pour acquérir `getCount` unités du bien acquis (lots de valeur ~égale
   *  × premium de rareté du ratio, LDB 59 l.66-76). */
  giveCount: number;
}

/** Devis de Troc (LDB 59 l.64-76) : combien d'unités du bien DONNÉ (`giveId`) contre `getCount` unités
 *  du bien ACQUIS (`getId`). Constitue « deux lots de valeur approximativement équivalente » (prix
 *  listés, l.66) puis applique le RATIO de rareté (`barterRatio`). null si un prix manque. */
export function barterQuote(giveId: string, getId: string, getCount = 1): BarterQuote | null {
  const giveT = findTrappingById(giveId), getT = findTrappingById(getId);
  if (!giveT || !getT) return null;
  const givePrice = listedBrassOf(giveT), getPrice = listedBrassOf(getT);
  if (givePrice <= 0 || getPrice <= 0) return null;
  const giveAv = availabilityOf(giveId), getAv = availabilityOf(getId);
  const ratio = barterRatio(giveAv, getAv);
  // Lots de valeur équivalente (l.66) puis premium de rareté : valeur à donner = valeur acquise × give/get.
  const giveValue = getCount * getPrice * (ratio.give / ratio.get);
  return { ratio, giveAv, getAv, giveCount: Math.max(1, Math.ceil(giveValue / givePrice)) };
}

/** Exécute un Troc (LDB 59 l.64) : le héros `giveHeroId` cède `giveCount` exemplaires du trapping
 *  `giveTrappingId` (SANS argent) contre `getCount` exemplaires du stock `getStockId`. Refuse si le
 *  héros n'a pas les exemplaires ou si le stock est insuffisant. Réutilise les flux objet existants. */
export function barterExchange(get: Get, set: Set, opts: { giveHeroId: string; giveTrappingId: string; getStockId: string; getCount?: number }): void {
  const m = get().merchant; if (!m) return;
  const getCount = Math.max(1, Math.floor(opts.getCount ?? 1));
  const quote = barterQuote(opts.giveTrappingId, opts.getStockId, getCount);
  if (!quote) { get().log('Troc impossible : objet sans prix de référence.'); return; }
  const hero = get().party.find((h) => h.id === opts.giveHeroId);
  const stockLine = m.stock.find((l) => l.id === opts.getStockId);
  if (!hero || !stockLine) return;
  // Exemplaires cédés : instances NON équipées du même trapping chez ce héros.
  const givable = (hero.items ?? []).filter((i) => i.trappingId === opts.giveTrappingId && !i.equipped);
  if (givable.length < quote.giveCount) { get().log(`Troc : il faut ${quote.giveCount} × ${findTrappingById(opts.giveTrappingId)?.label ?? '?'} à céder (${givable.length} disponible(s)).`); return; }
  if (stockLine.qty < getCount) { get().log('Troc : stock insuffisant chez le marchand.'); return; }
  const soldUids = givable.slice(0, quote.giveCount).map((i) => i.uid);
  const newStock = m.stock.map((l) => (l.id === opts.getStockId ? { ...l, qty: l.qty - getCount } : l));
  set((s) => {
    const eid = s.merchant!.entityId;
    const persisted = s.merchantStocks[eid];
    return {
      party: s.party.map((h) => {
        if (h.id !== opts.giveHeroId) return h;
        let clone: Combatant = structuredClone(h);
        clone.items = (clone.items ?? []).filter((i) => !soldUids.includes(i.uid)); // biens cédés
        for (let i = 0; i < getCount; i++) clone = addItemToHero(clone, opts.getStockId); // biens acquis
        return clone;
      }),
      merchant: { ...s.merchant!, stock: newStock },
      merchantStocks: { ...s.merchantStocks, [eid]: { stock: newStock, rolledAt: persisted?.rolledAt ?? s.gameTime } },
    };
  });
  get().log(`Troc : ${quote.giveCount} × ${findTrappingById(opts.giveTrappingId)?.label ?? '?'} contre ${getCount} × ${findTrappingById(opts.getStockId)?.label ?? '?'} (${quote.giveAv} ${quote.ratio.give}:${quote.ratio.get} ${quote.getAv}).`);
}

/** Retire de `party` (clone + recompute) les instances `entries` (uid+heroId) et renvoie la nouvelle liste. */
function removeSold(party: Combatant[], entries: { uid: string; heroId: string }[]): Combatant[] {
  return party.map((h) => {
    const uids = entries.filter((e) => e.heroId === h.id).map((e) => e.uid);
    if (!uids.length) return h;
    const clone: Combatant = structuredClone(h);
    clone.items = (clone.items ?? []).filter((i) => !uids.includes(i.uid));
    recomputeLoadout(clone);
    return clone;
  });
}

/** Vente immédiate d'un objet (conservée : API + tests). Délègue le prix à `sellGain`. */
export function sellItem(get: Get, set: Set, uid: string, heroId: string): void {
  const m = get().merchant; if (!m) return;
  const hero = get().party.find((h) => h.id === heroId);
  const item = hero?.items?.find((i) => i.uid === uid); if (!item) return;
  const gain = sellGain(item, m);
  set((s) => ({
    money: moneyAdd(s.money, gain),
    // bargainSellUsed : une vente a eu lieu → la négociation de vente est HONORÉE (pas de verrou au départ).
    merchant: s.merchant ? { ...s.merchant, bargainSellUsed: true } : s.merchant,
    party: removeSold(s.party, [{ uid, heroId }]),
  }));
  get().log(`Vente : ${item.name}.`);
}

export function addToSellCart(_get: Get, set: Set, uid: string, heroId: string): void {
  set((s) => {
    const m = s.merchant; if (!m) return {};
    const cart = m.sellCart ?? [];
    if (cart.some((c) => c.uid === uid)) return {}; // instance unique : déjà au panier
    return { merchant: { ...m, sellCart: [...cart, { uid, heroId }] } };
  });
}

export function removeFromSellCart(_get: Get, set: Set, uid: string): void {
  set((s) => (s.merchant ? { merchant: { ...s.merchant, sellCart: (s.merchant.sellCart ?? []).filter((c) => c.uid !== uid) } } : {}));
}

export function clearSellCart(_get: Get, set: Set): void {
  set((s) => (s.merchant ? { merchant: { ...s.merchant, sellCart: [] } } : {}));
}

/** Conclut la vente du panier (parité achat/`payCart`) : crédite la somme des `sellGain`, retire les
 *  objets de leurs porteurs, honore la négociation de vente. Réutilise `sellGain`/`removeSold`. */
export function confirmSell(get: Get, set: Set): void {
  const m = get().merchant; if (!m) return;
  const cart = m.sellCart ?? []; if (!cart.length) return;
  let gain = fromBrass(0);
  const names: string[] = [];
  for (const c of cart) {
    const item = get().party.find((h) => h.id === c.heroId)?.items?.find((i) => i.uid === c.uid);
    if (item) { gain = moneyAdd(gain, sellGain(item, m)); names.push(item.name); }
  }
  if (!names.length) return;
  set((s) => ({
    money: moneyAdd(s.money, gain),
    merchant: s.merchant ? { ...s.merchant, sellCart: [], bargainSellUsed: true } : s.merchant,
    party: removeSold(s.party, cart),
  }));
  get().log(`Vente : ${names.join(', ')} (+${formatMoney(gain)}).`);
}

/** Réparation d'un objet chez un artisan — armure (LDB 63 l.97-98) OU arme (LDB 62 l.135), coût unifié
 *  par `itemRepairCostBrass`. Une arme réduite à l'état improvisé est irréparable (isRepairable). */
export function repairItem(get: Get, set: Set, uid: string, heroId: string): void {
  const m = get().merchant; if (!m) return;
  const hero = get().party.find((h) => h.id === heroId);
  const item = hero?.items?.find((i) => i.uid === uid);
  if (!item || !isRepairable(item)) return;
  const t = item.trappingId ? findTrappingById(item.trappingId) : undefined;
  const base = t ? toBrass(priceToMoney(t.price)) : 0;
  const cost = fromBrass(itemRepairCostBrass(item, base));
  if (!canAfford(get().money, cost)) { get().log(`Bourse insuffisante pour réparer ${item.name}.`); return; }
  set((s) => ({
    money: moneySub(s.money, cost)!,
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = structuredClone(h);
      const it = clone.items?.find((i) => i.uid === uid); if (it) it.damageTaken = 0;
      recomputeLoadout(clone);
      return clone;
    }),
  }));
  get().log(`Réparation : ${item.name}.`);
}

export function startBargain(get: Get, set: Set, mode: 'buy' | 'sell'): void {
  const m = get().merchant; if (!m) return;
  const mkt = rule('market-mode') as string;
  if (mkt === 'sans-marchandage' || mkt === 'simplifie') return; // Marchandage désactivé (règle optionnelle LDB 59 l.15)
  if (m.soured) return; // botch antérieur : le marchand se méfie, plus de marchandage (LDB 60 l.12)
  if (m.bargainLocked) return; // VERROU PARTAGÉ : a refusé/renié un marché (achat OU vente) → plus de négociation jusqu'au réassort
  if (mode === 'buy' ? m.bargainBuy : m.bargainSell) return; // 1 marchandage par MODE et par visite (achat ≠ vente)
  const arch = MERCHANTS[m.archetype];
  const best = partyAssisted(get().party, 'marchandage', 'Soc'); if (!best) return; // Soutien (LDB 12) : conseillers du groupe
  const negotiator = hasBargainBonus(best.actor); // Négociateur → registre de talents (plus de name-match)
  set({ pendingBargain: {
    playerId: best.actor.id, playerName: best.actor.name,
    merchantName: arch?.label ?? 'Marchand', merchantValue: arch?.bargainSkill ?? 40,
    playerSkill: best.value, mode, negotiator, roll: null, merchantRoll: null, result: null,
  } });
}

/** « Conclure » le Marchandage : fige l'issue sur la visite (prix modulés) — LDB 60 l.12. */
export function bargainConfirm(get: Get, set: Set): void {
  const pb = get().pendingBargain;
  if (!pb || !pb.result) return; // pas d'acquittement avant le jet
  const won = pb.result.attackerWins; // le joueur est l'attaquant
  const drNet = pb.result.netSL;
  // « Rater de beaucoup » (LDB 60 l.12) = perdre l'opposé par un net DR ≥ 6 (symétrique du Succès Stupéfiant
  // +6 qui donne −20 %) → le marchand se méfie de votre monnaie : plus aucun marchandage cette visite.
  const botch = !won && drNet >= SL_ASTOUNDING;
  const outcome = { won, drNet, negotiator: pb.negotiator };
  const patch = pb.mode === 'buy' ? { bargainBuy: outcome } : { bargainSell: outcome };
  set((s) => ({
    pendingBargain: null,
    merchant: s.merchant ? { ...s.merchant, ...patch, soured: s.merchant.soured || botch } : s.merchant,
  }));
  // Verdict = source UNIQUE avec la popin (describeBargain).
  get().log(describeBargain(pb) + '.');
}

/** Talent « Détection d'artefact » (LDB 10 l.310-312) : Test d'Intuition au toucher — succès =
 *  l'objet est senti magique, chaque DR apprend une règle spéciale ; UNE tentative par artefact. */
export const DETECT_TALENT = "Détection d'artefact";

/** Meilleur détecteur du groupe : meilleure Intuition PARMI les porteurs du Talent (c'est LUI qui
 *  touche l'objet — pas un partyBest global comme l'Évaluation). null si personne ne l'a. */
export function bestDetector(party: Combatant[]): { actor: Combatant; value: number } | null {
  const holders = party.filter((h) => !h.dead && h.talents.some((t) => t.talentId === slugId(DETECT_TALENT) && (t.times ?? 1) >= 1));
  if (!holders.length) return null;
  const best = partyAssisted(holders, 'intuition', 'I'); // Soutien (LDB 12)
  return best ? { actor: best.actor, value: best.value } : null;
}

/** Démarreur PARTAGÉ Évaluation/Détection — sur un objet d'inventaire (`itemUid`) OU une ligne de
 *  butin encore en fenêtre (`gear`). Une seule modale, un seul flux de jet (rollFlows.appraise). */
function openAppraise(
  get: Get, set: Set,
  target: { itemUid?: string; gear?: { scope: 'loot' | 'victory'; index: number } },
  itemName: string, mode: 'evaluate' | 'detect', trappingId?: string,
): void {
  const best = mode === 'detect' ? bestDetector(get().party) : partyAssisted(get().party, 'evaluation', 'Int'); // Soutien (LDB 12)
  if (!best) return;
  const t = trappingId ? findTrappingById(trappingId) : undefined;
  set({ pendingAppraise: {
    actorId: best.actor.id, actorName: best.actor.name, ...target, itemName,
    mode, skillLabel: mode === 'detect' ? 'Intuition' : 'Évaluation',
    truePriceBrass: t ? toBrass(priceToMoney(t.price)) : 0,
    availability: (t?.availability as string | undefined) ?? null,
    skillValue: best.value, difficulty: 'intermediaire', target: best.value, roll: null, success: false, sl: 0,
  } });
}

/** Jour de jeu courant (verrou « pas de re-tentative d'Évaluation le même jour »). */
export function gameDay(get: Get): number {
  return Math.floor(get().gameTime / MINUTES_PER_DAY);
}

export function appraiseItem(get: Get, set: Set, uid: string, heroId: string, mode: 'evaluate' | 'detect' = 'evaluate'): void {
  const hero = get().party.find((h) => h.id === heroId);
  const item = hero?.items?.find((i) => i.uid === uid); if (!item) return;
  if (mode === 'detect' && item.detectTried) return; // une seule tentative par artefact (LDB 10 l.312)
  if (mode === 'evaluate' && item.appraiseTriedDay === gameDay(get)) {
    get().log(`${item.name} a déjà été jaugé aujourd'hui sans succès — réessayez demain.`);
    return;
  }
  openAppraise(get, set, { itemUid: uid }, item.name, mode, item.trappingId);
}

/** Évaluation/Détection d'une ligne de butin ENCORE en fenêtre (loot ou victoire) — révéler AVANT
 *  de choisir qui l'emporte (demande utilisateur). */
export function appraiseGear(get: Get, set: Set, scope: 'loot' | 'victory', index: number, mode: 'evaluate' | 'detect' = 'evaluate'): void {
  const bucket = scope === 'loot' ? get().pendingLoot : get().pendingVictory;
  const line = bucket?.gear?.[index]; if (!line) return;
  if (mode === 'detect' && line.effect.detectTried) return;
  if (mode === 'evaluate' && line.effect.appraiseTriedDay === gameDay(get)) return;
  openAppraise(get, set, { gear: { scope, index } }, line.label, mode, line.effect.trappingId);
}

/** Patch la cible de l'Évaluation/Détection — objet porté (party) ou ligne de butin en fenêtre. */
function patchAppraiseTarget(get: Get, set: Set, pa: { itemUid?: string; gear?: { scope: 'loot' | 'victory'; index: number } },
  patch: { identified?: boolean; magicKnown?: boolean; detectTried?: boolean; appraiseTriedDay?: number }): void {
  if (pa.gear) {
    const key = pa.gear.scope === 'loot' ? 'pendingLoot' : 'pendingVictory';
    const idx = pa.gear.index;
    set((s) => {
      const bucket = s[key];
      if (!bucket?.gear?.[idx]) return {};
      const gear = bucket.gear.map((g, i) => {
        if (i !== idx) return g;
        const effect = { ...g.effect, ...patch };
        if (patch.identified) delete (effect as { identified?: boolean }).identified; // identifié = champ absent
        return { ...g, magic: g.magic || !!patch.magicKnown, effect };
      });
      return { [key]: { ...bucket, gear } } as Partial<GameState>;
    });
    return;
  }
  set((s) => ({
    party: s.party.map((h) => {
      if (!(h.items ?? []).some((i) => i.uid === pa.itemUid)) return h; // clone uniquement le porteur de l'objet
      const clone: Combatant = structuredClone(h);
      const it = clone.items?.find((i) => i.uid === pa.itemUid);
      if (it) {
        Object.assign(it, patch);
        if (patch.identified) delete it.suspectedQualities; // la vraie révélation dissipe les fausses certitudes
      }
      return clone;
    }),
  }));
}

/** Acquitte l'Évaluation (révèle `identified` + estimation, LDB 60 l.10) ou la Détection d'artefact
 *  (aura sentie + règles apprises par DR, LDB 10 l.310-312 ; tentative unique). */
export function resolveAppraise(get: Get, set: Set): void {
  const pa = get().pendingAppraise;
  if (!pa || pa.roll == null) return; // pas d'acquittement avant le jet
  set({ pendingAppraise: null });
  if (pa.mode === 'detect') {
    // Qualités MAGIQUES de la cible : sur une ligne de butin on les connaît (effet) ; sur un objet
    // porté, l'ajout est fondu dans `qualities` → on compte 1 règle (cas du butin du jeu).
    const line = pa.gear ? (pa.gear.scope === 'loot' ? get().pendingLoot : get().pendingVictory)?.gear?.[pa.gear.index] : undefined;
    const item = pa.itemUid ? get().party.flatMap((h) => h.items ?? []).find((i) => i.uid === pa.itemUid) : undefined;
    const isMagic = line ? line.magic : !!item && (item.identified === false || !!item.magicKnown);
    const rules = line ? (line.effect.qualities?.length ?? (line.effect.identified === false ? 1 : 0)) : 1;
    if (!pa.success) {
      patchAppraiseTarget(get, set, pa, { detectTried: true });
      get().log(`${pa.actorName} ne perçoit rien de net en touchant ${pa.itemName} (Détection d'artefact : une seule tentative).`);
      return;
    }
    if (!isMagic) {
      patchAppraiseTarget(get, set, pa, { detectTried: true });
      get().log(`${pa.actorName} sonde ${pa.itemName} : aucune aura — l'objet n'est pas magique.`);
      return;
    }
    // Succès : aura sentie ; chaque DR apprend une règle → tout révélé quand DR couvre les règles.
    const allKnown = pa.sl >= Math.max(1, rules);
    patchAppraiseTarget(get, set, pa, { detectTried: true, magicKnown: true, ...(allKnown ? { identified: true } : {}) });
    get().log(allKnown
      ? `${pa.actorName} sent l'aura de ${pa.itemName} — et en saisit les règles (DR ${pa.sl}) : objet identifié.`
      : `${pa.actorName} sent que ${pa.itemName} est MAGIQUE, sans en percer les règles (DR ${pa.sl}).`);
    return;
  }
  if (!pa.success) {
    // Échec NET : pas de re-tentative le même jour (LDB 12 l.120 — seul un résultat marginal
    // « permet de faire un nouvel essai » ; ADE2 : re-tenter une identification coûte du temps).
    patchAppraiseTarget(get, set, pa, { appraiseTriedDay: gameDay(get) });
    get().log(`Évaluation ratée : ${pa.itemName} reste non identifié (rien de plus à en tirer aujourd'hui).`);
    return;
  }
  patchAppraiseTarget(get, set, pa, { identified: true });
  if (pa.truePriceBrass <= 0) { get().log(`Évaluation : ${pa.itemName} révélé (pièce unique — sans prix de catalogue).`); return; }
  const est = appraiseEstimate(pa.availability as Parameters<typeof appraiseEstimate>[0], pa.truePriceBrass);
  const range = est.min === est.max ? formatMoney(fromBrass(est.min)) : `${formatMoney(fromBrass(est.min))} – ${formatMoney(fromBrass(est.max))}`;
  get().log(`Évaluation : ${pa.itemName} révélé (valeur estimée ${range}).`);
}
