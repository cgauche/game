import type { Warning } from '../../state/validateScene';

/**
 * Liste des avertissements de validation d'une scène (réfs cassées, hors-carte, ids dupliqués).
 * Clic sur une ligne → `onSelect(warning)` (l'éditeur sélectionne le fautif).
 */
export function ValidationPanel({ warnings, onSelect }: { warnings: Warning[]; onSelect: (w: Warning) => void }) {
  if (!warnings.length) return <p className="ed-ok">✓ Aucun problème détecté.</p>;
  const errs = warnings.filter((w) => w.level === 'error').length;
  return (
    <div className="ed-validation">
      <div className="ed-validation-head">
        {errs} erreur(s), {warnings.length - errs} avertissement(s)
      </div>
      <ul>
        {warnings.map((w, i) => (
          <li key={i} className={w.level} onClick={() => onSelect(w)} style={{ cursor: 'pointer' }}>
            <span className="badge">{w.level === 'error' ? '⛔' : '⚠️'}</span> [{w.scope}] {w.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
