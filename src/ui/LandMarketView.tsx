import { useState } from 'react';
import { useGame } from '../state/store';
import { findLandCargoById } from '../engine/landCargo';
import { cargoTotalEnc } from '../engine/cargo';
import { Coins } from './Coins';

/**
 * ÉCRAN MARCHÉ TERRESTRE (Mort sur le Reik Compagnon ch.11 « Règles du commerce ») — commerce de cargaison à
 * un Lieu `market` de la carte : acheter les offres de l'étape (disponibilité 2 temps + Marchandage + lot
 * partiel), vendre/brader le convoi. PENDANT terrestre de `PortView` (commerce maritime) : même overlay
 * plein écran (patron `WorldMapView`), sections en `.layout-sidebar`/`.panel` (responsive ≤900/700/560),
 * français, aucun texte tuto. Réutilise les classes `.port-*` de la feuille de style commune.
 */
export function LandMarketView() {
  const market = useGame((s) => s.landMarket);
  const cargo = useGame((s) => s.caravanCargo);
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
        {market.rumour && (
          <section className="panel port-section">
            <h3>Rumeur au marché</h3>
            <p>{market.rumour.text}</p>
            <p className="port-hint">
              Forte demande : {market.rumour.biens.map((id) => findLandCargoById(id)?.label ?? id).join(', ')} — ces biens se vendent au double du prix de base ici (T2C ch.11 l.180).
            </p>
          </section>
        )}
        <div className="layout-sidebar port-trade">
          <section className="panel port-section">
            <h3>Acheter — offres de l’étape</h3>
            {market.offers.length === 0 && <p className="port-hint">Aucun marchand n’a de cargaison à céder ici (disponibilité T2C ch.11 l.22-42).</p>}
            <table className="port-table">
              <thead><tr><th>Cargaison</th><th>Dispo (Enc)</th><th>Prix base</th><th>Enc</th><th /></tr></thead>
              <tbody>
                {market.offers.map((o) => {
                  const want = buyEnc[o.cargoId] ?? o.enc;
                  return (
                    <tr key={o.cargoId}>
                      <td>
                        {o.label}
                        {o.wine && (o.wineTier
                          ? <span className="port-hint"> — {o.wineTier}{o.wineEvalOk ? '' : ' (?)'}</span>
                          : <> <button type="button" className="btn small ghost" disabled={isGuest} title="Test d’Évaluation pour révéler la qualité secrète du vin (T2C ch.11 l.95)" onClick={() => evalWine(o.cargoId)}>Évaluer</button></>)}
                      </td>
                      <td>{o.enc}</td>
                      <td>{o.basePrice} CO/Enc</td>
                      <td>
                        <input
                          type="number" min={1} max={o.enc} value={want}
                          onChange={(e) => setBuyEnc((s) => ({ ...s, [o.cargoId]: Math.max(1, Math.min(o.enc, Number(e.target.value) || 1)) }))}
                        />
                      </td>
                      <td>
                        <button type="button" className="btn small" disabled={isGuest} title={`≈ ${Math.round(want * o.basePrice)} CO avant Marchandage (+10 % si lot partiel, l.131)`} onClick={() => buy(o.cargoId, want)}>
                          Acheter
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                    <td>{lot.basePriceGold} CO/Enc</td>
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
