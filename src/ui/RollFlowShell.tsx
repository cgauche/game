import type { ReactNode } from 'react';
import type { RollBreakdown } from '../engine/combat';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';
import { RollLine } from './RollLine';
import { Modal } from './Modal';

// Dé d100 canonique (désormais animé) — ré-exporté pour les modales qui l'importaient d'ici.
export { Dice } from './Dice';

/**
 * Coquille PARTAGÉE des modales de jet différé (invariante « un jet = une modale ») — pendant UI de
 * la fabrique `state/rollFlow.ts`. Toutes suivent le même squelette, jusqu'ici copié-collé par modale :
 *
 *   overlay → titre → sous-titre → [pré-jet : Lancer · Résilience (LDB 17 l.73, AVANT le jet) ·
 *   Annuler] | [post-jet : bloc résultat · Chance (relance / +1 DR) · Résilience · Appliquer · Annuler]
 *
 * La modale concrète ne fournit QUE sa partie spécifique : titre, sous-titre, ligne(s) de jet
 * (`breakdown` → RollLine) + issue style journal (`outcome`), et les handlers du flux.
 * Variantes couvertes par props :
 * - `variant` : famille de classes ('roll' = roll-modal/rm-vs ; 'test' = test-modal/test-actor) ;
 * - `onBonusSL` absent : Test binaire → bouton « 🍀 Relancer » simple au lieu de `ChanceButtons` ;
 * - `onForce` absent : pas de Résilience (flux sans « Réussite garantie ») ;
 * - `preRollForce` : action Résilience pré-jet spécifique (ex. Piétinement : lancer PUIS forcer) ;
 * - `cancelFirst` : « Annuler » avant « Lancer » (famille test + soin) ; `cancelAfterRoll` : Annuler
 *   aussi après le jet (Piétinement, Focalisation).
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
  cancelFirst,
  cancelAfterRoll = false,
  breakdown,
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
  /** « Annuler » avant « Lancer » (défaut : oui pour la famille 'test'). */
  cancelFirst?: boolean;
  cancelAfterRoll?: boolean;
  /** Ligne(s) de jet riche(s) (base = cible · d100 · DR), façon Attaque/Défense — un tableau pour
   *  les Tests opposés (acteur puis opposant). */
  breakdown?: RollBreakdown | RollBreakdown[];
  /** Ligne d'issue style journal sous la ligne de jet (le « log » de l'action). */
  outcome?: ReactNode;
  /** Détermination (LDB 17 l.62) : bouton 1ʳᵉ classe — immunité Psychologie. Affiché pré-jet et après échec. */
  determination?: { resolve: number; onResolve: () => void };
  fortune: number;
  rerollable: boolean;
  onReroll: () => void;
  /** Bénédiction de Chance (LDB 41) : relance gratuite disponible (actif même à 0 Chance). */
  freeReroll?: boolean;
  /** Absent → Test binaire : bouton « 🍀 Relancer » simple (pas de « +1 DR »). */
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
    <button className="btn" onClick={onCancel}>
      Annuler
    </button>
  );
  const determineBtn = determination && determination.resolve > 0 && (
    <button className="btn" onClick={determination.onResolve} title="Dépense 1 Détermination : immunité à la Psychologie jusqu'à la fin du prochain Round (LDB 17 l.62)">
      ✊ Détermination ({determination.resolve})
    </button>
  );
  const preCancelFirst = cancelFirst ?? variant === 'test';
  return (
    <Modal title={title} variant={variant}>
        <p className={subClass}>{subtitle}</p>
        {extra}
        {!rolled ? (
          <div className="modal-actions">
            {preCancelFirst && cancelBtn}
            <button className="btn btn-primary" onClick={onRoll}>
              {rollLabel}
            </button>
            {/* Résilience AVANT le jet (LDB 17 l.73 : « au lieu de lancer les dés »). */}
            {onForce && <ResilienceButton resilience={resilience} show={resilience > 0} onForce={preRollForce ?? onForce} />}
            {determineBtn}
            {!preCancelFirst && cancelBtn}
          </div>
        ) : (
          <>
            {breakdown && (
              <div className="rm-rolls">
                {(Array.isArray(breakdown) ? breakdown : [breakdown]).map((d, i) => <RollLine key={i} d={d} />)}
              </div>
            )}
            {outcome}
            <div className="modal-actions">
              {onBonusSL ? (
                <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={onReroll} freeReroll={freeReroll} onBonusSL={onBonusSL} darkPactable={darkPactable} onDarkPact={onDarkPact} />
              ) : (
                rerollable &&
                (freeReroll || fortune > 0) && (
                  <button
                    className="btn"
                    onClick={onReroll}
                    title={freeReroll
                      ? 'Bénédiction de Chance (LDB 41) : relance gratuite du Test raté — sans dépenser de Chance'
                      : 'Dépense un point de Chance pour relancer le Test (LDB Destin)'}
                  >
                    {freeReroll ? '🙏 Relancer' : `🍀 Relancer (${fortune})`}
                  </button>
                )
              )}
              {onForce && <ResilienceButton resilience={resilience} show={forceShow} onForce={onForce} />}
              <button className="btn btn-primary" onClick={onConfirm}>
                {confirmLabel}
              </button>
              {cancelAfterRoll && cancelBtn}
            </div>
          </>
        )}
    </Modal>
  );
}
