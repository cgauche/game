import { useRef, useState, type DragEvent } from 'react';
import { CALIB_INSTRUCTIONS, type CalibStep } from '../../state/traceCalibration';
import { OptionChooser } from '../OptionChooser';

/**
 * Panneau flottant du CALQUE DE RÉFÉRENCE (#830) — décalquer une planche de livre sous la grille de
 * l'éditeur : chargement d'une image locale (fichier ou glisser-déposer), visibilité, opacité,
 * position (au-dessus/en dessous), verrouillage de rotation, et calage 2 POINTS (au lieu de curseurs
 * position/échelle/rotation à tâtonner). Composant purement présentationnel : tout l'état (image,
 * transformation, étape de calage, repli/dépli) vit dans `Editor.tsx`, qui porte aussi la
 * persistance PAR (SCÈNE, COUCHE) (`state/traceLayer.ts`) — ce panneau ne fait AUCUNE hypothèse sur
 * ce stockage.
 *
 * REPLI/DÉPLI (retour user 2026-07-25 — « comment je ferme/ouvre le calque de référence ? ») : l'
 * en-tête compact reste TOUJOURS visible (titre + couche + bouton ▾/▸), replié il ne laisse RIEN
 * d'autre — c'est lui-même l'affordance de réouverture, pas de bouton séparé dans une autre barre.
 * Sans calque chargé, le corps (déplié) ne montre qu'un point d'entrée discret pour en charger un —
 * jamais les réglages (opacité/position/…) sans objet.
 */
export function TraceLayerPanel({
  hasLayer,
  visible,
  opacity,
  calibStep,
  position,
  allowRotation,
  layerZ,
  expanded,
  onLoadFile,
  onToggleVisible,
  onOpacityChange,
  onPositionChange,
  onAllowRotationChange,
  onToggleExpanded,
  onStartCalibration,
  onCancelCalibration,
  onRemove,
}: {
  hasLayer: boolean;
  visible: boolean;
  opacity: number;
  calibStep: CalibStep;
  /** `above` (défaut, décalquer/comparer) ou `below` (dessiner sur du vide — carte neuve). */
  position: 'above' | 'below';
  /** Autorise la calibration à déduire une rotation (planche scannée de travers) — faux par défaut. */
  allowRotation: boolean;
  /** Couche (z) à laquelle s'applique CE calque — affichée pour qu'on ne règle pas l'étage en
   *  croyant être au rez (retour user 2026-07-25). */
  layerZ: number;
  expanded: boolean;
  onLoadFile: (file: File) => void;
  onToggleVisible: () => void;
  onOpacityChange: (opacity: number) => void;
  onPositionChange: (position: 'above' | 'below') => void;
  onAllowRotationChange: (allowRotation: boolean) => void;
  onToggleExpanded: () => void;
  onStartCalibration: () => void;
  onCancelCalibration: () => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const calibrating = calibStep !== 'idle';

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) onLoadFile(f);
  }

  return (
    <div
      className={`trace-layer-panel panel${expanded ? '' : ' trace-layer-panel-collapsed'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="btn trace-layer-panel-head"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        title={expanded ? 'Replier le panneau' : 'Déplier le panneau'}
      >
        <span className="trace-layer-panel-chevron">{expanded ? '▾' : '▸'}</span>
        <span>Calque de référence — Couche {layerZ}</span>
      </button>

      {expanded && (calibrating ? (
        <>
          <p className="hint">{CALIB_INSTRUCTIONS[calibStep as Exclude<CalibStep, 'idle'>]}</p>
          <button className="btn small" onClick={onCancelCalibration}>
            Annuler le calage
          </button>
        </>
      ) : !hasLayer ? (
        <>
          <p className="hint">Décalquer une planche de livre (image locale) sous la grille.</p>
          <button
            className={`btn small${dragOver ? ' btn-primary' : ''}`}
            onClick={() => fileRef.current?.click()}
          >
            Charger une image…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onLoadFile(f);
            }}
          />
        </>
      ) : (
        <>
          <div className="row-flex">
            <label className="row-flex">
              <input type="checkbox" checked={visible} onChange={onToggleVisible} />
              <span>Visible</span>
            </label>
          </div>
          <OptionChooser
            layout="seg"
            groupLabel="Position"
            options={[
              {
                key: 'above',
                label: 'Au-dessus',
                title: 'Décalquer/comparer par-dessus la scène construite (le terrain est opaque — mode dominant)',
                selected: position === 'above',
                onSelect: () => onPositionChange('above'),
              },
              {
                key: 'below',
                label: 'En dessous',
                title: 'Dessiner sur du vide (carte neuve, sans terrain encore posé)',
                selected: position === 'below',
                onSelect: () => onPositionChange('below'),
              },
            ]}
          />
          <label className="field">
            <span>Opacité</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
            />
          </label>
          <label className="row-flex">
            <input type="checkbox" checked={allowRotation} onChange={(e) => onAllowRotationChange(e.target.checked)} />
            <span title="Par défaut, le calage 2 points ne résout que translation + échelle (angle verrouillé à 0) : une planche de livre est scannée droite.">
              Autoriser la rotation (scan de travers)
            </span>
          </label>
          <button className="btn small btn-primary" onClick={onStartCalibration}>
            Calibrer 2 points…
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            Remplacer l'image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onLoadFile(f);
            }}
          />
          <button className="btn small danger" onClick={onRemove}>
            Retirer le calque
          </button>
        </>
      ))}
    </div>
  );
}
