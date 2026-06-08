import { useState } from 'react';
import { useGame } from '../state/store';
import { findTrapping } from '../data/index';
import { priceToMoney, fromBrass, toBrass, formatMoney, type Money } from '../engine/money';
import { craftPriceFactor } from '../engine/qualities/craftEconomy';
import type { Combatant } from '../engine/types';

type MerchantState = NonNullable<ReturnType<typeof useGame.getState>['merchant']>;

/** Prix d'achat d'un article du catalogue (catalogue × facteur qualité d'artisanat). */
function buyPrice(label: string): string {
  const t = findTrapping(label);
  if (!t) return '—';
  return formatMoney(fromBrass(Math.round(toBrass(priceToMoney(t.price)) * craftPriceFactor({ qualities: t.qualities }))));
}

/** Présentationnel (props) — testable hors store. */
export function MerchantPanelView({ merchant, party, money, onBuy, onSell, onClose }: {
  merchant: MerchantState;
  party: Combatant[];
  money: Money;
  onBuy: (label: string, heroId: string) => void;
  onSell: (uid: string, heroId: string) => void;
  onClose: () => void;
}) {
  const [heroId, setHeroId] = useState(party[0]?.id ?? '');
  return (
    <div className="merchant-panel modal-overlay">
      <div className="merchant-box">
        <div className="merchant-head">
          <strong>Marchand</strong>
          <span className="purse">Bourse : {formatMoney(money)}</span>
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
                <span className="price">{buyPrice(l.label)}</span>
                <button className="btn small" onClick={() => onBuy(l.label, heroId)}>Acheter</button>
              </div>
            ))}
            {merchant.stock.every((l) => l.qty <= 0) && <p className="empty">— rien en stock —</p>}
          </div>
          <div className="merchant-sell">
            <div className="mini-title">Vendre (équipement du groupe)</div>
            {party.flatMap((h) => (h.items ?? []).map((it) => (
              <div className="merch-row" key={it.uid}>
                <span>{h.name} : {it.name}</span>
                <span className="price">{formatMoney(fromBrass(Math.round(toBrass(priceToMoney(findTrapping(it.name)?.price ?? {})) * craftPriceFactor(it) * merchant.resaleRate)))}</span>
                <button className="btn small" onClick={() => onSell(it.uid, h.id)}>Vendre</button>
              </div>
            )))}
            {party.every((h) => !(h.items ?? []).length) && <p className="empty">— rien à vendre —</p>}
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
  const closeMerchant = useGame((s) => s.closeMerchant);
  if (!merchant) return null;
  return <MerchantPanelView merchant={merchant} party={party} money={money} onBuy={buyItem} onSell={sellItem} onClose={closeMerchant} />;
}
