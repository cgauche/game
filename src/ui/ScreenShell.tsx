import { useRef, type ReactNode } from 'react';
import { useModalA11y } from './Modal';

/**
 * ScreenShell — LA coquille UNIQUE des écrans plein-champ (carte du monde, port/escale, marché,
 * dossier de navire, négoce…). Extraite du patron de facto `.worldmap-overlay` : voile plein écran
 * (z-index 90, sous les modales) + en-tête (titre à gauche, actions + fermeture à droite) + corps.
 * Comme `<Modal>`, elle porte l'a11y de dialogue (`role="dialog"`, focus initial + piège Tab, Échap =
 * `onClose`) via `useModalA11y` — plus AUCUN écran ne recode `.worldmap-overlay`/`.worldmap-head`.
 *
 * Onglets : slot `tabs` OPTIONNEL rendu dans la barre `.port-tabs` (le système d'onglets le plus
 * récent) — l'écran fournit ses `<button>`/badges tels quels ; on n'invente PAS un 4e système.
 * `className` ajoute des classes au voile (ex. `port-overlay`, `ship-dossier`).
 */
export function ScreenShell({
  title,
  onClose,
  closeLabel = '✕ Fermer',
  actions,
  tabs,
  className,
  children,
}: {
  title: ReactNode;
  /** Échap / bouton de fermeture. */
  onClose: () => void;
  /** Libellé du bouton de fermeture (défaut « ✕ Fermer »). */
  closeLabel?: ReactNode;
  /** Boutons d'en-tête AVANT la fermeture (rendus à droite, à côté du bouton Fermer). */
  actions?: ReactNode;
  /** Barre d'onglets OPTIONNELLE (`.port-tabs`) : boutons + badges de l'écran, tels quels. */
  tabs?: ReactNode;
  /** Classes ajoutées au voile plein écran (`port-overlay`, `ship-dossier`…). */
  className?: string;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef, onClose);
  return (
    <div ref={boxRef} role="dialog" aria-modal="true" className={`worldmap-overlay${className ? ` ${className}` : ''}`}>
      <div className="worldmap-head">
        <h2>{title}</h2>
        <div className="worldmap-head-actions">
          {actions}
          <button type="button" className="btn small" onClick={onClose}>{closeLabel}</button>
        </div>
      </div>
      {tabs != null && <div className="port-tabs">{tabs}</div>}
      {children}
    </div>
  );
}
