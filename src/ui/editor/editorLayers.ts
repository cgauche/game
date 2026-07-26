/**
 * PRÉFÉRENCES DE CALQUES de l'éditeur — deux couches qui se superposent :
 *  1. `DEFAULT_LAYERS` (défaut statique, `editorState.ts`) ;
 *  2. le CONTENU de la scène : une carte qui porte des zones descriptives ouvre son calque `zones`
 *     allumé — sans quoi l'auteur édite un tracé qu'il ne voit pas ;
 *  3. les choix EXPLICITES de l'auteur (persistés, `persistedAtom`) — ils l'emportent sur les deux.
 * Seul l'écart au calcul (1)+(2) est stocké : rallumer un calque revenu à sa valeur calculée efface
 * le choix, et une scène sans zone ne traîne pas la préférence d'une autre.
 */
import type { Scene } from '../../state/scene';
import { descriptiveZones } from '../../state/planDefects';
import { persistedAtom } from '../persistedAtom';
import { DEFAULT_LAYERS, type Layers } from './editorState';

const LAYER_KEYS = Object.keys(DEFAULT_LAYERS) as (keyof Layers)[];

/** Choix explicites de l'auteur — sous-ensemble des calques, chacun forcé à sa valeur voulue. */
export type LayerChoices = Partial<Layers>;

function parseChoices(raw: string): LayerChoices {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== 'object') return {};
    const out: LayerChoices = {};
    for (const k of LAYER_KEYS) {
      const v = (data as Record<string, unknown>)[k];
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export const layerChoicesAtom = persistedAtom<LayerChoices>('wfrp4.editor.layers.v1', {}, parseChoices, (v) => JSON.stringify(v));

/** Calques calculés du CONTENU seul (sans choix d'auteur) — la base sur laquelle l'écart se mesure. */
export function sceneLayers(scene: Scene): Layers {
  return { ...DEFAULT_LAYERS, zones: descriptiveZones(scene).length > 0 };
}

/** Calques EFFECTIFS : défaut statique, surchargé par le contenu, surchargé par l'auteur. */
export function effectiveLayers(scene: Scene, choices: LayerChoices): Layers {
  return { ...sceneLayers(scene), ...choices };
}

/** Écart des calques voulus à la base calculée — ce qui se persiste. */
export function layerChoicesFrom(scene: Scene, wanted: Layers): LayerChoices {
  const base = sceneLayers(scene);
  const out: LayerChoices = {};
  for (const k of LAYER_KEYS) if (wanted[k] !== base[k]) out[k] = wanted[k];
  return out;
}

/** Calques de l'éditeur + poseur compatible `Dispatch<SetStateAction<Layers>>` (`StatusBar`). */
export function useEditorLayers(scene: Scene): [Layers, (update: Layers | ((prev: Layers) => Layers)) => void] {
  const choices = layerChoicesAtom.use();
  const layers = effectiveLayers(scene, choices);
  const setLayers = (update: Layers | ((prev: Layers) => Layers)) => {
    const wanted = typeof update === 'function' ? update(layers) : update;
    layerChoicesAtom.set(layerChoicesFrom(scene, wanted));
  };
  return [layers, setLayers];
}
