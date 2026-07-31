import { Icon } from './Icon';
import { GatedAction } from './GatedAction';

/**
 * Bouton « Je ne faillirai pas ! » (Résilience, LDB 17 l.68) : sacrifie un Point de Résilience
 * pour une réussite garantie (Test opposé : l'emporte avec DR +1). Affiché uniquement quand il
 * reste de la Résilience ET que l'issue est défavorable (`show`).
 * `blockedReason` (#1000) : l'offre reste VISIBLE mais GATÉE, sa raison en texte lisible (patron
 * `GatedAction`) — jamais un bouton qui consommerait le Point sans effet.
 */
export function ResilienceButton({ resilience, show, onForce, blockedReason }: { resilience: number; show: boolean; onForce: () => void; blockedReason?: string }) {
  if (resilience <= 0 || !show) return null;
  const label = <><Icon id="fire/flame" size="sm" /> Résilience ×{resilience}</>;
  if (blockedReason) {
    return (
      <GatedAction
        id="resilience-force"
        label={label}
        ariaLabel={`Résilience ×${resilience}`}
        enabled={false}
        reason={blockedReason}
        primary={false}
        btnClassName="btn-resource"
        onClick={onForce}
      />
    );
  }
  return (
    <button
      className="btn btn-resource"
      onClick={onForce}
      title="« Je ne faillirai pas ! » : sacrifie un Point de Résilience pour une réussite garantie (avant le jet ou après un échec)"
    >
      {label}
    </button>
  );
}
