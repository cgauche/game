import type { ReactNode } from 'react';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';
import { Modal } from './Modal';

/** Affichage canonique d'un d100 (100 → « 00 », zéro-paddé). */
export function Dice({ roll }: { roll: number }) {
  return <>{roll === 100 ? '00' : String(roll).padStart(2, '0')}</>;
}

/**
 * Coquille PARTAGÉE des modales de jet différé (invariante « un jet = une modale ») — pendant UI de
 * la fabrique `state/rollFlow.ts`. Toutes suivent le même squelette, jusqu'ici copié-collé par modale :
 *
 *   overlay → titre → sous-titre → [pré-jet : Lancer · Résilience (LDB 17 l.73, AVANT le jet) ·
 *   Annuler] | [post-jet : bloc résultat · Chance (relance / +1 DR) · Résilience · Appliquer · Annuler]
 *
 * La modale concrète ne fournit QUE sa partie spécifique : titre, sous-titre, contenu du bloc
 * résultat, et les handlers du flux. Variantes couvertes par props :
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
  resultOk,
  result,
  fortune,
  rerollable,
  onReroll,
  onBonusSL,
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
  /** Contenu optionnel entre le sous-titre et le jet (ex. sélecteur de cible du soin). */
  extra?: ReactNode;
  rolled: boolean;
  rollLabel?: string;
  onRoll: () => void;
  /** Absent → pas de bouton « Annuler ». */
  onCancel?: () => void;
  /** « Annuler » avant « Lancer » (défaut : oui pour la famille 'test'). */
  cancelFirst?: boolean;
  cancelAfterRoll?: boolean;
  /** Verdict du bloc résultat (classe ok/fail). */
  resultOk: boolean;
  /** Contenu (spans) du bloc `.test-result`. */
  result: ReactNode;
  fortune: number;
  rerollable: boolean;
  onReroll: () => void;
  /** Absent → Test binaire : bouton « Relancer » simple (pas de « +1 DR »). */
  onBonusSL?: () => void;
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
            {!preCancelFirst && cancelBtn}
          </div>
        ) : (
          <>
            <div className={`test-result ${resultOk ? 'ok' : 'fail'}`}>{result}</div>
            <div className="modal-actions">
              {onBonusSL ? (
                <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={onReroll} onBonusSL={onBonusSL} />
              ) : (
                rerollable &&
                fortune > 0 && (
                  <button className="btn" onClick={onReroll} title="Dépense un point de Chance pour relancer le Test (LDB Destin)">
                    🍀 Relancer ({fortune})
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
