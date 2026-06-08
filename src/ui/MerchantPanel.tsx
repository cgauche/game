import { useState } from 'react';
import { useGame } from '../state/store';
import { findTrapping } from '../data/index';
import { priceToMoney, fromBrass, toBrass, formatMoney, type Money } from '../engine/money';
import { craftPriceFactor } from '../engine/qualities/craftEconomy';
import { repairCostBrass } from '../engine/repair';
import { bargainBuyFactor, bargainSellFactor } from '../engine/bargain';
import type { Combatant, ItemInstance } from '../engine/types';

type MerchantState = NonNullable<ReturnType<typeof useGame.getState>['merchant']>;

/** Prix d'achat d'un article du catalogue (catalogue × facteur qualité d'artisanat × Marchandage). */
function buyPrice(label: string, factor = 1): string {
  const t = findTrapping(label);
  if (!t) return '—';
  return formatMoney(fromBrass(Math.round(toBrass(priceToMoney(t.price)) * craftPriceFactor({ qualities: t.qualities }) * factor)));
}

/** Coût de réparation d'une armure endommagée (LDB 63 l.97-98). */
function repairPrice(item: ItemInstance): string {
  const t = findTrapping(item.name);
  const base = t ? toBrass(priceToMoney(t.price)) : 0;
  return formatMoney(fromBrass(repairCostBrass(item, base)));
}

/** Présentationnel (props) — testable hors store. */
export function MerchantPanelView({ merchant, party, money, onBuy, onSell, onRepair, onBargain, onClose }: {
  merchant: MerchantState;
  party: Combatant[];
  money: Money;
  onBuy: (label: string, heroId: string) => void;
  onSell: (uid: string, heroId: string) => void;
  onRepair: (uid: string, heroId: string) => void;
  onBargain: (mode: 'buy' | 'sell') => void;
  onClose: () => void;
}) {
  // Armures endommagées du groupe (réparables chez le marchand).
  const damaged = party.flatMap((h) => (h.items ?? []).filter((it) => it.kind === 'armor' && (it.damageTaken ?? 0) > 0).map((it) => ({ h, it })));
  // Marchandage verrouillé pour la visite (LDB 60 l.12) : module les prix d'achat et de vente.
  const b = merchant.bargain;
  const buyFactor = b ? bargainBuyFactor(b.won, b.drNet, b.negotiator) : 1;
  const sellFactor = b ? bargainSellFactor(b.won, b.drNet, b.negotiator) : 1;
  const [heroId, setHeroId] = useState(party[0]?.id ?? '');
  return (
    <div className="merchant-panel modal-overlay">
      <div className="merchant-box">
        <div className="merchant-head">
          <strong>Marchand</strong>
          <span className="purse">Bourse : {formatMoney(money)}</span>
          {b == null ? (
            <button className="btn small" onClick={() => onBargain('buy')} title="Test opposé de Marchandage (1 par visite, LDB 60)">Marchander</button>
          ) : (
            <span className="bargain-tag" title="Résultat de Marchandage verrouillé pour la visite">
              {b.won ? `Marchandage ✔ (achat ×${buyFactor}, vente ×${sellFactor})` : 'Marchandage ✘ échoué (vente à ¼)'}
            </span>
          )}
          <button className="btn small" onClick={onClose}>Fermer</button>
        </div>
        <div className="merchant-cols">
          <div className="merchant-stock">
            <div className="mini-title">En vente</div>
            <label className="hero-sel">Donner à
              <select value={heroId} onChange={(e) => setHeroId(e.target.value)}>
                {party.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
            {merchant.stock.filter((l) => l.qty > 0).map((l) => (
              <div className="merch-row" key={l.label}>
                <span>{l.label} ×{l.qty}</span>
                <span className="price">{buyPrice(l.label, buyFactor)}</span>
                <button className="btn small" onClick={() => onBuy(l.label, heroId)}>Acheter</button>
              </div>
            ))}
            {merchant.stock.every((l) => l.qty <= 0) && <p className="empty">— rien en stock —</p>}
          </div>
          <div className="merchant-sell">
            <div className="mini-title">Vendre (équipement du groupe)</div>
            {party.flatMap((h) => (h.items ?? []).map((it) => (
              <div className="merch-row" key={it.uid}>
                <span>{h.name} : {it.name}{it.identified === false ? ' (non identifié)' : ''}</span>
                <span className="price">{formatMoney(fromBrass(Math.round(toBrass(priceToMoney(findTrapping(it.name)?.price ?? {})) * craftPriceFactor(it) * merchant.resaleRate * sellFactor)))}</span>
                <button className="btn small" onClick={() => onSell(it.uid, h.id)}>Vendre</button>
              </div>
            )))}
            {party.every((h) => !(h.items ?? []).length) && <p className="empty">— rien à vendre —</p>}
          </div>
          <div className="merchant-repair">
            <div className="mini-title">Réparer (armures endommagées)</div>
            {damaged.map(({ h, it }) => (
              <div className="merch-row" key={it.uid}>
                <span>{h.name} : {it.name}</span>
                <span className="price">{repairPrice(it)}</span>
                <button className="btn small" onClick={() => onRepair(it.uid, h.id)}>Réparer</button>
              </div>
            ))}
            {damaged.length === 0 && <p className="empty">— aucune armure à réparer —</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Connecté au store. */
export function MerchantPanel() {
  const merchant = useGame((s) => s.merchant);
  const party = useGame((s) => s.party);
  const money = useGame((s) => s.money);
  const buyItem = useGame((s) => s.buyItem);
  const sellItem = useGame((s) => s.sellItem);
  const repairArmour = useGame((s) => s.repairArmour);
  const startBargain = useGame((s) => s.startBargain);
  const closeMerchant = useGame((s) => s.closeMerchant);
  if (!merchant) return null;
  return <MerchantPanelView merchant={merchant} party={party} money={money} onBuy={buyItem} onSell={sellItem} onRepair={repairArmour} onBargain={startBargain} onClose={closeMerchant} />;
}
