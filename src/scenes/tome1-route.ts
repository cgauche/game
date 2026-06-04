/**
 * CAMPAGNE — courte scène de continuation (démo de la brique « transitions »).
 * On y arrive après l'embuscade ; elle prouve l'enchaînement de scènes en
 * conservant groupe, flags, inventaire et argent.
 */
import { Scene, Terrain } from '../state/scene';

const W = 22;
const H = 14;

function build(): Scene {
  const tiles: Terrain[] = new Array(W * H).fill('herbe');
  const set = (x: number, y: number, t: Terrain) => {
    if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = t;
  };
  // Route est-ouest
  for (let x = 0; x < W; x++) {
    set(x, 6, 'route');
    set(x, 7, 'route');
  }
  // Lisière de forêt
  for (const [x, y] of [[2, 2], [4, 3], [6, 1], [9, 2], [13, 3], [16, 1], [19, 2], [3, 10], [7, 11], [12, 10], [17, 11]] as const)
    set(x, y, 'bois');

  return {
    id: 'tome1-route',
    nom: 'La route d’Altdorf',
    description: 'La grand-route serpente entre les bois, loin de l’auberge. Altdorf est encore à des heures de marche.',
    dimensions: { w: W, h: H },
    ambiance: 'foret',
    tiles,
    startMessage: 'Vous laissez l’embuscade derrière vous et reprenez la route vers la capitale.',
    entryPoints: { ouest: { x: 1, y: 6 } },
    entities: [
      { id: 'start', kind: 'heroStart', pos: { x: 1, y: 6 } },
      { id: 'borne', kind: 'objet', pos: { x: 18, y: 6 }, label: 'Borne kilométrique', loot: [] },
    ],
    dialogues: [],
    triggers: [
      {
        id: 'borne-est',
        rect: { x: 20, y: 6, w: 2, h: 2 },
        once: true,
        effects: [
          { type: 'journal', text: 'Une borne indique : « Altdorf, 180 km ». La suite du voyage commence ici.' },
          { type: 'setFlag', flag: 'tome1_route_atteinte' },
        ],
      },
    ],
    encounters: [],
    flags: {},
  };
}

export const tome1Route: Scene = build();
