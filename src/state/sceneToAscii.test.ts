import { describe, expect, it } from 'vitest';
import { buildScene, type MapSpec } from './mapSpec';
import { heightAt, isDescriptiveZone, tileAt, type Scene, type SceneEffectZone } from './scene';
import { sceneZoneTiles } from './zones';
import { sceneToAscii } from './sceneToAscii';
import { diligenceCampaign } from '../scenes/campaign';

/** Scène réelle la plus riche du dépôt (paquet éditeur : 32×38, 2 niveaux). */
const diligenceScene = () => diligenceCampaign.scenes[0];

/** Reconstruit un `MapSpec` MINIMAL depuis un export (walled/legend/terrain/wallStructures/zoneMap/
 *  zoneLegend/relief SEULEMENT) — exactement ce que l'énoncé demande de « coller » dans un fichier source : aucune
 *  autre section du `MapSpec` d'origine (bind/cells/entities/architecture/…) n'est reportée. */
function reimport(id: string, size: [number, number], exp: ReturnType<typeof sceneToAscii>): MapSpec {
  return {
    id,
    label: id,
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
      tiles: sceneZoneTiles(z)
        .map((t) => ({ x: t.x, y: t.y, z: t.z ?? 0 }))
        .sort((a, b) => a.y - b.y || a.x - b.x),
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
  /** La Diligence est EN AUTHORING : le doré ne PEUT PAS y épingler un compte authoré (nombre
   *  d'ouvertures à matériau distinct, nombre d'avertissements d'export) — il rougirait à chaque coup
   *  de pinceau d'une session d'authoring et bloquerait le tronc. Arbitrage 2026-08-21 (#1447),
   *  verbatim de l'utilisateur : « C'est absurde d'avoir un guard qui bloque totalement la diligence
   *  alors qu'elle n'est même pas finalisé ».
   *  RÉ-ENTRÉE : ré-étalonner à la FINALISATION de la carte — recopier les comptes REÇUS (portes et
   *  fenêtres divergentes, avertissements) et dire dans le commit ce qui les a déplacés. Ce qui NE
   *  dépend d'aucun compte authoré — identité des surfaces, identité des murs modulo le matériau
   *  d'ouverture que l'export déclare perdu — reste verrouillé ci-dessous. */
  it('La Diligence (EN AUTHORING) : tout revient à l’identique SAUF ce que l’export déclare perdu', () => {
    const original = diligenceScene();
    expect(original.walls?.length ?? 0).toBeGreaterThan(0);
    const exp = sceneToAscii(original);
    const rebuilt = buildScene(reimport('la-diligence-rt', [original.dimensions.w, original.dimensions.h], exp));
    expectSurfacesEqual(original, rebuilt);

    // Le grillage `walled` n'a qu'UN glyphe par ouverture : l'export déclare les matériaux de porte
    // et de fenêtre qu'il ne peut pas représenter.
    const before = normWalls(original);
    const after = normWalls(rebuilt);
    const sansMateriauPerdu = (w: ReturnType<typeof normWalls>[number]) => (w.door || w.window ? { ...w, structure: null } : w);
    expect(after.map(sansMateriauPerdu)).toEqual(before.map(sansMateriauPerdu));
    const divergents = before.filter((w, i) => w.structure !== after[i].structure);
    expect(divergents.every((w) => w.door || w.window)).toBe(true);
    for (const w of divergents)
      expect(exp.warnings.join(' | ')).toMatch(
        w.door ? /porte\(s\) avec un matériau distinct de « solide-porte-en-bois »/ : /fenêtre\(s\) avec un matériau distinct de « mur-a-ossature-en-bois »/,
      );
  });

  it('un plan simple (1 étage, portes/fenêtres/matériau/diagonale/rampe/zones) : géométrie identique', () => {
    const spec: MapSpec = {
      id: 'simple',
      label: 'Simple',
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
    // La carte étant EN AUTHORING (#1447), la sonde se DÉRIVE de l'export au lieu d'épingler la case
    // d'une marche : toute case de relief réémise porte la hauteur de la scène d'origine.
    const cellules = exp.relief.filter((r) => r.cell);
    expect(cellules.length).toBeGreaterThan(0);
    for (const r of cellules)
      expect(r.height, `relief cell ${r.cell![0]},${r.cell![1]} z${r.z ?? 0}`).toBe(
        heightAt(original, r.cell![0], r.cell![1], r.z ?? 0),
      );
  });
});
