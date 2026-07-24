import { describe, expect, it } from 'vitest';
import { emptyScene, setStructureDown, type Scene, type WallSeg } from './scene';
import { portalsForParty, portalsFromRooms, roomPortals } from './roomPortals';

function sceneWithRooms(
  walls: WallSeg[] = [],
  labels: readonly [string, string] = ['Salle orientale', 'Salle occidentale'],
): Scene {
  const scene = emptyScene(5, 4);
  scene.effectZones = [
    {
      id: 'room-a',
      label: labels[0],
      presentation: 'interior',
      area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 },
    },
    {
      id: 'room-b',
      label: labels[1],
      presentation: 'interior',
      area: { kind: 'rect', x: 2, y: 1, w: 1, h: 1 },
    },
  ];
  scene.walls = walls;
  return scene;
}

function sceneWithExteriorDoors(closed = false): Scene {
  const scene = emptyScene(8, 3);
  scene.layers[0].tiles.fill('vide');
  for (const [x, y] of [[0, 1], [1, 1], [5, 1], [6, 1]] as const) {
    scene.layers[0].tiles[x + y * 8] = 'herbe';
  }
  scene.effectZones = [
    {
      id: 'room-a',
      label: 'Salle A',
      presentation: 'interior',
      area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 },
    },
    {
      id: 'room-b',
      label: 'Salle B',
      presentation: 'interior',
      area: { kind: 'rect', x: 5, y: 1, w: 1, h: 1 },
    },
  ];
  scene.walls = [
    { x: 0, y: 1, side: 'E', door: true, closed },
    { x: 5, y: 1, side: 'E', door: true, closed },
  ];
  return scene;
}

describe('roomPortals — graphe dérivé des pièces', () => {
  it('produit les deux orientations d’un passage entre deux pièces', () => {
    const portals = roomPortals(sceneWithRooms()).filter((portal) => !portal.exterior);

    expect(portals).toEqual([
      {
        id: '0:1,1:E:room-a:room-b',
        z: 0,
        edge: { x: 1, y: 1, side: 'E' },
        fromZoneId: 'room-a',
        toZoneId: 'room-b',
        kind: 'passage',
        exterior: false,
        from: { x: 1, y: 1 },
        to: { x: 2, y: 1 },
      },
      {
        id: '0:1,1:E:room-b:room-a',
        z: 0,
        edge: { x: 1, y: 1, side: 'E' },
        fromZoneId: 'room-b',
        toZoneId: 'room-a',
        kind: 'passage',
        exterior: false,
        from: { x: 2, y: 1 },
        to: { x: 1, y: 1 },
      },
    ]);
  });

  it('dérive les ids des coordonnées et ids de zones, jamais des labels', () => {
    const first = roomPortals(sceneWithRooms([], ['Cuisine', 'Couloir'])).map((portal) => portal.id);
    const renamed = roomPortals(sceneWithRooms([], ['Autre A', 'Autre B'])).map((portal) => portal.id);

    expect(renamed).toEqual(first);
  });

  it.each([
    [{ x: 1, y: 1, side: 'E', door: true, closed: false } satisfies WallSeg, 'door-open'],
    [{ x: 1, y: 1, side: 'E', door: true, closed: true } satisfies WallSeg, 'door-closed'],
  ] as const)('reflète l’état mécanique d’une porte %s', (wall, kind) => {
    const portals = roomPortals(sceneWithRooms([wall])).filter((portal) => !portal.exterior);

    expect(portals.map((portal) => portal.kind)).toEqual([kind, kind]);
  });

  it('omet un mur plein fermé entre deux pièces', () => {
    const portals = roomPortals(sceneWithRooms([{ x: 1, y: 1, side: 'E' }]));

    expect(portals.some((portal) => !portal.exterior)).toBe(false);
  });

  it('omet un faux passage entre deux surfaces séparées par une falaise', () => {
    const scene = sceneWithRooms();
    scene.layers[0].height = new Array(20).fill(0);
    scene.layers[0].height![2 + 1 * 5] = 10;

    expect(roomPortals(scene).some((portal) => !portal.exterior)).toBe(false);
  });

  it('omet une structure intacte et expose son passage une fois abattue', () => {
    const intact = sceneWithRooms([{ x: 1, y: 1, side: 'E', structure: 'mur-en-pierre' }]);
    const breached = setStructureDown(intact, 1, 1, 'E', 0, true);

    expect(roomPortals(intact).some((portal) => !portal.exterior)).toBe(false);
    expect(roomPortals(breached).filter((portal) => !portal.exterior).map((portal) => portal.kind)).toEqual([
      'passage',
      'passage',
    ]);

    const gate = sceneWithRooms([{
      x: 1,
      y: 1,
      side: 'E',
      door: true,
      closed: true,
      structure: 'porte-de-ville',
    }]);
    const breachedGate = setStructureDown(gate, 1, 1, 'E', 0, true);
    expect(roomPortals(breachedGate).filter((portal) => !portal.exterior).map((portal) => portal.kind)).toEqual([
      'passage',
      'passage',
    ]);
  });

  it('produit une sortie extérieure seulement vers une cellule mécaniquement franchissable', () => {
    const scene = emptyScene(4, 4);
    scene.effectZones = [{
      id: 'room-a',
      label: 'Salle',
      presentation: 'interior',
      area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 },
    }];
    scene.walls = [{ x: 1, y: 1, side: 'N' }];

    const exits = roomPortals(scene).filter((portal) => portal.exterior);

    expect(exits.map((portal) => portal.to)).not.toContainEqual({ x: 1, y: 0 });
    expect(exits).toContainEqual(expect.objectContaining({
      fromZoneId: 'room-a',
      toZoneId: null,
      exterior: true,
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
    }));
  });

  it('sépare strictement les portails de deux étages superposés', () => {
    const scene = sceneWithRooms([{ x: 1, y: 1, side: 'E', door: true, closed: true }]);
    scene.layers.push({ z: 1, tiles: new Array(20).fill('plancher') });
    scene.effectZones!.push(
      {
        id: 'upper-a',
        label: 'Étage A',
        presentation: 'interior',
        z: 1,
        area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 },
      },
      {
        id: 'upper-b',
        label: 'Étage B',
        presentation: 'interior',
        z: 1,
        area: { kind: 'rect', x: 2, y: 1, w: 1, h: 1 },
      },
    );

    const interior = roomPortals(scene).filter((portal) => !portal.exterior);

    expect(interior.filter((portal) => portal.z === 0).map((portal) => portal.kind)).toEqual([
      'door-closed',
      'door-closed',
    ]);
    expect(interior.filter((portal) => portal.z === 1).map((portal) => portal.kind)).toEqual([
      'passage',
      'passage',
    ]);
  });

  it('filtre les seuils selon les ids de pièces occupées', () => {
    const portals = portalsFromRooms(sceneWithRooms(), new Set(['room-b']));

    expect(portals.every((portal) => portal.fromZoneId === 'room-b')).toBe(true);
    expect(portals.some((portal) => portal.toZoneId === 'room-a')).toBe(true);
  });

  it('réoriente vers l’intérieur le portail extérieur atteignable quand aucune pièce n’est occupée', () => {
    const portals = portalsForParty(sceneWithExteriorDoors(), { x: 0, y: 1 }, new Set());

    expect(portals).toEqual([expect.objectContaining({
      id: '0:0,1:E:exterior:room-a',
      fromZoneId: null,
      toZoneId: 'room-a',
      exterior: true,
      from: { x: 0, y: 1 },
      to: { x: 1, y: 1 },
    })]);
  });

  it('expose une porte extérieure fermée depuis sa composante sans dupliquer le seuil', () => {
    const portals = portalsForParty(sceneWithExteriorDoors(true), { x: 0, y: 1 }, new Set());

    expect(portals).toEqual([expect.objectContaining({
      id: '0:0,1:E:exterior:room-a',
      kind: 'door-closed',
      from: { x: 0, y: 1 },
      to: { x: 1, y: 1 },
    })]);
    expect(new Set(portals.map((portal) => portal.id)).size).toBe(portals.length);
  });
});
