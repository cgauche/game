import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { findLandCargoById } from '../engine/landCargo';
import { bulkCarriers, bulkCargoRefs, primaryCargoCarrier, type CarrierStateSlice } from '../state/carriers';
import { carrierFreeEnc } from '../engine/cargo';
import { placeById } from '../state/worldMap';
import { canAfford, toMoney } from '../engine/money';
import { Coins } from './Coins';
import { ScreenShell } from './ScreenShell';
import { CargoTransferPanel } from './CargoTransferPanel';

/**
 * ÉCRAN MARCHÉ TERRESTRE (Mort sur le Reik Compagnon ch.11 « Règles du commerce ») — commerce de cargaison à
 * un Lieu `market` de la carte : acheter les offres de l'étape (disponibilité 2 temps + Marchandage + lot
 * partiel, plafonné à la Contenance du porteur, #327), vendre/brader la cargaison des porteurs, transférer
 * entre porteurs co-localisés. PENDANT terrestre de `PortView` (commerce maritime) : même overlay plein écran
 * (patron `WorldMapView`), sections `.layout-sidebar`/`.panel` (responsive ≤900/700/560), français, aucun tuto.
 */
export function LandMarketView() {
  const market = useGame((s) => s.landMarket);
  const party = useGame((s) => s.party);
  const vessel = useGame((s) => s.vessel);
  const worldMap = useGame((s) => s.worldMap);
  const scene = useGame((s) => s.scene);
  const rumours = useGame((s) => s.tradeRumours);
  const money = useGame((s) => s.money);
  const close = useGame((s) => s.closeLandMarket);
  const buy = useGame((s) => s.landBuyCargo);
  const sell = useGame((s) => s.landSellCargo);
  const dump = useGame((s) => s.landDumpCargo);
  const move = useGame((s) => s.moveCargo);
  const evalWine = useGame((s) => s.landEvalWine);
  const isGuest = useGame((s) => s.net.mode) === 'guest';
  const [buyEnc, setBuyEnc] = useState<Record<string, number>>({});

  const slice: CarrierStateSlice = useMemo(() => ({ party, vessel, worldMap, scene }), [party, vessel, worldMap, scene]);
  const carriers = useMemo(() => bulkCarriers(slice), [slice]);
  const refs = useMemo(() => bulkCargoRefs(slice), [slice]);
  const target = useMemo(() => primaryCargoCarrier(slice), [slice]);

  if (!market) return null;
  const cargoLabel = (id: string) => findLandCargoById(id)?.label ?? id;

  return (
    <ScreenShell
      className="port-overlay"
      title={<>Marché de {market.label}</>}
      onClose={close}
      meta={{ money }}
      tabs={<span className="port-purse">Porteur : <b>{target ? `${target.label} — libre ${carrierFreeEnc(target)} / ${target.capacity} Enc` : 'aucun'}</b></span>}
    >
      <div className="port-body">
        {rumours.length > 0 && (
          <section className="panel port-section">
            <h3>Rumeurs de commerce</h3>
            <ul className="port-hint">
              {rumours.map((r, i) => {
                const here = r.placeId === market.placeId;
                const dest = worldMap ? placeById(worldMap, r.placeId)?.label ?? r.placeId : r.placeId;
                const biens = r.biens.map((id) => cargoLabel(id)).join(', ');
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
            {!target && <p className="port-hint">Aucun porteur de charge : procurez-vous une bête de somme ou un véhicule pour transporter une cargaison (EDOC ch.4).</p>}
            {market.offers.length === 0 && <p className="port-hint">Aucun marchand n’a de cargaison à céder ici (disponibilité T2C ch.11 l.22-42).</p>}
            <div className="panel-grid">
              {market.offers.map((o) => {
                const free = target ? carrierFreeEnc(target) : 0;
                const want = buyEnc[o.cargoId] ?? Math.min(o.enc, free || o.enc);
                const estCost = toMoney({ gold: Math.round(want * o.basePrice) });
                const affordable = canAfford(money, estCost);
                const fits = want <= free;
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
                        disabled={isGuest || !affordable || !target || !fits}
                        title={!target ? 'Aucun porteur' : !fits ? `Contenance dépassée (libre ${free} Enc)` : affordable ? 'Estimation avant Marchandage (+10 % si lot partiel, l.131)' : 'Bourse insuffisante'}
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
            <h3>Vendre — cargaison des porteurs</h3>
            {refs.length === 0 && <p className="port-hint">Aucune cargaison à vendre.</p>}
            <table className="port-table">
              <thead><tr><th>Porteur</th><th>Lot</th><th>Enc</th><th>Prix base</th><th /></tr></thead>
              <tbody>
                {refs.map((r) => (
                  <tr key={`${r.carrierId}-${r.index}`}>
                    <td>{r.carrierLabel}</td>
                    <td>{cargoLabel(r.lot.cargoId)}</td>
                    <td>{r.lot.enc}</td>
                    <td><Coins money={toMoney({ gold: r.lot.basePriceGold })} />/Enc</td>
                    <td className="port-sell-actions">
                      <button type="button" className="btn small" disabled={isGuest} title="Trouver un acheteur puis marchander (T2C ch.11 l.133-160)" onClick={() => sell(r.carrierId, r.index)}>Vendre</button>
                      <button type="button" className="btn small ghost" disabled={isGuest} title="Brader à la moitié du prix de base (T2C ch.11 l.160)" onClick={() => dump(r.carrierId, r.index)}>Brader</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <CargoTransferPanel carriers={carriers} onMove={move} labelOf={cargoLabel} disabled={isGuest} />
        </div>
      </div>
    </ScreenShell>
  );
}
