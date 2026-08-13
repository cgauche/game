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
  /**
   * ÉCHELLE RÉELLEMENT RENDUE (1 = taille naturelle), quand l'hôte sait la mesurer. Le `zoom` ci-dessus
   * est celui du viewBox ; l'élément, lui, peut être rétréci par la mise en page (`.editor-iso` est à
   * TAILLE DE CONTENU sous `max-width: 100%`), et ce que l'auteur voit vaut alors `zoom × ce
   * rétrécissement`. Afficher le zoom seul ment d'autant (mesuré #1176 : pas de case 40,3 px pour un
   * HUD à « 100 % »). Absente = l'hôte n'a pas de rétrécissement à déclarer, le zoom EST l'échelle.
   */
  renderedScale?: number;
  /** Voie de rendu du monde (#1176) : `true` = monde volumique. Interrupteur de CHANTIER — l'appelant
   *  ne le fournit qu'en DEV (`import.meta.env.DEV`) ; le bouton n'existe pas sans lui. */
  stage3d?: boolean;
  onToggleStage3d?: () => void;
}

export function ViewControls({ zoom, renderedScale, onZoomIn, onZoomOut, onZoomReset, onRotateLeft, onRotateRight, view, onToggleView, pov, onTogglePov, inspectEnabled, onToggleInspect, stage3d, onToggleStage3d }: ViewControlsProps) {
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
  const stage3dLabel = stage3d ? 'Monde en couches SVG (DEV)' : 'Monde volumique (DEV)';
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
        {onToggleStage3d && (
          <button
            type="button"
            className="btn vc-btn"
            title={stage3dLabel}
            aria-label={stage3dLabel}
            aria-pressed={!!stage3d}
            onPointerDown={stop(onToggleStage3d)}
          >
            {/* Icône de l'outil Hauteur de l'éditeur, empruntée faute de glyphe volumique. */}
            <Icon id="map-tool/height" size="sm" />
          </button>
        )}
      </div>
      <div className="vc-group" role="group" aria-label="Zoom">
        <button type="button" className="btn vc-btn" title="Zoom arrière" aria-label="Zoom arrière" onPointerDown={stop(onZoomOut)}>
          <Icon id="ui/zoom-out" size="sm" />
        </button>
        <output className="vc-zoom-value" title={renderedScale !== undefined ? `Zoom ${Math.round(zoom * 100)} %, à l’écran ${Math.round(renderedScale * 100)} %` : undefined}>
          {Math.round((renderedScale ?? zoom) * 100)}%
        </output>
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
