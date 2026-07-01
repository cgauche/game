/**
 * Barre de statut de l'éditeur (manque du POC) : case survolée + terrain, outil actif,
 * dimensions de la scène, et toggles de CALQUES (déplacés de la Palette — ils concernent la vue).
 */
import type { Dispatch, SetStateAction } from 'react';
import { TERRAINS } from '../../state/terrain';
import type { Layers, Pt, Tool } from './editorState';
import { KIND_LABEL, SIEGE_ENGINES } from './editorState';
import { BUILDINGS_META } from '../../gameIso/catalog/buildings';
import { PROPS } from '../../gameIso/catalog/decor';

const LAYER_LABEL: Record<keyof Layers, string> = {
  triggers: 'Zones',
  spawns: 'Ennemis',
  roofs: 'Toits',
  entries: 'Entrées',
  rest: 'Repos',
  effects: 'Pièges',
};

/** Libellé humain de l'outil actif. */
export function toolLabel(tool: Tool): string {
  switch (tool.mode) {
    case 'select': return '↖ Sélection';
    case 'tile': return `🖌 ${TERRAINS[tool.terrain]?.label ?? tool.terrain}`;
    case 'entity':
      if (tool.kind === 'prop') return `🌳 ${PROPS[tool.ref ?? '']?.label ?? 'Décor'}`;
      if (tool.kind === 'personnage') return `🙂 ${tool.ref ?? 'Villageois'}`;
      return `🏁 ${KIND_LABEL[tool.kind]}`;
    case 'roof': return `🏠 ${BUILDINGS_META[tool.style]?.label ?? tool.style}`;
    case 'zone': return tool.zone === 'trigger' ? '🟦 Zone trigger' : '⛺ Zone de repos';
    case 'entry': return '⚑ Point d’entrée';
    case 'encounter': return '⚔️ Placer des ennemis';
    case 'emplacement': return `💥 ${SIEGE_ENGINES.find((t) => t.id === tool.trappingId)?.label ?? 'Emplacement'}`;
    case 'wall': return tool.paint === 'door' ? '🧱 Porte' : tool.paint === 'diagBack' || tool.paint === 'diagFwd' ? '🧱 Diagonale' : '🧱 Cloison';
    case 'height': return `⛰ Hauteur ${tool.metres} m`;
    case 'erase': return '🧽 Gomme';
  }
}

export function StatusBar({
  hover,
  hoverTerrain,
  tool,
  dims,
  layers,
  setLayers,
}: {
  hover: Pt | null;
  hoverTerrain: string | null;
  tool: Tool;
  dims: { w: number; h: number };
  layers: Layers;
  setLayers: Dispatch<SetStateAction<Layers>>;
}) {
  return (
    <div className="editor-status">
      <span className="es-cell">
        {hover ? `(${hover.x}, ${hover.y})` : '(—, —)'}
        {hoverTerrain ? ` · ${TERRAINS[hoverTerrain]?.label ?? hoverTerrain}` : ''}
      </span>
      <span className="es-tool">{toolLabel(tool)}</span>
      <span>{dims.w}×{dims.h}</span>
      <span className="es-layers">
        Calques :
        {(Object.keys(LAYER_LABEL) as (keyof Layers)[]).map((k) => (
          <label key={k} className="es-layer">
            <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} />
            {LAYER_LABEL[k]}
          </label>
        ))}
      </span>
    </div>
  );
}
