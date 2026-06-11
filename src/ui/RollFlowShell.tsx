import type { ReactNode } from 'react';
import type { RollBreakdown } from '../engine/combat';
import { bus, EVT } from '../state/bus';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';
import { RollPanel, type RollRowData } from './RollPanel';
import { Modal } from './Modal';

// Dé d100 canonique (désormais animé) — ré-exporté pour les modales qui l'importaient d'ici.
export { Dice } from './Dice';

/**
 * Coquille PARTAGÉE des modales de jet différé (invariante « un jet = une modale ») — pendant UI de
 * la fabrique `state/rollFlow.ts`. Toutes suivent le même squelette :
 *
 *   overlay → titre → sous-titre → panneau de jet (`RollPanel`, pré-rempli ou rempli) → issue
 *   style journal → rangée « influencer le jet » (ressources contextuelles : Chance / Pacte /
 *   Résilience / Détermination) → barre d'actions (2 boutons max : Annuler · primaire).
 *
 * La modale concrète ne fournit QUE sa partie spécifique : titre, sous-titre, ligne(s) de jet
 * (`breakdown` → RollPanel) + issue style journal (`outcome`), et les handlers du flux.
 * Variantes couvertes par props :
 * - `variant` : famille de classes ('roll' = roll-modal/rm-vs ; 'test' = test-modal/test-actor) ;
 * - `onBonusSL` absent : Test binaire → pas de bouton « +1 DR » ;
 * - `onForce` absent : pas de Résilience (flux sans « Réussite garantie ») ;
 * - `preRollForce` : action Résilience pré-jet spécifique (ex. Piétinement : lancer PUIS forcer) ;
 * - `cancelFirst` historique : « Annuler » est désormais TOUJOURS à gauche (barre normée) ;
 *   `cancelAfterRoll` : Annuler aussi après le jet (Piétinement, Focalisation) ;
 * - `rows`/`winnerIndex`/`netSL` : Test opposé riche (portraits + vainqueur accentué).
 */
export function RollFlowShell({
  variant = 'roll',
  title,
  subtitle,
  extra,
  rolled,
  rollLabel = '🎲 Lancer',
  onRoll,
  onCancel,
  cancelAfterRoll = false,
  breakdown,
  rows,
  winnerIndex,
  netSL,
  outcome,
  determination,
  fortune,
  rerollable,
  onReroll,
  freeReroll,
  onBonusSL,
  darkPactable,
  onDarkPact,
  resilience = 0,
  onForce,
  preRollForce,
  forceShow = false,
  confirmLabel = 'Appliquer',
  onConfirm,
}: {
  variant?: 'roll' | 'test';
  title: ReactNode;
  subtitle: ReactNode;
  /** Contenu optionnel entre le sous-titre et le jet (ex. sélecteur de cible du soin, portraits). */
  extra?: ReactNode;
  rolled: boolean;
  rollLabel?: string;
  onRoll: () => void;
  /** Absent → pas de bouton « Annuler ». */
  onCancel?: () => void;
  /** @deprecated la barre normée place toujours « Annuler » à gauche. */
  cancelFirst?: boolean;
  cancelAfterRoll?: boolean;
  /** Ligne(s) de jet riche(s) (base = cible · d100 · DR), façon Attaque/Défense — un tableau pour
   *  les Tests opposés (acteur puis opposant). */
  breakdown?: RollBreakdown | RollBreakdown[];
  /** Lignes riches avec portraits (prioritaire sur `breakdown` si fourni). */
  rows?: RollRowData[];
  /** Test opposé : index de la ligne gagnante (accent) + DR net (badge). */
  winnerIndex?: number | null;
  netSL?: number;
  /** Ligne d'issue style journal sous la ligne de jet (le « log » de l'action). */
  outcome?: ReactNode;
  /** Détermination (LDB 17 l.62) : immunité Psychologie. Affiché pré-jet et après échec. */
  determination?: { resolve: number; onResolve: () => void };
  fortune: number;
  rerollable: boolean;
  onReroll: () => void;
  /** Bénédiction de Chance (LDB 41) : relance gratuite disponible (actif même à 0 Chance). */
  freeReroll?: boolean;
  /** Absent → Test binaire : pas de « +1 DR ». */
  onBonusSL?: () => void;
  /** Sombre Pacte (LDB 19 l.41) : +1 Corruption pour relancer le Test raté, même déjà relancé. */
  darkPactable?: boolean;
  onDarkPact?: () => void;
  resilience?: number;
  /** Absent → pas de Résilience sur ce flux. */
  onForce?: () => void;
  /** Action Résilience pré-jet (défaut : `onForce`). */
  preRollForce?: () => void;
  /** Montre la Résilience APRÈS le jet (condition d'échec propre au flux). */
  forceShow?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const subClass = variant === 'test' ? 'test-actor' : 'rm-vs';
  const cancelBtn = onCancel && (
    <button className="btn btn-ghost" onClick={onCancel}>
      Annuler
    </button>
  );
  const determineBtn = determination && determination.resolve > 0 && (
    <button
      className="btn btn-resource"
      onClick={determination.onResolve}
      title="Dépense 1 Détermination : immunité à la Psychologie jusqu'à la fin du prochain Round (LDB 17 l.62)"
    >
      ✊ Détermination ×{determination.resolve}
    </button>
  );
  const panelRows: RollRowData[] | undefined =
    rows ?? (breakdown ? (Array.isArray(breakdown) ? breakdown : [breakdown]).map((d) => ({ d })) : undefined);
  // Échap = Annuler, exactement quand le bouton Annuler est visible (pré-jet, ou post-jet si le flux le permet).
  const escClose = (!rolled || cancelAfterRoll) ? onCancel : undefined;
  return (
    <Modal title={title} variant={variant} onClose={escClose}>
      <p className={subClass}>{subtitle}</p>
      {extra}
      {!rolled ? (
        <>
          <div className="rm-influence">
            {/* Résilience AVANT le jet (LDB 17 l.73 : « au lieu de lancer les dés »). */}
            {onForce && <ResilienceButton resilience={resilience} show={resilience > 0} onForce={preRollForce ?? onForce} />}
            {determineBtn}
          </div>
          <div className="modal-actions">
            {cancelBtn}
            <button className="btn btn-primary" onClick={() => { bus.emit(EVT.DICE_ROLL); onRoll(); }}>
              {rollLabel}
            </button>
          </div>
        </>
      ) : (
        <>
          {panelRows && <RollPanel rows={panelRows} winnerIndex={winnerIndex} netSL={netSL} />}
          {outcome}
          <div className="rm-influence">
            <ChanceButtons
              fortune={fortune}
              rerollable={rerollable}
              onReroll={onReroll}
              freeReroll={freeReroll}
              onBonusSL={onBonusSL}
              darkPactable={darkPactable}
              onDarkPact={onDarkPact}
            />
            {onForce && <ResilienceButton resilience={resilience} show={forceShow} onForce={onForce} />}
            {forceShow && determineBtn}
          </div>
          <div className="modal-actions">
            {cancelAfterRoll && cancelBtn}
            <button className="btn btn-primary" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/** Ré-export pour composer des lignes riches (portraits) côté modale. */
export type { RollRowData } from './RollPanel';
