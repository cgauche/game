import { useState } from 'react';
import { useGame } from '../state/store';
import type { CampaignVessel } from '../state/store';
import type { Combatant } from '../engine/types';
import { findVehicleById } from '../data';
import { findCargoById, findManannFactor, cargoTotalEnc } from '../engine/seaVoyage';
import { foulingEffects } from '../engine/seaNavigation';
import { moraleBand, weeklyCrewWageBrass, findMoraleFactor } from '../engine/crewMorale';
import { provisioningManifest } from '../engine/provisions';
import { fromBrass, formatMoney } from '../engine/money';
import { Icon } from './Icon';
import { NotchGauge, type GaugeTone } from './NotchGauge';
import { moraleTone, crewRoleLabel } from './shipStatus';

/**
 * DOSSIER DE NAVIRE persistant (#227, attendu C.1) — écran plein-champ du `CampaignVessel` (l'INSTANCE
 * qui survit aux jours et aux combats), ouvert EN et HORS combat depuis le bandeau d'actions. Toutes les
 * données existent déjà sur `vessel` (aucun trou moteur) : c'est l'écran qui les compose avec les
 * primitives partagées (jauges à crans `NotchGauge`, ton de Moral `moraleTone`, résumé d'équipage salarié
 * `ShipCrewWages`). Overlay `.worldmap-overlay` + onglets `.port-tabs` (patron de PortView) ; responsive
 * ≤900/700/560 via `.layout-sidebar`/`.panel-grid`. La coque reste une JAUGE (pas de silhouette à
 * localisations — arbitrage USER). La fiche de combat `PosteSheet` (postes/manœuvre) reste distincte.
 */

/** Gréement (colonne de Localisation des Dégâts, MDG ch.13) → libellé d'affichage. */
const RIG_LABEL: Record<string, string> = { avirons: 'Avirons', voile: 'Voile', mixte: 'Mixte (voile et avirons)' };

/** Humeur de Manann (MDG ch.15) → ton par SIGNE : favorable = ok, courroucée = danger, neutre = neutral. */
const manannTone = (score: number): GaugeTone => (score > 0 ? 'ok' : score < 0 ? 'danger' : 'neutral');

/** Surcharge de soute : fraction de la Contenance occupée → ton (pleine = danger, proche = warn). */
const cargoTone = (enc: number, cap: number): GaugeTone => {
  const frac = cap > 0 ? enc / cap : 0;
  return frac >= 1 ? 'danger' : frac >= 0.8 ? 'warn' : 'ok';
};

/** Coque : fraction de Blessures restantes → ton (basse = danger, entamée = warn). */
const hullTone = (cur: number, max: number): GaugeTone => {
  const frac = max > 0 ? cur / max : 1;
  return frac <= 0.25 ? 'danger' : frac <= 0.5 ? 'warn' : 'ok';
};

type DossierTab = 'apercu' | 'cargaison' | 'equipage';

/** Coquille store-connectée : le dossier lit le navire de campagne PERSISTANT et l'équipage joueur. */
export function ShipDossier({ onClose, initialTab }: { onClose: () => void; initialTab?: DossierTab }) {
  const vessel = useGame((s) => s.vessel);
  const party = useGame((s) => s.party);
  if (!vessel) return null;
  return <ShipDossierView vessel={vessel} party={party} onClose={onClose} initialTab={initialTab} />;
}

/** Corps PUR (props) — testable en rendu statique (l'environnement de test est `node`, sans DOM :
 *  les sélecteurs de store ne s'hydratent pas sous `renderToStaticMarkup`, on passe donc les données). */
export function ShipDossierView({ vessel, party, onClose, initialTab = 'apercu' }: { vessel: CampaignVessel; party: Combatant[]; onClose: () => void; initialTab?: DossierTab }) {
  const [tab, setTab] = useState<DossierTab>(initialTab);

  const vd = findVehicleById(vessel.vehicleId);
  if (!vd?.ship) return null;

  const name = vessel.name ?? vd.label;
  const rig = vd.hull?.rig;
  const woundsMax = vessel.wounds?.max ?? vd.hull?.char.B ?? 0;
  const woundsCur = vessel.wounds?.current ?? woundsMax;
  const missing = woundsMax - woundsCur;

  const capacity = vd.ship.capacity;
  const cargo = vessel.cargo ?? [];
  const cargoEnc = cargoTotalEnc(cargo);

  const manann = vessel.manann;
  const manannScore = manann?.score ?? 0;
  const manannBound = Math.max(20, Math.abs(manannScore) + 5); // domaine centré sur 0, contient toujours la valeur

  const foulLevel = vessel.fouling?.level ?? 0;
  const criticals = vessel.criticals ?? [];

  // Autonomie en eau (jours) : `provisioningManifest` donne l'eau requise/jour de l'équipage joueur
  // (constat #241 : seuls les héros consomment) — autonomie = eau embarquée ÷ besoin quotidien.
  const dailyWater = provisioningManifest(party, vessel.waterLitres, 1).eauRequiseLitres;
  const autonomyDays = vessel.waterLitres != null && dailyWater > 0 ? Math.floor(vessel.waterLitres / dailyWater) : null;

  const weeklyWageBrass = weeklyCrewWageBrass(vessel.crew);

  return (
    <div className="worldmap-overlay port-overlay ship-dossier">
      <div className="worldmap-head">
        <h2>
          <Icon id="travel/sail-ship" size="sm" /> {name}
          <span className="char-sub"> — {vd.label}{rig ? ` · ${RIG_LABEL[rig] ?? rig}` : ''}</span>
        </h2>
        <button type="button" className="btn small" onClick={onClose}>✕ Fermer</button>
      </div>

      <div className="port-tabs">
        <button type="button" className={`btn small ${tab === 'apercu' ? 'btn-primary' : ''}`} onClick={() => setTab('apercu')}><Icon id="scenario/naval" size="sm" /> Vue d’ensemble</button>
        <button type="button" className={`btn small ${tab === 'cargaison' ? 'btn-primary' : ''}`} onClick={() => setTab('cargaison')}><Icon id="item/misc" size="sm" /> Cargaison</button>
        <button type="button" className={`btn small ${tab === 'equipage' ? 'btn-primary' : ''}`} onClick={() => setTab('equipage')}><Icon id="nav/seat-owner" size="sm" /> Équipage</button>
      </div>

      <div className="port-body">
        {tab === 'apercu' && (
          <div className="layout-sidebar port-yard">
            <section className="panel port-section">
              <h3>Jauges</h3>
              <NotchGauge label="Coque" value={woundsCur} max={woundsMax} stacked tone={hullTone} />
              <NotchGauge
                label="Moral"
                value={vessel.morale.score}
                max={100}
                stacked
                tone={moraleTone}
                format={(v) => `${v} — ${moraleBand(v).desc.split('.')[0]}`}
              />
              <NotchGauge
                label="Humeur de Manann"
                value={manannScore}
                min={-manannBound}
                max={manannBound}
                stacked
                tone={manannTone}
                marks={[0]}
                format={(v) => `${v > 0 ? '+' : ''}${v}`}
              />
              <NotchGauge
                label="Soute"
                value={cargoEnc}
                max={capacity}
                stacked
                tone={cargoTone}
                format={(v, m) => `${v} / ${m} Enc`}
              />
            </section>

            <section className="panel port-section">
              <h3>État</h3>
              <p className="port-hint">Salissures : niveau <b>{foulLevel}</b>{vessel.crabs ? ' · crabes boxeurs' : ''}{foulLevel > 0 ? ` — ${foulingEffects(foulLevel).desc}` : ''}</p>
              {missing > 0 && <p className="port-hint">Avarie de coque : <b>{missing}</b> Blessure(s) à réparer au chantier.</p>}
              {criticals.length > 0 && (
                <div>
                  <p className="port-hint">Critiques de coque actifs :</p>
                  <ul className="ship-dossier-list">
                    {criticals.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {vessel.saboteurDR ? <p className="port-hint">Sabotage actif : <b>{vessel.saboteurDR} DR</b> aux Tests d’équipage (MDG ch.14).</p> : null}
              <p className="port-hint">
                Eau douce : <b>{vessel.waterLitres != null ? `${vessel.waterLitres} L` : 'ravitaillement réputé assuré'}</b>
                {autonomyDays != null ? ` · autonomie ~${autonomyDays} jour(s)` : ''}
              </p>
              <p className="port-hint">Dernière traversée : <b>{vessel.lastVoyageMilles != null ? `${vessel.lastVoyageMilles} milles` : 'à quai depuis la mise à l’eau'}</b></p>
            </section>

            <section className="panel port-section">
              <h3>Humeur de Manann</h3>
              <p className="port-hint">Score courant : <b>{manannScore > 0 ? '+' : ''}{manannScore}</b> (MDG ch.15).</p>
              <details className="ship-dossier-details">
                <summary>Facteurs appliqués ({manann?.applied.length ?? 0})</summary>
                {manann?.applied.length ? (
                  <ul className="ship-dossier-list">
                    {manann.applied.map((id) => <li key={id}>{findManannFactor(id)?.label ?? id}</li>)}
                  </ul>
                ) : <p className="port-hint">Aucun facteur appliqué à ce navire.</p>}
              </details>
            </section>
          </div>
        )}

        {tab === 'cargaison' && (
          <div className="layout-sidebar port-trade">
            <section className="panel port-section">
              <h3>Cale</h3>
              <NotchGauge label="Soute" value={cargoEnc} max={capacity} stacked tone={cargoTone} format={(v, m) => `${v} / ${m} Enc`} />
              {cargo.length === 0 ? (
                <p className="port-hint">La cale est vide.</p>
              ) : (
                <table className="port-table">
                  <thead><tr><th>Lot</th><th>Enc</th></tr></thead>
                  <tbody>
                    {cargo.map((lot, i) => (
                      <tr key={i}>
                        <td>{findCargoById(lot.cargoId)?.label ?? lot.cargoId}</td>
                        <td>{lot.enc}</td>
                      </tr>
                    ))}
                    <tr><td><b>Total</b></td><td><b>{cargoEnc} / {capacity}</b></td></tr>
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}

        {tab === 'equipage' && (
          <div className="layout-sidebar port-yard">
            <section className="panel port-section">
              <h3>Équipage salarié</h3>
              {vessel.crew?.length ? (
                <table className="port-table">
                  <thead><tr><th>Rôle</th><th>Nombre</th><th>Salaire / semaine</th></tr></thead>
                  <tbody>
                    {vessel.crew.map((h) => (
                      <tr key={h.roleId}>
                        <td>{crewRoleLabel(h.roleId)}</td>
                        <td>{h.count}</td>
                        <td><b>{formatMoney(fromBrass(weeklyCrewWageBrass([h])))}</b></td>
                      </tr>
                    ))}
                    <tr>
                      <td><b>Solde hebdomadaire</b></td>
                      <td />
                      <td><b>{formatMoney(fromBrass(weeklyWageBrass))}</b></td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="port-hint">Aucun équipage salarié embauché.</p>
              )}
              {vessel.wagesOwed ? <p className="port-hint">Dette de paie cumulée : <b>{formatMoney(fromBrass(vessel.wagesOwed))}</b> (bourse insuffisante à l’entretien).</p> : null}
              <p className="port-hint">Le roster est agrégé par RÔLE (nombre × salaire) — pas d’individus nommés (MDG 14).</p>
            </section>

            <section className="panel port-section">
              <h3>Moral de l’équipage</h3>
              <p className="port-hint">
                Score courant : <b>{vessel.morale.score}</b> — {moraleBand(vessel.morale.score).desc.split('.')[0]}.
              </p>
              <p className="port-hint">Facteurs en cours (vers le prochain conseil de bord) :</p>
              {vessel.morale.factors.length ? (
                <ul className="ship-dossier-list">
                  {vessel.morale.factors.map((id) => {
                    const f = findMoraleFactor(id);
                    return <li key={id}>{f?.label ?? id}{f ? ` (${f.effect})` : ''}</li>;
                  })}
                </ul>
              ) : (
                <p className="port-hint">Aucun facteur actif — seule la paie hebdomadaire pèsera au conseil.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
