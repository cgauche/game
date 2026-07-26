/**
 * Traitement des couches INFÉRIEURES (`z < currentLayer`) dans le canevas d'éditeur — réglages
 * UTILISATEUR persistés (`persistedAtom`, primitive partagée `ui/persistedAtom.ts`) :
 *  - MODE : `gabarit` (les couches du dessous restent dessinées, voilées) ou `isolee` (SEULE la
 *    couche active est émise). Le bon mode dépend du moment : aligner sur l'existant, vs lire son
 *    propre tracé sur une couche presque vide où le dessous fournit l'essentiel des traits visibles.
 *  - OPACITÉ du gabarit : le bon niveau dépend de la carte/du moment (repère net pour aligner vs
 *    quasi éteint pour lire son propre tracé), jamais une constante. Défaut nettement plus effacé
 *    que le voile (opaque) du jeu.
 */
import { persistedAtom } from '../persistedAtom';

/** Traitement des couches du dessous — id STABLE porté par la logique, le libellé restant de l'affichage. */
export type LowerLayerMode = 'gabarit' | 'isolee';

/** Défaut : le gabarit reste identifiable (matériaux/tracé) sans concurrencer la couche active. */
export const DEFAULT_LOWER_LAYER_OPACITY = 0.22;
/** Défaut : le dessous reste visible — l'isolation est un geste d'auteur, jamais un état subi. */
export const DEFAULT_LOWER_LAYER_MODE: LowerLayerMode = 'gabarit';

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

const opacityAtom = persistedAtom(
  'wfrp4.editor.lowerLayerOpacity.v1',
  DEFAULT_LOWER_LAYER_OPACITY,
  (raw) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clamp01(parsed) : DEFAULT_LOWER_LAYER_OPACITY;
  },
  String,
);

const modeAtom = persistedAtom<LowerLayerMode>(
  'wfrp4.editor.lowerLayerMode.v1',
  DEFAULT_LOWER_LAYER_MODE,
  (raw) => (raw === 'isolee' ? 'isolee' : 'gabarit'),
  (v) => v,
);

export function lowerLayerOpacity(): number {
  return opacityAtom.get();
}

export function setLowerLayerOpacity(v: number): void {
  opacityAtom.set(clamp01(v));
}

export function useLowerLayerOpacity(): number {
  return opacityAtom.use();
}

export function lowerLayerMode(): LowerLayerMode {
  return modeAtom.get();
}

export function setLowerLayerMode(m: LowerLayerMode): void {
  modeAtom.set(m);
}

export function useLowerLayerMode(): LowerLayerMode {
  return modeAtom.use();
}
