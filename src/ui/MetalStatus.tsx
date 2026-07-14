import { parseStatus, type StatusTier } from '../engine/money';

/**
 * MetalStatus — chip statut métallisé (Bronze/Argent/Or + échelon), charte « Atelier du scribe »
 * (#412, ratifiée ticket #412). Dérivée depuis le libellé Statut d'un `CareerLevelData` via
 * `parseStatus` (SOURCE UNIQUE — jamais un `switch` de couleur recopié à la main). `size='chip'`
 * pour une pastille en ligne (rangée de carrière) ; `size='plaque'` pour la plaque scellée d'élu.
 */
export function MetalStatus({ status, size = 'chip' }: {
  /** Libellé RAW du Statut (« Bronze 2 »…) — non reconnu = rendu neutre (aucune règle inventée). */
  status: string;
  size?: 'chip' | 'plaque';
}) {
  const parsed = parseStatus(status);
  const tier: StatusTier | null = parsed?.tier ?? null;
  return (
    <span className={`metal-status metal-status-${size}${tier ? ` st-${tier}` : ''}`}>
      {status}
    </span>
  );
}
