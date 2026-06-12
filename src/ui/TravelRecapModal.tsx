import { useGame } from '../state/store';
import { Modal } from './Modal';
import { TRAVEL_MODE_LABEL } from '../engine/travel';
import { formatImperial, toDate } from '../engine/clock';
import type { TravelRecap } from '../state/travelFlow';

/**
 * Récapitulatif de voyage (audit M4) — la résolution d'un trajet est SYNCHRONE (l'horloge saute
 * en bloc) : cette modale raconte au joueur ce qui vient de se passer, jour par jour (fatigue,
 * marche forcée, péripéties), à l'ARRIVÉE, à l'INTERRUPTION (péripétie → on explique où on est
 * et comment reprendre) et à l'ARRÊT (surcharge). « Continuer le voyage » ré-ouvre la carte
 * (audit M5 — trajets d'étape en étape).
 *
 * `seam` : rendu statique de test (le store SSR sert l'état initial — cf. WorldMapView).
 */
export function TravelRecapModal({ seam }: { seam?: TravelRecap } = {}) {
  const storeRecap = useGame((s) => s.travelRecap);
  const gameTime = useGame((s) => s.gameTime);
  const dismiss = useGame((s) => s.dismissTravelRecap);
  const openWorldMap = useGame((s) => s.openWorldMap);
  const recap = seam ?? storeRecap;
  if (!recap) return null;
  const title = recap.status === 'arrived'
    ? `🧭 Arrivée à ${recap.toLabel}`
    : recap.status === 'interrupted'
      ? '🧭 Voyage interrompu !'
      : '🧭 Le convoi s\'arrête';
  const kmLeft = Math.max(0, Math.round(recap.km - recap.kmDone));
  const clock = toDate(gameTime);
  const onContinue = () => { dismiss(); openWorldMap(); };
  return (
    <Modal title={title} variant="plain" className="travel-recap" onClose={dismiss} backdropClose>
      <p className="travel-recap-route">
        {recap.fromLabel} → <b>{recap.toLabel}</b> · {recap.km} km, {TRAVEL_MODE_LABEL[recap.mode].toLowerCase()}
        {recap.status !== 'arrived' && <> · <b>{kmLeft > 0 ? `${kmLeft} km restants` : `aux portes de ${recap.toLabel}`}</b></>}
      </p>
      <ol className="travel-recap-days">
        {recap.days.map((d, i) => (
          <li key={i}>
            <span className="travel-recap-day">
              {Math.round(d.kmTo - d.kmFrom)} km en {Math.round(d.hours)} h de route
            </span>
            {d.lines.length > 0 && (
              <ul>
                {d.lines.map((l, j) => <li key={j}>{l}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {recap.status === 'arrived' && (
        <p className="travel-recap-foot">
          Le groupe arrive {clock.weekday ? `${clock.weekday.toLowerCase()}, ` : ''}le {formatImperial(gameTime)}.
        </p>
      )}
      {recap.status === 'interrupted' && (
        <p className="travel-recap-foot">Le voyage pourra reprendre depuis la carte du monde (🗺️).</p>
      )}
      {recap.status === 'stalled' && (
        <p className="travel-recap-foot">Le groupe est trop chargé pour avancer — allégez les sacs, puis reprenez depuis la carte.</p>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={dismiss}>Fermer</button>
        {recap.status === 'arrived'
          ? <button className="btn btn-primary" onClick={onContinue}>🗺️ Continuer le voyage</button>
          : <button className="btn btn-primary" onClick={onContinue}>🗺️ Ouvrir la carte</button>}
      </div>
    </Modal>
  );
}
