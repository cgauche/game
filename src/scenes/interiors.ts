/**
 * Générateur de scènes d'intérieur réutilisables (pour les bâtiments `reveal:'door'`).
 * L'intérieur ne connaît pas son appelant : la sortie utilise l'effet `transitionBack`
 * qui ramène à la scène précédente, sur la case d'où l'on est entré. Un même intérieur
 * peut donc servir à plusieurs bâtiments.
 */
import { Scene, Terrain } from '../state/scene';
import { flowFromEffects } from '../state/flow';

export interface InteriorOpts {
  id: string;
  nom: string;
  w?: number;
  h?: number;
  /** Revêtement de sol (plancher par défaut ; dalle pour un intérieur de pierre). */
  floor?: Terrain;
  ambiance?: Scene['ambiance'];
  startMessage?: string;
}

/** Petite pièce close : murs sur le périmètre, porte de sortie en bas-centre. */
export function makeInteriorScene(opts: InteriorOpts): Scene {
  const w = opts.w ?? 7;
  const h = opts.h ?? 6;
  const floor = opts.floor ?? 'plancher';
  const midX = Math.floor(w / 2);
  const tiles: Terrain[] = new Array(w * h).fill(floor);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const peri = x === 0 || x === w - 1 || y === 0 || y === h - 1;
      if (peri) tiles[y * w + x] = 'mur';
    }
  tiles[(h - 1) * w + midX] = 'porte'; // sortie franchissable en bas-centre
  const arrival = { x: midX, y: h - 2 };
  return {
    id: opts.id,
    nom: opts.nom,
    description: '',
    dimensions: { w, h },
    ambiance: opts.ambiance ?? 'interieur',
    startMessage: opts.startMessage,
    levels: [{ z: 0, tiles }],
    entryPoints: { entree: arrival },
    entities: [{ id: 'start', kind: 'heroStart', pos: arrival }],
    buildings: [],
    dialogues: [],
    triggers: [
      // marcher sur la porte du bas → retour à la scène précédente
      { id: 'sortie', rect: { x: midX, y: h - 1, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'transitionBack' }]) },
    ],
    encounters: [],
    flags: {},
  };
}
