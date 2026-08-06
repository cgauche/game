import { Icon } from './Icon';

/** Contrôles de caméra partagés entre CampaignView et EditorCanvas. */
export interface ViewControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  /** Projection courante (iso losange / top grille carrée) + bascule. */
  view: 'iso' | 'top';
  onToggleView: () => void;
  /** Vue subjective (POV) : état + bascule. Optionnels — absents chez l'éditeur (jeu seulement). */
  pov?: boolean;
  onTogglePov?: () => void;
  inspectEnabled?: boolean;
  onToggleInspect?: () => void;
}

export function ViewControls({ zoom, onZoomIn, onZoomOut, onZoomReset, onRotateLeft, onRotateRight, view, onToggleView, pov, onTogglePov, inspectEnabled, onToggleInspect }: ViewControlsProps) {
  const stop = (fn: () => void) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };
  const inspectLabel = inspectEnabled
    ? 'Désactiver l’inspection des combattants'
    : 'Activer l’inspection des combattants';
  const projectionLabel = view === 'top' ? 'Vue isométrique' : 'Vue du dessus';
  const povLabel = pov ? 'Vue normale (au-dessus)' : 'Vue subjective (première personne)';
  return (
    <div
      className="view-controls"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="vc-group" role="group" aria-label="Orientation">
        <button type="button" className="btn vc-btn" title="Tourner anti-horaire (Q)" aria-label="Tourner anti-horaire (Q)" onPointerDown={stop(onRotateLeft)}>
          <Icon id="ui/rotate-left" size="sm" />
        </button>
        <button type="button" className="btn vc-btn" title="Tourner horaire (E)" aria-label="Tourner horaire (E)" onPointerDown={stop(onRotateRight)}>
          <Icon id="ui/rotate-right" size="sm" />
        </button>
      </div>
      <div className="vc-group" role="group" aria-label="Affichage">
        <button
          type="button"
          title={projectionLabel}
          aria-label={projectionLabel}
          aria-pressed={view === 'top'}
          className="btn vc-btn"
          onPointerDown={stop(onToggleView)}
        >
          <Icon id={view === 'top' ? 'ui/projection-iso' : 'ui/projection-top'} size="sm" />
        </button>
        {onTogglePov && (
          <button
            type="button"
            title={povLabel}
            aria-label={povLabel}
            aria-pressed={!!pov}
            className="btn vc-btn"
            onPointerDown={stop(onTogglePov)}
          >
            {pov ? <Icon id="nav/campaign" size="sm" /> : <Icon id="ui/eye" size="sm" />}
          </button>
        )}
        {onToggleInspect && (
          <button
            type="button"
            className="btn vc-btn"
            title={inspectLabel}
            aria-label={inspectLabel}
            aria-pressed={!!inspectEnabled}
            onPointerDown={stop(onToggleInspect)}
          >
            <Icon id="nav/identify" size="sm" />
          </button>
        )}
      </div>
      <div className="vc-group" role="group" aria-label="Zoom">
        <button type="button" className="btn vc-btn" title="Zoom arrière" aria-label="Zoom arrière" onPointerDown={stop(onZoomOut)}>
          <Icon id="ui/zoom-out" size="sm" />
        </button>
        <output className="vc-zoom-value">{Math.round(zoom * 100)}%</output>
        <button type="button" className="btn vc-btn" title="Zoom avant" aria-label="Zoom avant" onPointerDown={stop(onZoomIn)}>
          <Icon id="ui/zoom-in" size="sm" />
        </button>
        {zoom !== 1 && (
          <button type="button" className="btn vc-btn" title="Réinitialiser le zoom" aria-label="Réinitialiser le zoom" onPointerDown={stop(onZoomReset)}>
            <Icon id="ui/zoom-reset" size="sm" />
          </button>
        )}
      </div>
    </div>
  );
}
