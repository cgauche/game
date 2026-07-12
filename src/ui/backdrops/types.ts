import type { ReactNode } from 'react';

/** Bande d'ambiance (`SceneBackdrop`) — 1 def = 1 fichier `defs/`. `render` produit un SVG paysage
 *  stylisé, tokens `var(--…)` uniquement (jamais de hex/rgb en dur, cf. cliquet `ui-ratchets` (viii)). */
export interface BackdropDef {
  id: string;
  label: string;
  render: () => ReactNode;
}
