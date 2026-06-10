/**
 * Barre de progression d'un Test ÉTENDU (LDB 12) : on cumule des Degrés de Réussite (DR) jusqu'à une
 * cible. La barre se remplit (vert) à mesure ; des crans repèrent chaque DR quand la cible est petite.
 * Réutilisable par tous les flux étendus (Chirurgie, Focalisation, Rechargement, Calme étendu…).
 */
export function DrBar({ cum, target, label = 'DR' }: { cum: number; target: number; label?: string }) {
  const c = Math.max(0, cum);
  const pct = target > 0 ? Math.max(0, Math.min(100, (c / target) * 100)) : 0;
  const notches = target > 0 && target <= 12 ? target : 0; // crans lisibles seulement si peu de DR
  return (
    <div className="dr-bar" title={`${c} / ${target} ${label} cumulés`}>
      <div className="dr-bar-track">
        <i className="dr-bar-fill" style={{ width: `${pct}%` }} />
        {notches > 1 &&
          Array.from({ length: notches - 1 }, (_, i) => (
            <span key={i} className="dr-bar-notch" style={{ left: `${((i + 1) / notches) * 100}%` }} />
          ))}
      </div>
      <span className="dr-bar-val">
        {c} / {target} {label}
      </span>
    </div>
  );
}
