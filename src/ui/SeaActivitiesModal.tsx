import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { Prose } from './Prose';
import {
  SEA_ACTIVITIES_INTRO, seaActivitiesCatalog, seaActivityBlocked,
  type SeaActivityPick,
} from '../state/seaActivities';
import { findVehicleById } from '../data';
import { cargoTotalEnc } from '../engine/seaVoyage';
import { toBrass, PA_PER_CO } from '../engine/money';
import { Coins } from './Coins';

/**
 * ACTIVITÉS EN MER (MDG 15 l.266-306) — modale hebdomadaire (semaine de 8 jours, l.268) : chaque
 * héros vivant choisit AU PLUS une Activité du catalogue 'mer' (source UNIQUE `activities.json`, rail
 * réutilisé de l'interlude). Le Commerce d'opportunité (l.276) expose une mise en CO plafonnée par
 * l'Encombrement libre du navire et la bourse ; la Cartographie (l.292) expose une Planque gratuite
 * plafonnée par la bourse. « Entretien du navire » n'est PAS ici (déjà câblé au Test d'équipage
 * nocturne). Responsive : une carte par héros (`panel-grid` → 1 colonne ≤700px).
 */
export function SeaActivitiesModal() {
  const pending = useGame((s) => s.pendingSeaActivities);
  const party = useGame((s) => s.party);
  const money = useGame((s) => s.money);
  const confirm = useGame((s) => s.seaActivitiesConfirm);
  const vessel = useGame((s) => s.vessel);
  const freeEnc = vessel
    ? Math.max(0, (findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0) - cargoTotalEnc(vessel.cargo ?? []))
    : 0;
  const catalog = useMemo(() => seaActivitiesCatalog(), []);
  const [picks, setPicks] = useState<Record<string, SeaActivityPick | null>>({});
  if (!pending) return null;
  const heroes = party.filter((h) => !h.dead && !h.outOfRencontre);
  const investCap = Math.min(freeEnc, Math.floor(toBrass(money) / PA_PER_CO));
  const stashCap = Math.floor(toBrass(money) / PA_PER_CO);
  const set = (id: string, pick: SeaActivityPick | null) => setPicks((p) => ({ ...p, [id]: pick }));

  return (
    <Modal title="⚓ Activités en mer — semaine écoulée" variant="plain" className="sea-activities">
      <div className="sea-act-intro"><Prose md={SEA_ACTIVITIES_INTRO} /></div>
      <div className="panel-grid">
        {heroes.map((h) => {
          const pick = picks[h.id];
          const chosen = pick?.activityId ?? '';
          return (
            <section key={h.id} className="panel sea-act-hero">
              <h4><CharFrame c={h} variant="identity" size="xs" /> {h.name}</h4>
              <div className="sea-act-choices">
                <button
                  type="button"
                  className={`btn small ${!chosen ? 'btn-primary' : ''}`}
                  onClick={() => set(h.id, null)}
                >
                  Repos
                </button>
                {catalog.map((def) => {
                  const blocked = seaActivityBlocked(useGame.getState, def);
                  return (
                    <button
                      key={def.id}
                      type="button"
                      className={`btn small ${chosen === def.id ? 'btn-primary' : ''}`}
                      disabled={!!blocked}
                      title={blocked ?? def.label}
                      onClick={() => set(h.id, { activityId: def.id })}
                    >
                      {def.label}
                    </button>
                  );
                })}
              </div>
              {chosen && (
                <div className="sea-act-detail">
                  <Prose md={catalog.find((d) => d.id === chosen)?.desc ?? ''} />
                  {catalog.find((d) => d.id === chosen)?.resolver === 'opportunityTrade' && (
                    <label className="sea-act-invest">
                      Mise (CO, max {investCap})
                      <input
                        type="number"
                        min={0}
                        max={investCap}
                        value={pick?.investGold ?? 0}
                        onChange={(e) => set(h.id, { activityId: chosen, investGold: Math.max(0, Math.min(investCap, Number(e.target.value) || 0)) })}
                      />
                    </label>
                  )}
                  {catalog.find((d) => d.id === chosen)?.resolver === 'seaChart' && (
                    <label className="sea-act-invest">
                      Planque gratuite (CO, max {stashCap})
                      <input
                        type="number"
                        min={0}
                        max={stashCap}
                        value={pick?.stashGold ?? 0}
                        onChange={(e) => set(h.id, { activityId: chosen, stashGold: Math.max(0, Math.min(stashCap, Number(e.target.value) || 0)) })}
                      />
                    </label>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="sea-act-purse">Bourse du groupe : <b><Coins money={money} /></b> · Cale libre : <b>{freeEnc} Enc</b></p>
      <div className="modal-actions">
        <button type="button" className="btn btn-primary" onClick={() => confirm(picks)}>Valider la semaine</button>
      </div>
    </Modal>
  );
}
