import { describe, it, expect } from 'vitest';
import { lineOfSightCover } from './lineOfSight';
import type { Scene, SceneEntity } from './scene';

function scene(w: number, h: number, entities: SceneEntity[]): Scene {
  return {
    id: 's',
    name: 's',
    dimensions: { w, h },
    ambiance: 'jour',
    layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }],
    entities,
    dialogues: [],
    triggers: [],
    encounters: [],
  } as unknown as Scene;
}
const prop = (id: string, ref: string, x: number, y: number): SceneEntity =>
  ({ id, kind: 'prop', pos: { x, y }, ref }) as SceneEntity;

describe('index de décor de la Ligne de Vue (mémoïsé par identité de `scene.entities`)', () => {
  it('deux décors sur la MÊME case : le PREMIER du tableau décide (préséance de l’ordre)', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 2, y: 0 };
    // `arbre` (couvert imparfait, non opaque) posé AVANT `statue` (opaque, couvert total).
    const arbreDAbord = lineOfSightCover(scene(3, 1, [prop('a', 'arbre', 1, 0), prop('s', 'statue', 1, 0)]), from, to, []);
    expect(arbreDAbord).toEqual({ blocked: false, cover: 'imparfaite' });
    // Ordre inverse : la statue décide → case opaque adjacente à la cible → couvert total.
    const statueDAbord = lineOfSightCover(scene(3, 1, [prop('s', 'statue', 1, 0), prop('a', 'arbre', 1, 0)]), from, to, []);
    expect(statueDAbord).toEqual({ blocked: false, cover: 'totale' });
  });

  it('MÊME réf `entities` → l’index n’est pas rebâti (une mutation EN PLACE n’est pas vue) ; NOUVELLE réf → il l’est', () => {
    const entities = [prop('a', 'arbre', 1, 0)];
    const sc = scene(3, 1, entities);
    const from = { x: 0, y: 0 };
    const to = { x: 2, y: 0 };
    expect(lineOfSightCover(sc, from, to, []).cover).toBe('imparfaite');
    // Mutation EN PLACE du MÊME tableau : jamais produite en production (tout passe par un
    // nouveau tableau, cf. `sceneMemo.ts`) — ici, sonde d’identité : l’index tient toujours.
    entities[0] = prop('s', 'statue', 1, 0);
    expect(lineOfSightCover(sc, from, to, []).cover).toBe('imparfaite');
    // NOUVEAU tableau (le geste réel d’ajout/retrait) : index rebâti, la statue est vue.
    const sc2 = { ...sc, entities: [...entities] } as unknown as Scene;
    expect(lineOfSightCover(sc2, from, to, []).cover).toBe('totale');
  });
});
