import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { findVehicleById, NAVAL_TRAITS, findNavalTrait } from '../data';
import { findCargoById } from '../engine/seaVoyage';
import { installCost } from '../engine/shipBuild';
import { shipHasNavalTrait } from '../engine/navalTraits';
import { foulingEffects } from '../engine/seaNavigation';
import { canAfford, toMoney } from '../engine/money';
import { Coins } from './Coins';
import { Prose } from './Prose';

/**
 * ÉCRAN PORT (MDG 15) — services au navire de campagne à quai : Réparer (MDG 13 l.643) / Caréner
 * (Salissures l.150-159) / Améliorations (coût par bande de Taille, MDG 12) / Cargaison (commerce
 * maritime l.309-399 : acheter les offres de l'escale, vendre/brader la cale). Overlay plein écran
 * (patron `WorldMapView`), sections en `.layout-sidebar`/`panel-grid` (responsive ≤900/700/560),
 * français, aucun texte tuto (les `desc` sont le VERBATIM des Améliorations/cargaisons).
 */
export function PortView() {
  const port = useGame((s) => s.port);
  const vessel = useGame((s) => s.vessel);
  const money = useGame((s) => s.money);
  const close = useGame((s) => s.closePort);
  const buy = useGame((s) => s.portBuyCargo);
  const sell = useGame((s) => s.portSellCargo);
  const dump = useGame((s) => s.portDumpCargo);
  const repair = useGame((s) => s.portRepair);
  const careen = useGame((s) => s.portCareen);
  const install = useGame((s) => s.portInstallUpgrade);
  const isGuest = useGame((s) => s.net.mode) === 'guest';
  const [tab, setTab] = useState<'coque' | 'cargaison'>('coque');
  const [buyEnc, setBuyEnc] = useState<Record<string, number>>({});

  const vd = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  if (!port || !vessel || !vd?.ship) return null;
  const woundsMax = vessel.wounds?.max ?? vd.hull?.char.B ?? 0;
  const woundsCur = vessel.wounds?.current ?? woundsMax;
  const missing = woundsMax - woundsCur;
  const foulLevel = vessel.fouling?.level ?? 0;
  const traits = [...(vd.ship.traits ?? []), ...(vessel.upgrades ?? [])];
  const lissage = shipHasNavalTrait(traits, 'lissage');
  const repairCost = Math.ceil(missing * (lissage ? 1.5 : 1));
  const careenPct = foulingEffects(foulLevel).repairPctOfBase;
  const careenCost = Math.ceil((vd.purchase?.price?.gold ?? 0) * (careenPct / 100));

  // Améliorations POSABLES : `kind:'amelioration'` non déjà installées, coût chiffré pour cette coque.
  const upgrades = useMemo(() => {
    const owned = new Set((vessel.upgrades ?? []).map((u) => u.id));
    return NAVAL_TRAITS
      .filter((t) => t.kind === 'amelioration' && t.install && !owned.has(t.id))
      .map((t) => ({ def: t, cost: installCost(t.install!, vd.ship!.lengthM, 1) }))
      .filter((u) => u.cost.gold != null);
  }, [vessel.upgrades, vd.ship]);

  const cargo = vessel.cargo ?? [];

  return (
    <div className="worldmap-overlay port-overlay">
      <div className="worldmap-head">
        <h2>⚓ Port de {port.label} — {vd.label}</h2>
        <button type="button" className="btn small" onClick={close}>✕ Fermer</button>
      </div>
      <div className="port-tabs">
        <button type="button" className={`btn small ${tab === 'coque' ? 'btn-primary' : ''}`} onClick={() => setTab('coque')}>🔧 Chantier</button>
        <button type="button" className={`btn small ${tab === 'cargaison' ? 'btn-primary' : ''}`} onClick={() => setTab('cargaison')}>📦 Cargaison</button>
        <span className="port-purse">Bourse : <b><Coins money={money} /></b></span>
      </div>

      <div className="port-body">
        {tab === 'coque' ? (
          <div className="layout-sidebar port-yard">
            <section className="panel port-section">
              <h3>Coque &amp; entretien</h3>
              <p>Blessures : <b>{woundsCur}/{woundsMax}</b>{vessel.criticals?.length ? ` · ${vessel.criticals.length} Critique(s) noté(s)` : ''}</p>
              <button
                type="button"
                className="btn"
                disabled={isGuest || (missing <= 0 && !(vessel.criticals?.length))}
                title={missing <= 0 && !(vessel.criticals?.length) ? 'La coque est intacte.' : `1 CO par Blessure restaurée (MDG 13 l.643)${lissage ? ' · +50 % coque lissée' : ''}`}
                onClick={repair}
              >
                🔧 Réparer{missing > 0 ? ` — ${missing} Blessure(s), ${repairCost} CO` : ''}
              </button>
              <p className="port-hint">Salissures : niveau <b>{foulLevel}</b>{vessel.crabs ? ' · crabes boxeurs' : ''}{foulLevel > 0 ? ` — ${foulingEffects(foulLevel).desc}` : ''}</p>
              <button
                type="button"
                className="btn"
                disabled={isGuest || (foulLevel <= 0 && !vessel.crabs)}
                title={foulLevel <= 0 && !vessel.crabs ? 'La coque est propre.' : `Cale sèche — ${careenPct} % du coût de base (MDG 13 l.152)`}
                onClick={careen}
              >
                🦪 Caréner{careenCost > 0 ? ` — ${careenCost} CO` : ''}
              </button>
            </section>
            <section className="panel port-section">
              <h3>Améliorations</h3>
              {upgrades.length === 0 && <p className="port-hint">Toutes les Améliorations installables le sont déjà.</p>}
              <div className="panel-grid">
                {upgrades.map(({ def, cost }) => (
                  <div key={def.id} className="port-upgrade">
                    <div className="port-upgrade-head">
                      <b>{def.label}</b>
                      <button
                        type="button"
                        className="btn small"
                        disabled={isGuest || !canAfford(money, toMoney({ gold: cost.gold ?? 0 }))}
                        title={`${cost.gold} CO${cost.enc ? ` · ${cost.enc} Enc` : ''} (MDG 12)`}
                        onClick={() => install(def.id, 1)}
                      >
                        Installer — {cost.gold} CO
                      </button>
                    </div>
                    <Prose md={def.desc} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="layout-sidebar port-trade">
            <section className="panel port-section">
              <h3>Acheter — offres de l’escale</h3>
              <p className="port-hint">Cale libre : <b>{port.freeEnc} Enc</b></p>
              {port.offers.length === 0 && <p className="port-hint">Aucune cargaison à vendre dans ce port (production « minimum vital » ou stock épuisé).</p>}
              <table className="port-table">
                <thead><tr><th>Cargaison</th><th>Dispo (Enc)</th><th>Prix base</th><th>Enc</th><th /></tr></thead>
                <tbody>
                  {port.offers.map((o) => {
                    const want = buyEnc[o.cargoId] ?? Math.min(o.enc, port.freeEnc);
                    return (
                      <tr key={o.cargoId}>
                        <td>{o.label}{o.surplus ? ' (Surplus)' : ''}</td>
                        <td>{o.enc}</td>
                        <td>{o.basePrice} CO/Enc</td>
                        <td>
                          <input
                            type="number" min={1} max={Math.min(o.enc, port.freeEnc)} value={want}
                            onChange={(e) => setBuyEnc((s) => ({ ...s, [o.cargoId]: Math.max(1, Math.min(o.enc, port.freeEnc, Number(e.target.value) || 1)) }))}
                          />
                        </td>
                        <td>
                          <button type="button" className="btn small" disabled={isGuest || port.freeEnc <= 0} title={`≈ ${Math.round(want * o.basePrice)} CO avant Marchandage`} onClick={() => buy(o.cargoId, want)}>
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
              <h3>Vendre — cale du navire</h3>
              {cargo.length === 0 && <p className="port-hint">La cale est vide.</p>}
              <table className="port-table">
                <thead><tr><th>Lot</th><th>Enc</th><th>Prix base</th><th /></tr></thead>
                <tbody>
                  {cargo.map((lot, i) => (
                    <tr key={i}>
                      <td>{findCargoById(lot.cargoId)?.label ?? lot.cargoId}</td>
                      <td>{lot.enc}</td>
                      <td>{lot.basePriceGold} CO/Enc</td>
                      <td className="port-sell-actions">
                        <button type="button" className="btn small" disabled={isGuest} title="Trouver un acheteur puis marchander (MDG 15 l.351-397)" onClick={() => sell(i)}>Vendre</button>
                        <button type="button" className="btn small ghost" disabled={isGuest} title="Brader à ¼ du prix de base (MDG 15 l.399)" onClick={() => dump(i)}>Brader</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
