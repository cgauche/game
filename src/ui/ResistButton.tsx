/**
 * Bouton « Résistance (Menace) » (LDB 10 l.1015-1021) : auto-succès du premier Test pour résister à
 * la menace spécifiée (DR = Bonus d'Endurance), UNE fois par spec et par séance de jeu. Pendant UI du
 * verbe `resist` de la fabrique rollFlow — frère de `ResilienceButton` (même mécanisme, autre
 * ressource). Affiché seulement quand le talent est DISPONIBLE (spec couvrant la menace du Test, non
 * consommée) ET que l'issue n'est pas déjà favorable (`show`).
 */
export function ResistButton({ menace, show, onResist }: { menace: string; show: boolean; onResist: () => void }) {
  if (!show) return null;
  return (
    <button
      className="btn btn-resource"
      onClick={onResist}
      title={`Résistance (${menace}) : réussit automatiquement ce Test (DR = Bonus d'Endurance) — une fois par séance de jeu`}
    >
      🛡️ Résistance ({menace})
    </button>
  );
}
