import type { ReactNode } from 'react';
import { GatedAction } from './GatedAction';

/**
 * Stepper de quantité CANONIQUE (#371 LOT 3) — moissonné de la table marchande étalon
 * (`MerchantPanel` panier/parcourir : `.btn-step`/`.cart-step`). Un triplet [décrémenter, centre,
 * incrémenter] — le centre n'est pas forcément un compteur numérique (ex. « Baisse des prix » :
 * disponibilité de l'acheteur au lieu d'un nombre) : `center` reste un `ReactNode` libre.
 *
 * DEUX formes de borne atteinte, selon ce que le site a à DIRE :
 *  - `decDisabled`/`incDisabled` : borne MUETTE — rien à expliquer (« 0 », « tout le stock ») ;
 *  - `refus` : borne RAISONNÉE — chaque borne porte sa cause, rendue par `GatedAction`
 *    (`aria-disabled` + infobulle + copie hors écran liée en `aria-describedby`), jamais un `title`
 *    muet. Un site qui a une raison la passe ICI plutôt que de dériver son propre stepper (#1806).
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
  refus,
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
  /** Raisons de REFUS par borne : `id` préfixe les deux contrôles gatés, une borne sans raison reste
   *  offerte. Présent ⇒ les DEUX pas composent `GatedAction` — une seule grammaire de refus. */
  refus?: { id: string; dec?: string; inc?: string };
}) {
  const pas = (sens: 'dec' | 'inc', bornes: { id: string; dec?: string; inc?: string }) => {
    const raison = sens === 'dec' ? bornes.dec : bornes.inc;
    const commun = {
      id: `${bornes.id}-${sens}`,
      label: sens === 'dec' ? decContent : incContent,
      ariaLabel: sens === 'dec' ? decLabel : incLabel,
      onClick: sens === 'dec' ? onDec : onInc,
      primary: false,
      btnClassName: 'btn-step',
    };
    // Les deux formes sont DISTINCTES au type (`reason` exclut son absence) : une borne sans raison
    // n'est pas refusable, et le dire vaut mieux qu'une raison vide.
    return raison ? <GatedAction {...commun} enabled={false} reason={raison} /> : <GatedAction {...commun} enabled />;
  };
  return (
    <span className="cart-step">
      {refus ? (
        pas('dec', refus)
      ) : (
        <button type="button" className="btn-step" disabled={decDisabled} title={decTitle} onClick={onDec} aria-label={decLabel}>
          {decContent}
        </button>
      )}
      <span className="cart-n">{center}</span>
      {refus ? (
        pas('inc', refus)
      ) : (
        <button type="button" className="btn-step" disabled={incDisabled} title={incTitle} onClick={onInc} aria-label={incLabel}>
          {incContent}
        </button>
      )}
    </span>
  );
}
