import { describe, expect, it } from 'vitest';
import { PROPS } from '../../gameIso/catalog/decor';
import { edgeWallState } from '../../state/sceneEdit';
import { reachableCells, reachedFloors, startOf, unreachableDescriptiveZones } from '../../state/mapQC';
import {
  DILIGENCE_FLOORPLAN_SPEC,
  DILIGENCE_LABELS,
  DILIGENCE_OPENINGS,
  DILIGENCE_SIZE,
  DILIGENCE_WITNESSES,
  DILIGENCE_ZONE_MULTIPLICITIES,
  buildDiligenceFloorplan,
} from './floorplan';
import { buildDiligenceScene } from './furnished';
import { sceneZoneTiles } from '../../state/zones';
import { roomFocusAt } from '../../gameIso/stage/roomFocus';

function labelsAt(scene: ReturnType<typeof buildDiligenceFloorplan>, x: number, y: number, z: number): string[] {
  return (scene.effectZones ?? [])
    .filter((zone) => sceneZoneTiles(zone).some((tile) => tile.x === x && tile.y === y && (tile.z ?? 0) === z))
    .map((zone) => zone.label);
}

describe('La Diligence — plan jouable', () => {
  it('compile les deux niveaux authorés sur une grille commune de 32 × 34', () => {
    const scene = buildDiligenceFloorplan();
    expect(scene.dimensions).toEqual({ w: 32, h: 34 });
    expect(DILIGENCE_SIZE).toEqual([32, 34]);
    expect(scene.layers.map((layer) => layer.z)).toEqual([0, 1]);
  });

  it('conserve les comptes authorés de portes et fenêtres', () => {
    const scene = buildDiligenceFloorplan();
    const doors = scene.walls?.filter((wall) => wall.door) ?? [];
    const windows = scene.walls?.filter((wall) => wall.window) ?? [];
    expect(doors.filter((wall) => (wall.z ?? 0) === 0)).toHaveLength(DILIGENCE_OPENINGS.z0.doors);
    expect(doors.filter((wall) => wall.z === 1)).toHaveLength(DILIGENCE_OPENINGS.z1.doors);
    expect(windows.filter((wall) => (wall.z ?? 0) === 0)).toHaveLength(DILIGENCE_OPENINGS.z0.windows);
    expect(windows.filter((wall) => wall.z === 1)).toHaveLength(DILIGENCE_OPENINGS.z1.windows);
  });

  it('porte les témoins structurels du plan', () => {
    const scene = buildDiligenceFloorplan();
    for (const witness of DILIGENCE_WITNESSES)
      expect(edgeWallState(scene, witness.x, witness.y, witness.side, witness.z)).toBe(witness.state);
    const stone = scene.walls?.filter((wall) => wall.structure === 'mur-en-pierre') ?? [];
    const timber = scene.walls?.filter((wall) => wall.structure === 'mur-a-ossature-en-bois') ?? [];
    expect(stone.length).toBeGreaterThan(20);
    expect(timber.length).toBeGreaterThan(100);
    const portal = scene.walls?.find((wall) => wall.x === 17 && wall.y === 1 && wall.side === 'N');
    expect(portal?.door).toBe(true);
    expect(portal?.structure).toBeUndefined();
  });

  it('représente les 22 libellés et leurs zones disjointes sans bounding-box mensongère', () => {
    const scene = buildDiligenceFloorplan();
    const labels = new Set(scene.effectZones?.map((zone) => zone.label));
    expect(DILIGENCE_LABELS).toHaveLength(22);
    expect([...DILIGENCE_LABELS].every((label) => labels.has(label))).toBe(true);
    for (const [label, count] of Object.entries(DILIGENCE_ZONE_MULTIPLICITIES))
      expect(scene.effectZones?.filter((zone) => zone.label === label)).toHaveLength(count);
    expect(labelsAt(scene, 17, 2, 0)).toContain('Cour');
    expect(labelsAt(scene, 6, 27, 0)).toContain('Forge');
    expect(labelsAt(scene, 25, 23, 0)).toContain('Brasserie');
    expect(labelsAt(scene, 22, 21, 1)).toContain('Chambres individuelles');
  });

  it('n’active aucun intérieur au départ dans la cour, puis focalise une pièce z0 sur son masque exact', () => {
    const scene = buildDiligenceFloorplan();
    expect(roomFocusAt(scene, { x: 17, y: 2, z: 0 })).toBeNull();
    const salle = scene.effectZones!.find((zone) => zone.id === 'zone-S-z0')!;
    const focus = roomFocusAt(scene, { x: 10, y: 7, z: 0 });
    expect(focus?.id).toBe('zone-S-z0');
    expect(focus?.tiles).toEqual(new Set(sceneZoneTiles(salle).map((tile) => `${tile.x},${tile.y},${tile.z ?? 0}`)));
  });

  it('rend toutes les zones descriptives et les deux étages atteignables', () => {
    const scene = buildDiligenceFloorplan();
    const start = startOf(scene);
    expect(start).not.toBeNull();
    expect(unreachableDescriptiveZones(scene, start!)).toEqual([]);
    expect([...reachedFloors(scene, start!)]).toEqual([0, 1]);
  });

  it('franchit réellement les escaliers z0 → z1 (pas juste un étage isolé qui se déclare atteint)', () => {
    const scene = buildDiligenceFloorplan();
    const start = startOf(scene);
    expect(start).not.toBeNull();
    const reached = reachableCells(scene, start!);
    const z1Reached = [...reached].filter((key) => key.endsWith(',1'));
    expect(z1Reached.length).toBeGreaterThan(0);
  });

  it('compile exactement deux volées distinctes z0 → z1', () => {
    const scene = buildDiligenceFloorplan();
    expect(Object.entries(DILIGENCE_FLOORPLAN_SPEC.cells ?? {}).filter(([, recipe]) => recipe.stair).map(([char]) => char).sort()).toEqual(['E', 'W']);
    const stairs = scene.entities.filter((entity) => entity.kind === 'prop' && entity.ref === 'escalier-bois');
    expect(stairs).toHaveLength(8);
    expect(stairs.filter((entity) => entity.pos.x === 12).map((entity) => entity.pos.y).sort((a, b) => a - b)).toEqual([21, 22, 23, 24]);
    expect(stairs.filter((entity) => entity.pos.x === 20).map((entity) => entity.pos.y).sort((a, b) => a - b)).toEqual([20, 21, 22, 23]);
  });

  it('meublée, garde toutes les zones descriptives z1 atteignables (mobilier ne scelle aucun passage)', () => {
    const scene = buildDiligenceScene();
    const start = startOf(scene);
    expect(start).not.toBeNull();
    expect(unreachableDescriptiveZones(scene, start!)).toEqual([]);
  });

  it('meublée, couvre chaque zone intérieure par des toits d’ailes bornés sans recouvrir les extérieurs', () => {
    const scene = buildDiligenceScene();
    const roofs = scene.roofs ?? [];
    const covers = (x: number, y: number, z: number) =>
      roofs.some((roof) => (roof.z ?? 0) === z
        && x >= roof.foot.x && x < roof.foot.x + roof.foot.w
        && y >= roof.foot.y && y < roof.foot.y + roof.foot.h);

    expect(roofs.length).toBeGreaterThan(0);
    expect(new Set(roofs.map((roof) => roof.id)).size).toBe(roofs.length);
    expect(roofs.some((roof) => (roof.z ?? 0) === 0)).toBe(true);
    expect(roofs.some((roof) => roof.z === 1)).toBe(true);
    for (const roof of roofs) {
      expect(roof.style).toBe('maison');
      expect(roof.params?.roofMaterial).toBe('tuile');
      expect(roof.foot.x).toBeGreaterThanOrEqual(0);
      expect(roof.foot.y).toBeGreaterThanOrEqual(0);
      expect(roof.foot.x + roof.foot.w).toBeLessThanOrEqual(scene.dimensions.w);
      expect(roof.foot.y + roof.foot.h).toBeLessThanOrEqual(scene.dimensions.h);
    }

    const interiorTiles = (scene.effectZones ?? [])
      .filter((zone) => zone.presentation === 'interior')
      .flatMap(sceneZoneTiles);
    const exteriorTiles = (scene.effectZones ?? [])
      .filter((zone) => zone.presentation === 'exterior')
      .flatMap(sceneZoneTiles);
    expect(interiorTiles.every((tile) => covers(tile.x, tile.y, tile.z ?? 0))).toBe(true);
    expect(exteriorTiles.some((tile) => covers(tile.x, tile.y, tile.z ?? 0))).toBe(false);

    for (const witness of [
      { x: 17, y: 2, z: 0 },
      { x: 17, y: 22, z: 0 },
      { x: 2, y: 30, z: 0 },
      { x: 5, y: 20, z: 1 },
      { x: 12, y: 7, z: 1 },
    ]) expect(covers(witness.x, witness.y, witness.z)).toBe(false);
  });

  it('meuble chaque activité sans contenu narratif ou rencontre', () => {
    const scene = buildDiligenceScene();
    const props = scene.entities.filter((entity) => entity.kind === 'prop');
    const refs = new Set(props.map((entity) => entity.ref));
    for (const ref of [
      'escalier-bois',
      'balustrade-bois',
      'enclume',
      'foyer-de-forge',
      'cuve-brasserie',
      'stalle-ecurie',
      'tas-foin',
    ]) expect(refs.has(ref)).toBe(true);
    expect(refs.has('foin')).toBe(false);
    for (const ref of refs) expect(ref && PROPS[ref], `prop absent du catalogue : ${ref}`).toBeTruthy();
    expect(labelsAt(scene, 6, 27, 0)).toContain('Forge');
    expect(props.find((entity) => entity.ref === 'foyer-de-forge')?.pos).toEqual({ x: 6, y: 27 });
    expect(labelsAt(scene, 25, 23, 0)).toContain('Brasserie');
    expect(props.find((entity) => entity.ref === 'cuve-brasserie')?.pos).toEqual({ x: 25, y: 23 });
    expect(labelsAt(scene, 12, 27, 0)).toContain('Écuries & remise');
    expect(props.find((entity) => entity.ref === 'stalle-ecurie')?.pos).toEqual({ x: 12, y: 27 });
    expect(scene.entities.some((entity) => entity.kind === 'personnage')).toBe(false);
    expect(scene.triggers).toEqual([]);
    expect(scene.dialogues).toEqual([]);
    expect(scene.encounters).toEqual([]);
  });
});
