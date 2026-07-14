import { Fragment } from 'react';
import { MetalStatus } from './MetalStatus';
import type { CareerLevelData } from '../data';

/**
 * CareerPath — chemin d'évolution d'une carrière en 4 niveaux (médaillons niveau/nom/statut,
 * motif `.cc-path`/`.cc-step` du kit ratifié « Atelier du scribe », #412). Consomme les
 * `CareerLevelData` réels d'une carrière (`levelsForCareer`, `src/data`) — jamais de niveau inventé.
 */
export function CareerPath({ levels, currentLevel }: {
  /** Niveaux de la carrière, triés (`levelsForCareer`). */
  levels: CareerLevelData[];
  /** Niveau courant du héros — met en évidence son médaillon (`.now`). */
  currentLevel?: number;
}) {
  return (
    <div className="cc-path row-flex" role="list" aria-label="Chemin de carrière">
      {levels.map((lvl, i) => (
        <Fragment key={lvl.level}>
          {i > 0 && <span className="cc-link" aria-hidden="true" />}
          <div className={`cc-step${lvl.level === currentLevel ? ' now' : ''}`} role="listitem">
            <span className="cc-step-lv">Niveau {lvl.level}</span>
            <span className="cc-step-nm">{lvl.label}</span>
            <MetalStatus status={lvl.status} size="chip" />
          </div>
        </Fragment>
      ))}
    </div>
  );
}
