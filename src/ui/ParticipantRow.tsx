import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import { RollPanel, type RollRowData } from './RollPanel';
import { InfluenceRow } from './InfluenceRow';

/**
 * Une RANGÉE de participant d'un flux MULTI (parallèle ou séquentiel), pendant UI de la fabrique
 * `makeRollFlow` côté slot : la ligne de jet du participant (en attente puis résultat via `RollPanel`)
 * + son PROPRE cycle d'influence (`InfluenceRow` : Chance/relance gratuite/+1 DR/Pacte/Résilience)
 * une fois lancé, sinon un bouton « Lancer ». `interactive=false` → rangée TÉMOIN (lecture seule,
 * subsume `MultiRollList`). L'acteur est passé à `InfluenceRow` qui en dérive Chance/Résilience.
 */
export function ParticipantRow({
  actor,
  row,
  rolled,
  interactive = true,
  rollLabel = '🎲 Lancer',
  onRoll,
  rerollable = false,
  onReroll,
  onBonusSL,
  darkPactable,
  onDarkPact,
  onForce,
  forceShow = false,
  extra,
}: {
  actor: Combatant;
  row: RollRowData;
  rolled: boolean;
  interactive?: boolean;
  rollLabel?: string;
  onRoll?: () => void;
  rerollable?: boolean;
  onReroll?: () => void;
  onBonusSL?: () => void;
  darkPactable?: boolean;
  onDarkPact?: () => void;
  onForce?: () => void;
  forceShow?: boolean;
  /** Issue courte (« Dissipé ! », « DR net +2 ») affichée sous la ligne. */
  extra?: ReactNode;
}) {
  return (
    <div className="prow">
      <RollPanel rows={[row]} />
      {extra}
      {interactive && !rolled && onRoll && (
        <div className="prow-act">
          <button className="btn small btn-primary" onClick={onRoll}>{rollLabel}</button>
        </div>
      )}
      {interactive && rolled && (
        <InfluenceRow
          actor={actor}
          rerollable={rerollable}
          onReroll={onReroll ?? (() => {})}
          onBonusSL={onBonusSL}
          darkPactable={darkPactable}
          onDarkPact={onDarkPact}
          onForce={onForce}
          forceShow={forceShow}
        />
      )}
    </div>
  );
}
