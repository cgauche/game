import { useState } from 'react';
import { useGame } from '../state/store';
import { findLandCargoById } from '../engine/landCargo';
import { cargoTotalEnc } from '../engine/cargo';
import { placeById } from '../state/worldMap';
import { canAfford, toMoney } from '../engine/money';
import { Coins } from './Coins';

/**
 * ÉCRAN MARCHÉ TERRESTRE (Mort sur le Reik Compagnon ch.11 « Règles du commerce ») — commerce de cargaison à
 * un Lieu `market` de la carte : acheter les offres de l'étape (disponibilité 2 temps + Marchandage + lot
 * partiel), vendre/brader le convoi. PENDANT terrestre de `PortView` (commerce maritime) : même overlay
 * plein écran (patron `WorldMapView`), sections en `.layout-sidebar`/`.panel` (responsive ≤900/700/560),
 * français, aucun texte tuto. Réutilise les classes `.port-*`/`.market-offer*` de la feuille de style commune.
 */
export function LandMarketView() {
  const market = useGame((s) => s.landMarket);
  const cargo = useGame((s) => s.caravanCargo);
  const rumours = useGame((s) => s.tradeRumours);
  const worldMap = useGame((s) => s.worldMap);
  const money = useGame((s) => s.money);
  const close = useGame((s) => s.closeLandMarket);
  const buy = useGame((s) => s.landBuyCargo);
  const sell = useGame((s) => s.landSellCargo);
  const dump = useGame((s) => s.landDumpCargo);
  const evalWine = useGame((s) => s.landEvalWine);
  const isGuest = useGame((s) => s.net.mode) === 'guest';
  const [buyEnc, setBuyEnc] = useState<Record<string, number>>({});

  if (!market) return null;
  const lots = cargo ?? [];
  const carried = cargoTotalEnc(lots);

  return (
    <div className="worldmap-overlay port-overlay">
      <div className="worldmap-head">
        <h2>Marché de {market.label}</h2>
        <button type="button" className="btn small" onClick={close}>✕ Fermer</button>
      </div>
      <div className="port-tabs">
        <span className="port-purse">Bourse : <b><Coins money={money} /></b></span>
        <span className="port-purse">Convoi : <b>{carried} Enc</b></span>
      </div>

      <div className="port-body">
        {rumours.length > 0 && (
          <section className="panel port-section">
            <h3>Rumeurs de commerce</h3>
            <ul className="port-hint">
              {rumours.map((r, i) => {
                const here = r.placeId === market.placeId;
                const dest = worldMap ? placeById(worldMap, r.placeId)?.label ?? r.placeId : r.placeId;
                const biens = r.biens.map((id) => findLandCargoById(id)?.label ?? id).join(', ');
                return (
                  <li key={i}>
                    {biens} se vendent au double à <b>{dest}</b>{here ? ' — c’est ici : vendez ces biens (T2C ch.11 l.180).' : '.'}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <div className="layout-sidebar port-trade">
          <section className="panel port-section">
            <h3>Acheter — offres de l’étape</h3>
            {market.offers.length === 0 && <p className="port-hint">Aucun marchand n’a de cargaison à céder ici (disponibilité T2C ch.11 l.22-42).</p>}
            <div className="panel-grid">
              {market.offers.map((o) => {
                const want = buyEnc[o.cargoId] ?? o.enc;
                const estCost = toMoney({ gold: Math.round(want * o.basePrice) });
                const affordable = canAfford(money, estCost);
                return (
                  <div key={o.cargoId} className="market-offer">
                    <div className="market-offer-head">
                      <b>
                        {o.label}
                        {o.wine && (o.wineTier
                          ? <span className="port-hint"> — {o.wineTier}{o.wineEvalOk ? '' : ' (?)'}</span>
                          : <> <button type="button" className="btn small ghost" disabled={isGuest} title="Test d’Évaluation pour révéler la qualité secrète du vin (T2C ch.11 l.95)" onClick={() => evalWine(o.cargoId)}>Évaluer</button></>)}
                      </b>
                      <span className="port-hint">Dispo <b>{o.enc}</b> Enc · <Coins money={toMoney({ gold: o.basePrice })} />/Enc</span>
                    </div>
                    <div className={`market-offer-buy ${affordable ? '' : 'unaffordable'}`}>
                      <input
                        type="number" min={1} max={o.enc} value={want}
                        onChange={(e) => setBuyEnc((s) => ({ ...s, [o.cargoId]: Math.max(1, Math.min(o.enc, Number(e.target.value) || 1)) }))}
                      />
                      <span className="market-offer-total">Total ≈ <Coins money={estCost} /></span>
                      <button
                        type="button"
                        className="btn small"
                        disabled={isGuest || !affordable}
                        title={affordable ? 'Estimation avant Marchandage (+10 % si lot partiel, l.131)' : 'Bourse insuffisante'}
                        onClick={() => buy(o.cargoId, want)}
                      >
                        Acheter
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="panel port-section">
            <h3>Vendre — convoi du groupe</h3>
            {lots.length === 0 && <p className="port-hint">Le convoi est vide.</p>}
            <table className="port-table">
              <thead><tr><th>Lot</th><th>Enc</th><th>Prix base</th><th /></tr></thead>
              <tbody>
                {lots.map((lot, i) => (
                  <tr key={i}>
                    <td>{findLandCargoById(lot.cargoId)?.label ?? lot.cargoId}</td>
                    <td>{lot.enc}</td>
                    <td><Coins money={toMoney({ gold: lot.basePriceGold })} />/Enc</td>
                    <td className="port-sell-actions">
                      <button type="button" className="btn small" disabled={isGuest} title="Trouver un acheteur puis marchander (T2C ch.11 l.133-160)" onClick={() => sell(i)}>Vendre</button>
                      <button type="button" className="btn small ghost" disabled={isGuest} title="Brader à la moitié du prix de base (T2C ch.11 l.160)" onClick={() => dump(i)}>Brader</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
