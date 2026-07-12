import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { findVehicleById, NAVAL_TRAITS, findNavalPortById, crewRoles, type NavalPortData } from '../data';
import { findCargoById, type PortProfile } from '../engine/seaVoyage';
import { installCost } from '../engine/shipBuild';
import { shipHasNavalTrait } from '../engine/navalTraits';
import { foulingEffects } from '../engine/seaNavigation';
import { canAfford, toMoney, priceToMoney, formatMoney } from '../engine/money';
import { moraleBand } from '../engine/crewMorale';
import type { CampaignVessel } from '../state/store';
import type { PendingShoreLeave, PendingManannPriest } from '../state/seaVoyageFlow';
import { Coins } from './Coins';
import { Prose } from './Prose';
import { Icon } from './Icon';
import { NotchGauge } from './NotchGauge';
import { moraleTone, ShipCrewWages } from './shipStatus';
import { ScreenShell } from './ScreenShell';
import { Tabs } from './Tabs';
import { ShoreLeaveBody } from './ShoreLeaveModal';
import { ManannBody } from './ManannPriestModal';

/** Libellé d'un id de cargaison / marqueur d'Index (`commerce`/`minimum-vital` ne sont pas des cargaisons). */
const cargoLabel = (id: string): string => id === 'commerce' ? 'Commerce' : id === 'minimum-vital' ? 'Minimum vital' : findCargoById(id)?.label ?? id;
const indiceList = (rec: Record<string, number> | undefined): string =>
  Object.entries(rec ?? {}).map(([id, n]) => `${cargoLabel(id)}${n > 1 ? ` ×${n}` : ''}`).join(', ');

/** En-tête de l'escale-hub (#228) : région + 5 indices de l'Index des ports (MDG 15 l.439-506) + desc
 *  verbatim du catalogue `naval-ports.json` (si le lieu porte une `ref`). PUR (props). */
export function PortHeader({ pp, catalogue }: { pp: PortProfile; catalogue?: NavalPortData }) {
  return (
    <div className="port-head">
      {catalogue?.region && <p className="port-hint port-region">{catalogue.region}{pp.cosmopolite ? ' · port cosmopolite' : ''}</p>}
      <div className="port-indices">
        <span><b>Taille</b> {pp.taille}</span>
        <span><b>Richesse</b> {pp.richesse}</span>
        <span><b>Production</b> {pp.production.length ? pp.production.map(cargoLabel).join(', ') : '—'}</span>
        <span><b>Surplus</b> {indiceList(pp.surplus) || '—'}</span>
        <span><b>Demande</b> {indiceList(pp.demande) || '—'}</span>
      </div>
      {catalogue?.desc && <Prose md={catalogue.desc} />}
    </div>
  );
}

/** Onglet ESCALE (#228) — actions d'escale agrégées : événements d'escale en cours surfacés (Relâche à
 *  terre MDG 15 l.245 / Prêtre de Manann l.246 — le hub COMPOSE `ShoreLeaveBody`/`ManannBody`, déjà
 *  résolvants et branchés au store, aucune 2e prose de décision) et RECRUTEMENT salarié (MDG 14
 *  l.293-302, `crew-roles.json`, PUR sur ce volet — `onHire`/`onDismiss` en props). */
export function EscaleTab({ vessel, isGuest, pendingShoreLeave, pendingManannPriest, onHire, onDismiss }: {
  vessel: CampaignVessel; isGuest: boolean;
  pendingShoreLeave: PendingShoreLeave | null; pendingManannPriest: PendingManannPriest | null;
  onHire: (roleId: string) => void; onDismiss: (roleId: string) => void;
}) {
  const hireable = crewRoles.filter((r) => r.wage?.weekly);
  const countOf = (roleId: string) => vessel.crew?.find((h) => h.roleId === roleId)?.count ?? 0;
  const hasEvent = !!(pendingShoreLeave || pendingManannPriest);
  return (
    <div className="layout-sidebar port-escale">
      <section className="panel port-section">
        <h3>Vie du port</h3>
        {!hasEvent && <p className="port-hint">Aucun événement d’escale en cours.</p>}
        <ShoreLeaveBody embedded />
        <ManannBody embedded />
      </section>
      <section className="panel port-section">
        <h3>Recruter de l’équipage</h3>
        <p className="port-hint">Embauche de marins salariés (MDG 14 l.293-302) : la solde est prélevée à l’entretien hebdomadaire, aucune avance à l’embauche.</p>
        <div className="panel-grid">
          {hireable.map((role) => {
            const n = countOf(role.id);
            return (
              <div key={role.id} className="port-upgrade">
                <div className="port-upgrade-head">
                  <b>{role.label}{n > 0 ? ` ×${n}` : ''}</b>
                  <span className="port-hint"><Coins money={priceToMoney(role.wage!.weekly)} />/sem.</span>
                </div>
                <div className="port-crew-actions">
                  <button type="button" className="btn small" disabled={isGuest} title={`Embaucher un ${role.label}`} onClick={() => onHire(role.id)}>Embaucher</button>
                  <button type="button" className="btn small ghost" disabled={isGuest || n <= 0} title={`Débarquer un ${role.label}`} onClick={() => onDismiss(role.id)}>Débarquer</button>
                </div>
              </div>
            );
          })}
        </div>
        <ShipCrewWages vessel={vessel} />
        {!vessel.crew?.length && !vessel.wagesOwed && <p className="port-hint">Aucun équipage salarié pour l’instant.</p>}
      </section>
    </div>
  );
}

/**
 * ESCALE-HUB (#228, MDG 15) — LE point d'entrée de port unifié : en-tête enrichi (`PortHeader` : nom du
 * port, ses 5 indices de l'Index des ports, la desc du catalogue `naval-ports.json` si le lieu porte une
 * `ref`), puis trois onglets. Chantier (Réparer MDG 13 l.643 / Caréner Salissures l.150-159 /
 * Améliorations MDG 12) · Cargaison (commerce maritime l.309-399) · Escale (`EscaleTab` : événements
 * d'escale en cours surfacés + recrutement salarié). Overlay plein écran (patron `WorldMapView`),
 * sections en `.layout-sidebar`/`panel-grid` (responsive ≤900/700/560), français, aucun texte tuto
 * (les `desc` sont du VERBATIM). `initialTab` : levier de test (rendu statique) ; défaut = Chantier.
 */
export function PortView({ initialTab = 'coque' }: { initialTab?: 'coque' | 'cargaison' | 'escale' } = {}) {
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
  const hire = useGame((s) => s.portHireCrew);
  const dismiss = useGame((s) => s.portDismissCrew);
  const pendingShoreLeave = useGame((s) => s.pendingShoreLeave);
  const pendingManannPriest = useGame((s) => s.pendingManannPriest);
  const isGuest = useGame((s) => s.net.mode) === 'guest';
  const [tab, setTab] = useState<'coque' | 'cargaison' | 'escale'>(initialTab);
  const [buyEnc, setBuyEnc] = useState<Record<string, number>>({});

  const vd = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  const upgrades = useMemo(() => {
    if (!vd?.ship) return [];
    const owned = new Set((vessel?.upgrades ?? []).map((u) => u.id));
    return NAVAL_TRAITS
      .filter((t) => t.kind === 'amelioration' && t.install && !owned.has(t.id))
      .map((t) => ({ def: t, cost: installCost(t.install!, vd.ship!.lengthM, 1) }))
      .filter((u) => u.cost.gold != null);
  }, [vessel?.upgrades, vd?.ship]);

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
  const cargo = vessel.cargo ?? [];
  const catalogue = port.ref ? findNavalPortById(port.ref) : undefined;
  const hasEscaleEvent = !!(pendingShoreLeave || pendingManannPriest);

  return (
    <ScreenShell
      className="port-overlay"
      title={<><Icon id="travel/anchor" size="sm" /> Port de {port.label} — {vessel.name ?? vd.label}</>}
      onClose={close}
    >
      <PortHeader pp={port.port} catalogue={catalogue} />
      <Tabs
        className="port-tabnav"
        tabs={[
          { key: 'coque' as const, label: <><Icon id="travel/repair" size="sm" /> Chantier</> },
          { key: 'cargaison' as const, label: <><Icon id="item/misc" size="sm" /> Cargaison</> },
          { key: 'escale' as const, label: <><Icon id="travel/anchor" size="sm" /> Escale{hasEscaleEvent ? ' •' : ''}</> },
        ]}
        active={tab}
        onChange={setTab}
        trailing={<span className="port-purse">Bourse : <b><Coins money={money} /></b></span>}
      />

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
                <Icon id="travel/repair" size="sm" /> Réparer{missing > 0 ? <> — {missing} Blessure(s), <Coins money={toMoney({ gold: repairCost })} /></> : null}
              </button>
              <NotchGauge
                label="Moral"
                value={vessel.morale.score}
                max={100}
                stacked
                tone={moraleTone}
                format={(v) => `${v} — ${moraleBand(v).desc.split('.')[0]}`}
              />
              <ShipCrewWages vessel={vessel} />
              <p className="port-hint">Salissures : niveau <b>{foulLevel}</b>{vessel.crabs ? ' · crabes boxeurs' : ''}{foulLevel > 0 ? ` — ${foulingEffects(foulLevel).desc}` : ''}</p>
              <button
                type="button"
                className="btn"
                disabled={isGuest || (foulLevel <= 0 && !vessel.crabs)}
                title={foulLevel <= 0 && !vessel.crabs ? 'La coque est propre.' : `Cale sèche — ${careenPct} % du coût de base (MDG 13 l.152)`}
                onClick={careen}
              >
                <Icon id="travel/careen" size="sm" /> Caréner{careenCost > 0 ? <> — <Coins money={toMoney({ gold: careenCost })} /></> : null}
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
                        title={`${formatMoney(toMoney({ gold: cost.gold ?? 0 }))}${cost.enc ? ` · ${cost.enc} Enc` : ''} (MDG 12)`}
                        onClick={() => install(def.id, 1)}
                      >
                        Installer — <Coins money={toMoney({ gold: cost.gold ?? 0 })} />
                      </button>
                    </div>
                    <Prose md={def.desc} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : tab === 'cargaison' ? (
          <div className="layout-sidebar port-trade">
            <section className="panel port-section">
              <h3>Acheter — offres de l’escale</h3>
              <p className="port-hint">
                Cale libre : <b>{port.freeEnc} Enc</b>
                {port.maxLoadEnc > port.freeEnc && <> · surcharge possible jusqu’à <b>+{port.maxLoadEnc - port.freeEnc} Enc</b> (jusqu’à 150 %, MDG ch.12)</>}
              </p>
              {port.offers.length === 0 && <p className="port-hint">Aucune cargaison à vendre dans ce port (production « minimum vital » ou stock épuisé).</p>}
              <div className="panel-grid">
                {port.offers.map((o) => {
                  const want = buyEnc[o.cargoId] ?? Math.min(o.enc, Math.max(port.freeEnc, 1));
                  const estCost = toMoney({ gold: Math.round(want * o.basePrice) });
                  const affordable = canAfford(money, estCost);
                  const wouldOverload = want > port.freeEnc; // achat qui pousse en zone de surcharge (#243)
                  return (
                    <div key={o.cargoId} className="market-offer">
                      <div className="market-offer-head">
                        <b>{o.label}{o.surplus ? ' (Surplus)' : ''}</b>
                        <span className="port-hint">Dispo <b>{o.enc}</b> Enc · <Coins money={toMoney({ gold: o.basePrice })} />/Enc</span>
                      </div>
                      <div className={`market-offer-buy ${affordable ? '' : 'unaffordable'}`}>
                        <input
                          type="number" min={1} max={Math.min(o.enc, port.maxLoadEnc)} value={want}
                          onChange={(e) => setBuyEnc((s) => ({ ...s, [o.cargoId]: Math.max(1, Math.min(o.enc, port.maxLoadEnc, Number(e.target.value) || 1)) }))}
                        />
                        <span className="market-offer-total">Total ≈ <Coins money={estCost} /></span>
                        <button
                          type="button"
                          className="btn small"
                          disabled={isGuest || port.maxLoadEnc <= 0 || !affordable}
                          title={!affordable ? 'Bourse insuffisante' : wouldOverload ? 'Embarquer en surcharge (pénalités d’assiette, MDG ch.12)' : 'Estimation avant Marchandage'}
                          onClick={() => buy(o.cargoId, want)}
                        >
                          {wouldOverload ? 'Surcharger' : 'Acheter'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                      <td><Coins money={toMoney({ gold: lot.basePriceGold })} />/Enc</td>
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
        ) : (
          <EscaleTab
            vessel={vessel} isGuest={isGuest}
            pendingShoreLeave={pendingShoreLeave} pendingManannPriest={pendingManannPriest}
            onHire={(roleId) => hire(roleId, 1)} onDismiss={(roleId) => dismiss(roleId, 1)}
          />
        )}
      </div>
    </ScreenShell>
  );
}
