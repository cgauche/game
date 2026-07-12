import { useGame } from '../state/store';
import { WindRose } from './WindRose';
import { NotchGauge } from './NotchGauge';
import { MultiRollList } from './MultiRollList';
import { RecapLineList } from './RecapLine';
import { Icon } from './Icon';
import type { Dir8 } from '../state/dir8';
import { windDirectionLabel, type SeaWindForceId } from '../engine/seaWeather';
import type { TravelRecapDay } from '../state/travelFlow';

/** Cap de mer (`WindDirection` : nord/sud/est/ouest) → `Dir8` (vocabulaire rose des vents du projet). */
const HEADING_TO_DIR8: Record<string, Dir8> = { nord: 'N', sud: 'S', est: 'E', ouest: 'O' };

/**
 * ÉCRAN DE TRAVERSÉE (mer) — remplace le corps de recap TERRESTRE quand la journée est une journée de
 * MER (route COMMANDÉE) : rose des vents (vent du jour + cap), jauges compactes (coque / moral), le
 * PROCÈS-VERBAL du jour qui DÉFILE (`MultiRollList` — chaque jet de routine auto-résolu y a sa ligne),
 * distance/jours restants, et le bouton « Passer en jour-par-jour » (bascule des ordres). Monté DANS la
 * halte de nuit (registre modal canonique via `RestModal`/`TravelDayBody`) — l'événement, lui, ouvre sa
 * propre modale puis la traversée reprend.
 */
export function SeaVoyageBody({ day }: { day: TravelRecapDay }) {
  const chrome = day.sea!;
  const cadence = useGame((s) => s.travelPlan?.orders?.cadence);
  const setCadence = useGame((s) => s.setVoyageCadence);
  const active = !!useGame((s) => s.travelPlan); // la bascule n'a de sens que tant que la traversée dure
  return (
    <div className="sea-voyage">
      <div className="sea-voyage-head">
        <WindRose dir={HEADING_TO_DIR8[chrome.windFrom] ?? 'N'} force={chrome.windForce as SeaWindForceId} heading={HEADING_TO_DIR8[chrome.heading] ?? 'N'} size="md" />
        <div className="sea-voyage-gauges">
          <NotchGauge label="Coque" icon={<Icon id="scenario/port" size="sm" />} value={chrome.hull.current} max={chrome.hull.max}
            tone={(v, m) => (v <= m * 0.25 ? 'danger' : v <= m * 0.5 ? 'warn' : 'ok')} stacked />
          <NotchGauge label="Moral" value={chrome.morale} max={100}
            tone={(v) => (v <= 25 ? 'danger' : v <= 50 ? 'warn' : 'ok')} stacked />
          {chrome.waterLitres != null && (
            <NotchGauge label="Eau (autonomie)" value={chrome.waterLitres} max={Math.max(chrome.waterLitres, 1)}
              format={(v) => `${v} L`} tone={(v) => (v <= 0 ? 'danger' : 'neutral')} stacked />
          )}
        </div>
      </div>
      {/* Méta du jour en CARTOUCHES label+valeur (primitive `.stat-chip`, §charte-ui) — plus de phrase
          concaténée ni d'ids bruts (vent/cap en libellés, arbitrage user 2026-07-11). */}
      <div className="sea-voyage-meta row-flex">
        <span className="sv-weather">{chrome.weatherLabel}</span>
        <span className="stat-chip"><span className="sc-label">Vent</span><span className="sc-value">{windDirectionLabel(chrome.windFrom)}</span></span>
        <span className="stat-chip"><span className="sc-label">Cap</span><span className="sc-value">{windDirectionLabel(chrome.heading)}</span></span>
        <span className="stat-chip"><span className="sc-label">Distance</span><span className="sc-value">{chrome.milesLeft} milles{chrome.daysLeft > 0 ? ` · ~${chrome.daysLeft} j` : ''}</span></span>
        {chrome.manann !== 0 && <span className="stat-chip"><span className="sc-label">Manann</span><span className="sc-value">{chrome.manann >= 0 ? `+${chrome.manann}` : chrome.manann}</span></span>}
      </div>
      {/* Le PV du jour DÉFILE : une ligne par jet de routine auto-résolu (aucun jet silencieux). */}
      {(day.entries?.length ?? 0) > 0
        ? <div className="sea-voyage-log"><MultiRollList entries={day.entries!} /></div>
        : day.lines.length > 0 && <RecapLineList lines={day.lines} />}
      {(day.entries?.length ?? 0) > 0 && day.lines.length > 0 && (
        <div className="sea-voyage-notes"><RecapLineList lines={day.lines} /></div>
      )}
      {active && (
        <div className="sea-voyage-orders">
          {cadence === 'commande'
            ? <button type="button" className="btn small" onClick={() => setCadence('jour-par-jour')} title="Reprendre la main : chaque Test d'équipage ouvrira sa modale.">Passer en jour-par-jour</button>
            : <button type="button" className="btn small" onClick={() => setCadence('commande')} title="Rendre la barre à l'équipage : les Tests de routine s'auto-résolvent au procès-verbal.">Repasser en traversée commandée</button>}
        </div>
      )}
    </div>
  );
}
