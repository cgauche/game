import { describe, expect, it } from 'vitest';
import { buildScene, type MapSpec } from './mapSpec';
import { heightAt, isDescriptiveZone, tileAt, type Scene, type SceneEffectZone } from './scene';
import { sceneToAscii } from './sceneToAscii';
import { buildDiligenceFloorplan } from '../scenes/diligence/floorplan';

/** Reconstruit un `MapSpec` MINIMAL depuis un export (walled/legend/wallStructures/zoneMap/zoneLegend/
 *  relief SEULEMENT) — exactement ce que l'énoncé demande de « coller » dans un fichier source : aucune
 *  autre section du `MapSpec` d'origine (bind/cells/entities/architecture/…) n'est reportée. */
function reimport(id: string, size: [number, number], exp: ReturnType<typeof sceneToAscii>): MapSpec {
  return {
    id,
    nom: id,
    size,
    walled: exp.walled,
    legend: exp.legend,
    wallStructures: exp.wallStructures,
    ...(Object.keys(exp.zoneMap).length ? { zoneMap: exp.zoneMap, zoneLegend: exp.zoneLegend } : {}),
    ...(exp.relief.length ? { relief: exp.relief } : {}),
  };
}

function normWalls(scene: Scene) {
  return (scene.walls ?? [])
    .map((w) => ({ x: w.x, y: w.y, side: w.side, z: w.z ?? 0, door: !!w.door, window: !!w.window, structure: w.structure ?? null }))
    .sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y || a.side.localeCompare(b.side));
}

function normZones(scene: Scene) {
  return (scene.effectZones ?? [])
    .filter(isDescriptiveZone)
    .map((z: SceneEffectZone) => ({
      id: z.id,
      label: z.label,
      presentation: z.presentation ?? null,
      z: z.z ?? 0,
      tiles: [...(z.tiles ?? [])].sort((a, b) => a.y - b.y || a.x - b.x),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Vérité GÉOMÉTRIQUE round-trip (#énoncé) : tuiles, hauteurs, murs/portes/fenêtres, zones descriptives —
 *  case par case (`tileAt`/`heightAt`, robuste aux longueurs/sparsité des tableaux bruts). */
function expectGeometryEqual(original: Scene, rebuilt: Scene) {
  const { w, h } = original.dimensions;
  const zs = [...new Set(original.layers.map((l) => l.z))].sort((a, b) => a - b);
  expect(new Set(rebuilt.layers.map((l) => l.z))).toEqual(new Set(zs));
  for (const z of zs)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        expect(tileAt(rebuilt, x, y, z), `tileAt(${x},${y},z${z})`).toBe(tileAt(original, x, y, z));
        expect(heightAt(rebuilt, x, y, z), `heightAt(${x},${y},z${z})`).toBe(heightAt(original, x, y, z));
      }
  expect(normWalls(rebuilt)).toEqual(normWalls(original));
  expect(normZones(rebuilt)).toEqual(normZones(original));
}

describe('sceneToAscii — round-trip doré (buildScene → export → réimport → buildScene)', () => {
  it('La Diligence (32×34, 2 étages, 582 murs) : géométrie identique après aller-retour', () => {
    const original = buildDiligenceFloorplan();
    expect(original.walls?.length).toBe(582);
    const exp = sceneToAscii(original);
    const rebuilt = buildScene(reimport('la-diligence-rt', [original.dimensions.w, original.dimensions.h], exp));
    expectGeometryEqual(original, rebuilt);
  });

  it('un plan simple (1 étage, portes/fenêtres/matériau/diagonale/rampe/zones) : géométrie identique', () => {
    const spec: MapSpec = {
      id: 'simple',
      nom: 'Simple',
      size: [6, 5],
      terrain: 'herbe',
      legend: { P: 'plancher' },
      walled: {
        z0: String.raw`
+ + + + + + +
 P P P P . .
+-+-+:+-+ + +
 P P P P . .
+=+o+-+\+ + +
 P P P P . .
+ + + + + + +
 . . . . . .
+ + + + + + +
 . . . . . .
+ + + + + + +
`,
      },
      wallStructures: { '=': 'mur-en-pierre' },
      relief: [
        { rect: [0, 0, 3, 2], height: 2, z: 0 },
        { ramp: [3, 0, 5, 0], from: 2, to: 0, z: 0 },
      ],
      zoneMap: {
        z0: [
          'AAAA..',
          'AAAA..',
          '......',
          '..BBBB',
          '......',
        ],
      },
      zoneLegend: {
        A: { label: 'Salle Ouest', presentation: 'interior' },
        B: { label: 'Cour Est', presentation: 'exterior' },
      },
    };
    const original = buildScene(spec);
    const exp = sceneToAscii(original);
    const rebuilt = buildScene(reimport('simple-rt', [6, 5], exp));
    expectGeometryEqual(original, rebuilt);
  });
});

describe('sceneToAscii — honnêteté de la portée (#énoncé, cas escalier explicite)', () => {
  it('liste `cells.stair` en tête de `notRestored` (les cases E/W ne se ré-authorent pas)', () => {
    const exp = sceneToAscii(buildDiligenceFloorplan());
    expect(exp.notRestored[0]).toMatch(/cells\.stair/);
    expect(exp.notRestored[0]).toMatch(/relief/);
  });

  it('le texte exporté PORTE explicitement la liste de ce qui n’est pas restitué', () => {
    const exp = sceneToAscii(buildDiligenceFloorplan());
    for (const n of exp.notRestored) expect(exp.text).toContain(n);
  });

  it('les hauteurs de la volée d’escalier (rampe) survivent malgré tout via `relief`', () => {
    const original = buildDiligenceFloorplan();
    const exp = sceneToAscii(original);
    // Une case de trémie connue de La Diligence (#780) : sa hauteur d'étage doit être réémise.
    const cell = exp.relief.find((r) => r.cell[0] === 12 && r.cell[1] === 21 && (r.z ?? 0) === 1);
    expect(cell?.height).toBe(heightAt(original, 12, 21, 1));
  });
});
