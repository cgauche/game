/**
 * Opacité du GABARIT de couche inférieure de l'éditeur (`z < currentLayer`, EditorCanvas) — réglage
 * UTILISATEUR persisté (localStorage, même mécanique que `compendium/atelierMode.ts`) : le bon
 * niveau dépend de la carte/du moment (repère net pour aligner vs quasi éteint pour lire son propre
 * tracé), jamais une constante. Défaut nettement plus effacé que l'ancien voile (opaque) du jeu
 * réutilisé tel quel par erreur dans l'éditeur.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'wfrp4.editor.lowerLayerOpacity.v1';
/** Défaut : le gabarit reste identifiable (matériaux/tracé) sans concurrencer la couche active. */
export const DEFAULT_LOWER_LAYER_OPACITY = 0.22;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

let opacity: number = (() => {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw === null || raw === undefined ? NaN : Number(raw);
    return Number.isFinite(parsed) ? clamp01(parsed) : DEFAULT_LOWER_LAYER_OPACITY;
  } catch {
    return DEFAULT_LOWER_LAYER_OPACITY;
  }
})();

const listeners = new Set<() => void>();

export function lowerLayerOpacity(): number {
  return opacity;
}

export function setLowerLayerOpacity(v: number): void {
  opacity = clamp01(v);
  try {
    globalThis.localStorage?.setItem(KEY, String(opacity));
  } catch {
    // stockage indisponible : le réglage reste effectif pour la session, sans persistance
  }
  for (const l of listeners) l();
}

export function useLowerLayerOpacity(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    lowerLayerOpacity,
    () => DEFAULT_LOWER_LAYER_OPACITY,
  );
}
