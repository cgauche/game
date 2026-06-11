/**
 * Bouton « Je ne faillirai pas ! » (Résilience, LDB ch.17 l.73) : sacrifie un Point de Résilience
 * pour une réussite garantie (Test opposé : l'emporte avec DR +1). Affiché uniquement quand il
 * reste de la Résilience ET que l'issue est défavorable (`show`).
 */
export function ResilienceButton({ resilience, show, onForce }: { resilience: number; show: boolean; onForce: () => void }) {
  if (resilience <= 0 || !show) return null;
  return (
    <button
      className="btn btn-resource"
      onClick={onForce}
      title="« Je ne faillirai pas ! » : sacrifie un Point de Résilience pour une réussite garantie (LDB 17 l.73 — avant le jet ou après un échec)"
    >
      🔥 Garantie ×{resilience}
    </button>
  );
}
