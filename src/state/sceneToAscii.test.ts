import { describe, expect, it } from 'vitest';
import { buildScene, type MapSpec } from './mapSpec';
import { heightAt, isDescriptiveZone, tileAt, type Scene, type SceneEffectZone } from './scene';
import { sceneToAscii } from './sceneToAscii';
import { diligenceCampaign } from '../scenes/campaign';

/** Scène réelle la plus riche du dépôt (paquet éditeur : 32×38, 2 niveaux, 596 murs, 37 zones). */
const diligenceScene = () => diligenceCampaign.scenes[0];

/** Reconstruit un `MapSpec` MINIMAL depuis un export (walled/legend/terrain/wallStructures/zoneMap/
 *  zoneLegend/relief SEULEMENT) — exactement ce que l'énoncé demande de « coller » dans un fichier source : aucune
 *  autre section du `MapSpec` d'origine (bind/cells/entities/architecture/…) n'est reportée. */
function reimport(id: string, size: [number, number], exp: ReturnType<typeof sceneToAscii>): MapSpec {
  return {
    id,
    nom: id,
    size,
    walled: exp.walled,
    legend: exp.legend,
    terrain: exp.terrain,
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

/** Vérité des SURFACES : tuiles, hauteurs, zones descriptives — case par case (`tileAt`/`heightAt`,
 *  robuste aux longueurs/sparsité des tableaux bruts). */
function expectSurfacesEqual(original: Scene, rebuilt: Scene) {
  const { w, h } = original.dimensions;
  const zs = [...new Set(original.layers.map((l) => l.z))].sort((a, b) => a - b);
  expect(new Set(rebuilt.layers.map((l) => l.z))).toEqual(new Set(zs));
  for (const z of zs)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        expect(tileAt(rebuilt, x, y, z), `tileAt(${x},${y},z${z})`).toBe(tileAt(original, x, y, z));
        expect(heightAt(rebuilt, x, y, z), `heightAt(${x},${y},z${z})`).toBe(heightAt(original, x, y, z));
      }
  expect(normZones(rebuilt)).toEqual(normZones(original));
}

/** Vérité GÉOMÉTRIQUE round-trip (#énoncé) : surfaces + murs/portes/fenêtres à l'identique. */
function expectGeometryEqual(original: Scene, rebuilt: Scene) {
  expectSurfacesEqual(original, rebuilt);
  expect(normWalls(rebuilt)).toEqual(normWalls(original));
}

describe('sceneToAscii — round-trip doré (buildScene → export → réimport → buildScene)', () => {
  it('La Diligence (32×38, 2 niveaux, 596 murs) : tout revient à l’identique SAUF ce que l’export déclare perdu', () => {
    const original = diligenceScene();
    expect(original.walls?.length).toBe(596);
    const exp = sceneToAscii(original);
    const rebuilt = buildScene(reimport('la-diligence-rt', [original.dimensions.w, original.dimensions.h], exp));
    expectSurfacesEqual(original, rebuilt);

    // Le grillage `walled` n'a qu'UN glyphe de porte, donc un seul matériau de porte : l'export le
    // DÉCLARE au lieu de le taire, et la perte se borne au champ `structure` des portes concernées.
    expect(exp.warnings).toHaveLength(1);
    expect(exp.warnings[0]).toMatch(/porte\(s\) avec un matériau distinct/);
    const before = normWalls(original);
    const after = normWalls(rebuilt);
    const sansMateriauDePorte = (w: ReturnType<typeof normWalls>[number]) => (w.door ? { ...w, structure: null } : w);
    expect(after.map(sansMateriauDePorte)).toEqual(before.map(sansMateriauDePorte));
    const divergents = before.filter((w, i) => w.structure !== after[i].structure);
    expect(divergents.every((w) => w.door)).toBe(true);
    expect(divergents).toHaveLength(5);
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

describe('sceneToAscii — honnêteté de la portée (#énoncé)', () => {
  it('liste `cells.stair` en tête de `notRestored` (une recette de volée ne se ré-authore pas depuis l’ASCII)', () => {
    const exp = sceneToAscii(diligenceScene());
    expect(exp.notRestored[0]).toMatch(/cells\.stair/);
    expect(exp.notRestored[0]).toMatch(/relief/);
  });

  it('le texte exporté PORTE explicitement la liste de ce qui n’est pas restitué', () => {
    const exp = sceneToAscii(diligenceScene());
    for (const n of exp.notRestored) expect(exp.text).toContain(n);
  });

  it('les hauteurs d’une RAMPE peinte survivent via `relief`', () => {
    const original = diligenceScene();
    const exp = sceneToAscii(original);
    // Marche intermédiaire de la rampe ouest de La Diligence : sa hauteur doit être réémise.
    const cell = exp.relief.find((r) => r.cell?.[0] === 14 && r.cell?.[1] === 24 && (r.z ?? 0) === 0);
    expect(cell?.height).toBe(heightAt(original, 14, 24, 0));
  });
});
