import { describe, expect, it } from 'vitest';
import { emptyScene, isDescriptiveZone, isWalkable, setDoorOpen, setStructureDown, type Scene, type WallSeg } from './scene';
import { portalsForParty, portalsFromRooms, roomPortals, type RoomPortal } from './roomPortals';
import { pathTo, type Pt } from './path';
import { sceneZoneTiles } from './zones';
import { effectiveArchitecture } from './sceneEdit';
import { massFootprintCells } from '../gameIso/builders/roofs';
import { occupiedInteriorZoneIds } from '../gameIso/stage/roomFocus';
import { diligenceCampaign } from '../scenes/campaign';

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

  /**
   * Le MATÉRIAU d'une porte n'efface pas sa nature de PORTE. `wallIsOpen` (prédicat canonique,
   * `scene.ts`) traite les deux modes d'ouverture comme INDÉPENDANTS — porte ouverte OU structure
   * abattue — et le BFS de déplacement (`path.ts`) en dépend déjà : une porte bâtie en bois reste
   * franchissable quand on l'ouvre. Le graphe d'accès doit dire la même chose que le déplacement,
   * sinon un seuil qu'on peut emprunter n'est signalé nulle part. C'est ce qui a effacé les accès de
   * La Diligence : 60 de ses 61 portes portent une `structure`.
   */
  it.each([
    [false, 'door-open'],
    [true, 'door-closed'],
  ] as const)('signale une porte QUI PORTE UN MATÉRIAU (fermée=%s)', (closed, kind) => {
    const wall: WallSeg = { x: 1, y: 1, side: 'E', door: true, closed, structure: 'mur-a-ossature-en-bois' };
    const portals = roomPortals(sceneWithRooms([wall])).filter((portal) => !portal.exterior);

    expect(portals.map((portal) => portal.kind)).toEqual([kind, kind]);
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

/**
 * ÉQUIVALENCE des sorties accessibles, sur la carte RÉELLE (La Diligence, 32×38, 3 couches, 596
 * murs) — le contrat qui autorise à ne plus chercher un chemin PAR porte.
 *
 * ORACLE = la formulation par chemin : « il existe un chemin du groupe jusqu'à la case de la porte »
 * (`pathTo`). Le rendu doit être le MÊME que celui de `portalsForParty`, case de groupe par case de
 * groupe, sur un échantillon qui couvre les quatre situations que la carte présente : DEDANS (zone
 * intérieure), DEHORS, à l'ÉTAGE, et sous un bâti NON ZONÉ — ce dernier est le cas piège, car il
 * emprunte la branche « hors pièce » comme l'extérieur alors que le groupe est sous un toit.
 *
 * L'environnement de traversée est FIXE dans `portalsForParty` (littéral interne : aucune case
 * bloquée, empreinte 1×1, aucun saut, aucune nage/escalade) et AUCUN de ses appelants ne peut le
 * changer — c'est ce qui rend les deux formulations interchangeables. Si cette précondition tombe un
 * jour, ce test tombe avec elle.
 */
describe('portalsForParty — mêmes sorties que la recherche de chemin, sur La Diligence', () => {
  const scene = diligenceCampaign.scenes[0];

  /** Signature COMPLÈTE d'un accès, hors `id` — lequel est dérivé de champs tous présents ici
   *  (arête, étage, zone de rattachement) : deux accès de même signature portent le même `id`. */
  const sig = (portal: RoomPortal) => JSON.stringify({
    z: portal.z,
    edge: portal.edge,
    kind: portal.kind,
    exterior: portal.exterior,
    fromZoneId: portal.fromZoneId,
    toZoneId: portal.toZoneId,
    from: portal.from,
    to: portal.to,
  });

  /** L'ancienne formulation, gardée ICI comme oracle : un chemin cherché POUR CHAQUE porte. */
  const parCheminJusquACheque = (from: Pt, occupiedZoneIds: ReadonlySet<string>): RoomPortal[] => {
    if (occupiedZoneIds.size) return portalsFromRooms(scene, occupiedZoneIds);
    return roomPortals(scene)
      .filter((portal) => portal.exterior
        && portal.toZoneId === null
        && pathTo(scene, from, portal.to, { blocked: new Set() }) !== null)
      .map((portal) => ({ ...portal, fromZoneId: null, toZoneId: portal.fromZoneId, from: portal.to, to: portal.from }));
  };

  const zoneKeys = new Set<string>();
  for (const zone of scene.effectZones ?? []) {
    if (!isDescriptiveZone(zone) || zone.presentation !== 'interior') continue;
    for (const tile of sceneZoneTiles(zone)) zoneKeys.add(`${tile.x},${tile.y},${tile.z ?? zone.z ?? 0}`);
  }
  const couvertes = new Set<string>();
  for (const body of effectiveArchitecture(scene))
    for (const mass of body.masses)
      for (const cell of massFootprintCells(mass.footprint)) {
        const [x, y] = cell.split(',').map(Number);
        for (let z = mass.z - mass.levels + 1; z <= mass.z; z++) couvertes.add(`${x},${y},${z}`);
      }

  const casesOu = (garde: (x: number, y: number, z: number) => boolean, z: number, combien: number): Pt[] => {
    const out: Pt[] = [];
    for (let y = 0; y < scene.dimensions.h && out.length < combien; y++)
      for (let x = 0; x < scene.dimensions.w && out.length < combien; x++)
        if (isWalkable(scene, x, y, z) && garde(x, y, z)) out.push(z ? { x, y, z } : { x, y });
    return out;
  };
  const zonee = (x: number, y: number, z: number) => zoneKeys.has(`${x},${y},${z}`);
  const couverte = (x: number, y: number, z: number) => couvertes.has(`${x},${y},${z}`);

  // Les quatre situations MESURÉES sur cette carte (mesure : 1216 cases marchables au rez, 422 à
  // l'étage ; 885 cases zonées ; le bâti couvert NON zoné est à l'ÉTAGE — 119 cases — et il n'en
  // existe AUCUNE au rez, d'où le z de chaque ligne).
  const echantillon: [string, Pt[]][] = [
    ['dedans, au rez (zone intérieure)', casesOu((x, y, z) => zonee(x, y, z), 0, 3)],
    ['dehors (ni zone ni toit)', casesOu((x, y, z) => !zonee(x, y, z) && !couverte(x, y, z), 0, 3)],
    ['à l’étage, dans une pièce', casesOu((x, y, z) => zonee(x, y, z), 1, 3)],
    ['à l’étage, sous un bâti NON ZONÉ', casesOu((x, y, z) => couverte(x, y, z) && !zonee(x, y, z), 1, 3)],
  ];

  /** AUCUNE pièce muette sur la carte réelle : une zone intérieure que l'auteur a percée de portes doit
   *  porter au moins un accès. C'est la mesure qui distingue « l'auteur n'a pas percé » d'« on ne sait
   *  plus lire ses portes » — le second cas avait laissé 31 des 33 pièces de La Diligence sans le
   *  moindre indicateur. */
  it('aucune pièce de La Diligence n’est privée d’accès', () => {
    const desservies = new Set(roomPortals(scene)
      .map((portal) => portal.fromZoneId)
      .filter((id): id is string => id !== null));
    const pieces = (scene.effectZones ?? [])
      .filter((zone) => isDescriptiveZone(zone) && zone.presentation === 'interior');

    expect(pieces.length, 'la carte doit porter ses pièces intérieures').toBeGreaterThan(20);
    expect(pieces.filter((zone) => !desservies.has(zone.id)).map((zone) => zone.id)).toEqual([]);
  });

  it('la carte présente bien les quatre situations (sinon l’échantillon ne prouve rien)', () => {
    for (const [situation, cases] of echantillon) {
      expect(cases.length, `aucune case échantillonnée pour « ${situation} »`).toBeGreaterThan(0);
    }
  });

  it('rend exactement les mêmes accès que la recherche de chemin, case par case', () => {
    for (const [situation, cases] of echantillon) {
      for (const pos of cases) {
        const occupees = occupiedInteriorZoneIds(scene, [pos]);
        const attendu = parCheminJusquACheque(pos, occupees).map(sig).sort();
        const obtenu = portalsForParty(scene, pos, occupees).map(sig).sort();
        expect(obtenu, `${situation} — case ${pos.x},${pos.y},${pos.z ?? 0}`).toEqual(attendu);
      }
    }
  }, 180000);
});

/**
 * Mémoïsation par IDENTITÉ de scène (`memoByRef`) : elle ne tient que parce que toute mutation rend
 * une NOUVELLE référence (`setDoorOpen`/`setStructureDown` reconstruisent `scene` ET `scene.flags`).
 * Les deux moitiés du contrat se verrouillent donc ensemble — un mémo qui ne se rafraîchit jamais
 * serait pire que pas de mémo du tout : il figerait les portes dans leur état de départ.
 */
describe('roomPortals — mémoïsé par scène, et rafraîchi dès qu’elle change', () => {
  it('la MÊME scène rend le MÊME tableau (le mémo sert : aucune réénumération)', () => {
    const scene = sceneWithRooms();

    expect(roomPortals(scene)).toBe(roomPortals(scene));
  });

  it('une scène MODIFIÉE (porte ouverte, réf neuve) rend un résultat rafraîchi', () => {
    const surLEdge = (portals: readonly RoomPortal[]) =>
      portals.find((portal) => portal.edge.x === 0 && portal.edge.y === 1 && portal.edge.side === 'E');

    const ferme = sceneWithExteriorDoors(true);
    const avant = roomPortals(ferme);
    expect(surLEdge(avant)?.kind).toBe('door-closed');

    const ouvert = setDoorOpen(ferme, 0, 1, 'E', 0, true);
    expect(ouvert, 'ouvrir une porte doit rendre une NOUVELLE scène').not.toBe(ferme);

    const apres = roomPortals(ouvert);
    expect(apres, 'la scène a changé : le mémo doit avoir été refait').not.toBe(avant);
    expect(surLEdge(apres)?.kind).toBe('door-open');
  });
});
