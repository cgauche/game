import { Combatant } from '../../engine/types';
import { Scene, Terrain } from '../../state/scene';

/** Un scénario de test = un groupe fixé + une scène adaptée (+ combat direct optionnel). */
export interface TestScenario {
  id: string;
  order: number; // tri d'affichage dans le menu
  icon: string; // emoji de carte
  title: string;
  tests: string; // une ligne : « ce que ça vérifie »
  partyNote: string; // ex. « Arbalétrier solo »
  makeParty: () => Combatant[];
  scene: Scene;
  autoCombat?: string; // id d'encounter → démarre le combat directement
}

/** Arène dégagée + point de départ des héros (base des scénarios de combat direct). */
export function arena(opts: {
  id: string;
  nom: string;
  w?: number;
  h?: number;
  terrain?: Terrain;
  heroStart?: { x: number; y: number };
}): Scene {
  const w = opts.w ?? 16;
  const h = opts.h ?? 10;
  return {
    id: opts.id,
    nom: opts.nom,
    description: 'Arène de test.',
    dimensions: { w, h },
    ambiance: 'jour',
    tiles: new Array(w * h).fill(opts.terrain ?? 'herbe') as Terrain[],
    entities: [{ id: 'start', kind: 'heroStart', pos: opts.heroStart ?? { x: 2, y: Math.floor(h / 2) } }],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}
