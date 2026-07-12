import type { RecapLine } from '../state/recapLine';
import { groupRecapLinesByPhase } from '../state/recapLine';
import { Icon } from './Icon';

/**
 * RENDERER UNIQUE d'une ligne de récap structurée (#349) — icône + texte teinté par `tone` (mêmes
 * classes que le PV multijet, `.mrl-row.ok`/`.bad`, `styles/hud.css`). Consommé par `CascadeModal`
 * (note de conséquence d'étape), `TravelDayBody`/`SeaVoyageBody` (jour de voyage) et `dayCardSummary`
 * (résumé de carte, via `.text`) — UN seul rendu de ligne, pas une chaîne recomposée par surface.
 */
export function RecapLineRow({ line }: { line: RecapLine }) {
  return (
    <p className={`recap-line ${line.tone ?? ''}`}>
      {line.icon && <Icon id={line.icon} size="sm" />} {line.text}
    </p>
  );
}

export function RecapLineList({ lines }: { lines: RecapLine[] }) {
  if (!lines.length) return null;
  return <div className="recap-lines">{lines.map((l, i) => <RecapLineRow key={i} line={l} />)}</div>;
}

/** Rendu SECTIONNÉ par phase (dette 3, #349) — jour CLOS de la chronique de voyage : les lignes
 *  émises par la cascade `travelDay` portent déjà `phase` (`state/travelFlow.stepRecapLines`), le
 *  groupage tombe GRATUITEMENT (`groupRecapLinesByPhase`, MÊME catalogue que l'agenda du jour EN
 *  COURS). Un jour SANS ligne phasée (mer/fleuve) rend un seul groupe SANS titre — comportement
 *  identique à `RecapLineList`. */
export function RecapLineSections({ lines }: { lines: RecapLine[] }) {
  if (!lines.length) return null;
  const groups = groupRecapLinesByPhase(lines);
  return (
    <div className="recap-lines">
      {groups.map((g) => (
        <div key={g.key || '_'} className="recap-phase">
          {g.label && <p className="recap-phase-label">{g.label}</p>}
          {g.lines.map((l, i) => <RecapLineRow key={i} line={l} />)}
        </div>
      ))}
    </div>
  );
}
