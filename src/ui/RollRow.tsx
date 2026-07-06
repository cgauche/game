import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import { RollPanel, type PanelRowData } from './RollPanel';
import { InfluenceRow } from './InfluenceRow';
import { ResilienceButton } from './ResilienceButton';
import { ResistButton } from './ResistButton';
import { ForcedRollPicker } from './ForcedRollPicker';
import { useRollFrisson } from './useRollFrisson';
import { Icon } from './Icon';

/** Libellé par défaut du bouton « Lancer » (rangée seule ET coquille `RollShell` hissée). */
export const DEFAULT_ROLL_LABEL = <><Icon id="nav/dice" size="sm" /> Lancer</>;

/**
 * Une RANGÉE de jet (mono OU participant d'un flux MULTI), pendant UI de la fabrique `makeRollFlow`
 * côté slot : la ligne de jet (en attente puis résultat via `RollPanel`) + son PROPRE cycle
 * d'influence (`InfluenceRow` : Chance/relance gratuite/+1 DR/Pacte/Résilience) une fois lancé,
 * sinon un bouton « Lancer ». `interactive=false` → rangée TÉMOIN (lecture seule, subsume
 * `MultiRollList`). L'acteur, quand fourni, est passé à `InfluenceRow` qui en dérive
 * Chance/relance gratuite/Résilience ; sinon les primitives `fortune`/`freeReroll`/`resilience`
 * (prioritaires) permettent une rangée sans objet `Combatant` (vues pures testables).
 */
export function RollRow({
  actor,
  fortune,
  freeReroll,
  resilience,
  row,
  rolled,
  interactive = true,
  rollLabel = DEFAULT_ROLL_LABEL,
  onRoll,
  rerollable = false,
  onReroll,
  onBonusSL,
  darkPactable,
  onDarkPact,
  onForce,
  preRollForce,
  forceShow = false,
  forcedRoll,
  determination,
  resist,
  rollFrisson = false,
  rollInBar = false,
  winner,
  extra,
}: RollRowProps) {
  // Frisson du jet (helper partagé avec le bouton « Lancer » hissé dans la barre du RollShell).
  const { rolling, trigger: doRoll } = useRollFrisson(onRoll, { frisson: rollFrisson });
  const resil = resilience ?? actor?.resilience ?? 0;
  const determineBtn = determination && determination.resolve > 0 && (
    <button
      className="btn btn-resource"
      onClick={determination.onResolve}
      title="Dépense 1 Détermination : immunité à la Psychologie jusqu'à la fin du prochain Round"
    >
      <Icon id="resource/resolve" size="sm" /> Détermination ×{determination.resolve}
    </button>
  );
  return (
    <div className="prow">
      {/* Accent gagnant/perdant du Test opposé porté PAR la rangée (le panneau est mono → indice 0 = cette ligne :
          `winnerIndex=0` → `rr-win`, `≠0` → `rr-lose`). Le badge « DR net » reste au niveau RollShell (source unique). */}
      <RollPanel rows={[row]} winnerIndex={winner === 'win' ? 0 : winner === 'lose' ? 1 : null} />
      {extra}
      {interactive && !rolled && (
        // `rollInBar` : la coquille (RollShell) rend le « Lancer » ET son spinner dans `.modal-actions`
        // (cas mono, une seule rangée à lancer) → la rangée n'affiche plus que ses contrôles pré-jet.
        rolling && !rollInBar ? (
          <div className="rm-rolling"><span className="rm-die"><Icon id="nav/dice" /></span></div>
        ) : (
          <div className="prow-act">
            {/* Résilience PRÉ-jet (LDB 17 l.73 « au lieu de lancer les dés ») — disponible AVANT de lancer, pas
                seulement après un échec, comme la coquille `RollShell`. */}
            {onForce && <ResilienceButton resilience={resil} show onForce={preRollForce ?? onForce} />}
            {/* Résistance (Menace) PRÉ-jet (LDB 10 : « réussir automatiquement le premier Test »). */}
            {resist && <ResistButton menace={resist.menace} show onResist={resist.onResist} />}
            {determineBtn}
            {onRoll && !rollInBar && <button className="btn small btn-primary" onClick={doRoll}>{rollLabel}</button>}
          </div>
        )
      )}
      {interactive && rolled && (
        <>
          {forcedRoll && <ForcedRollPicker {...forcedRoll} />}
          <InfluenceRow
            actor={actor}
            fortune={fortune}
            freeReroll={freeReroll}
            resilience={resilience}
            rerollable={rerollable}
            onReroll={onReroll ?? (() => {})}
            onBonusSL={onBonusSL}
            darkPactable={darkPactable}
            onDarkPact={onDarkPact}
            onForce={onForce}
            forceShow={forceShow}
          >
            {resist && <ResistButton menace={resist.menace} show onResist={resist.onResist} />}
            {forceShow && determineBtn}
          </InfluenceRow>
        </>
      )}
    </div>
  );
}

export interface RollRowProps {
  /** L'acteur du jet : Chance/relance gratuite/Résilience en sont DÉRIVÉES (passé une fois). Optionnel :
   *  une vue pure fournit plutôt les primitives `fortune`/`freeReroll`/`resilience`. */
  actor?: Combatant;
  /** Primitives — PRIORITAIRES sur `actor` quand fournies (rangée sans `Combatant`, testable). */
  fortune?: number;
  freeReroll?: boolean;
  resilience?: number;
  row: PanelRowData;
  rolled: boolean;
  interactive?: boolean;
  rollLabel?: ReactNode;
  onRoll?: () => void;
  rerollable?: boolean;
  onReroll?: () => void;
  onBonusSL?: () => void;
  darkPactable?: boolean;
  onDarkPact?: () => void;
  /** Absent → pas de Résilience sur ce flux. */
  onForce?: () => void;
  /** Action Résilience PRÉ-jet spécifique (défaut : `onForce`). */
  preRollForce?: () => void;
  forceShow?: boolean;
  /** « vous choisissez le résultat » (LDB 17 l.73) : sélecteur du dé d'un Test FORCÉ. Absent → pas de sélecteur. */
  forcedRoll?: { roll: number; target: number; onSet: (roll: number) => void; critable?: boolean };
  /** Détermination (LDB 17 l.62) : immunité Psychologie. */
  determination?: { resolve: number; onResolve: () => void };
  /** Résistance (Menace) (LDB 10) : auto-succès du talent — fourni quand disponible ET issue encore
   *  défavorable (le parent décide). Affiché AVANT le jet et après un échec. */
  resist?: { menace: string; onResist: () => void };
  /** Anime le jet (« frisson » ~480 ms) avant de résoudre. Honore reduced-motion. */
  rollFrisson?: boolean;
  /** La coquille (`RollShell`, cas mono) rend « Lancer » + son spinner dans `.modal-actions` :
   *  la rangée n'affiche alors NI le bouton inline NI le spinner (le reste — influence, Résilience
   *  pré-jet, résistance — inchangé). Le shell le pose lui-même ; les hooks/modales n'y touchent pas. */
  rollInBar?: boolean;
  /** Test opposé : accent de CETTE rangée (`'win'` = gagnante accentuée, `'lose'` = perdante atténuée).
   *  Traduit en `winnerIndex` du panneau mono. Absent/`null` → pas d'accent (jet non opposé). */
  winner?: 'win' | 'lose' | null;
  /** Issue courte (« Dissipé ! », « DR net +2 ») affichée sous la ligne. */
  extra?: ReactNode;
}
