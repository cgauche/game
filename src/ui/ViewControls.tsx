/**
 * Boutons de vue PARTAGÉS entre le jeu (CampaignView) et l'éditeur : zoom (+ / − / 1×)
 * et rotation caméra (⟲ / ⟳). Composant purement présentationnel — chaque écran câble
 * ses propres handlers (le jeu zoome la caméra, l'éditeur zoome le viewBox). Rendu en
 * overlay HTML positionné par-dessus le canvas (le parent doit être `position: relative`).
 */
interface ViewControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  /** Projection courante (iso losange / top grille carrée) + bascule. */
  view: 'iso' | 'top';
  onToggleView: () => void;
}

const BTN: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 9,
  background: '#1c2230',
  border: '1.5px solid #3a4660',
  color: '#cfe6ff',
  fontSize: 20,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  opacity: 0.92,
};

export function ViewControls({ zoom, onZoomIn, onZoomOut, onZoomReset, onRotateLeft, onRotateRight, view, onToggleView }: ViewControlsProps) {
  const stop = (fn: () => void) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };
  return (
    <div
      className="view-controls"
      style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 5, userSelect: 'none' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title={view === 'top' ? 'Vue isométrique' : 'Vue du dessus'}
        style={{ ...BTN, background: view === 'top' ? '#2a3550' : '#1c2230', borderColor: view === 'top' ? '#6f86c0' : '#3a4660' }}
        onPointerDown={stop(onToggleView)}
      >
        {view === 'top' ? '◇' : '▦'}
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" title="Tourner anti-horaire (Q)" style={BTN} onPointerDown={stop(onRotateLeft)}>
          ⟲
        </button>
        <button type="button" title="Tourner horaire (E)" style={BTN} onPointerDown={stop(onRotateRight)}>
          ⟳
        </button>
      </div>
      <button type="button" title="Zoom avant" style={{ ...BTN, fontSize: 26 }} onPointerDown={stop(onZoomIn)}>
        +
      </button>
      <button type="button" title="Zoom arrière" style={{ ...BTN, fontSize: 30 }} onPointerDown={stop(onZoomOut)}>
        −
      </button>
      {Math.abs(zoom - 1) > 0.001 && (
        <button type="button" title="Réinitialiser le zoom" style={{ ...BTN, height: 26, fontSize: 12 }} onPointerDown={stop(onZoomReset)}>
          1×
        </button>
      )}
    </div>
  );
}
