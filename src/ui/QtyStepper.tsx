import type { ReactNode } from 'react';

/**
 * Stepper de quantité CANONIQUE (#371 LOT 3) — moissonné de la table marchande étalon
 * (`MerchantPanel` panier/parcourir : `.btn-step`/`.cart-step`). Un triplet [décrémenter, centre,
 * incrémenter] — le centre n'est pas forcément un compteur numérique (ex. « Baisse des prix » :
 * disponibilité de l'acheteur au lieu d'un nombre) : `center` reste un `ReactNode` libre.
 */
export function QtyStepper({
  center,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
  decLabel,
  incLabel,
  decTitle,
  incTitle,
  decContent = '−',
  incContent = '+',
}: {
  center: ReactNode;
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
  decLabel: string;
  incLabel: string;
  decTitle?: string;
  incTitle?: string;
  decContent?: ReactNode;
  incContent?: ReactNode;
}) {
  return (
    <span className="cart-step">
      <button type="button" className="btn-step" disabled={decDisabled} title={decTitle} onClick={onDec} aria-label={decLabel}>
        {decContent}
      </button>
      <span className="cart-n">{center}</span>
      <button type="button" className="btn-step" disabled={incDisabled} title={incTitle} onClick={onInc} aria-label={incLabel}>
        {incContent}
      </button>
    </span>
  );
}
