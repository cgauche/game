import { describe, expect, it } from 'vitest';
import { PROPS } from '../../gameIso/catalog/decor';
import { edgeWallState } from '../../state/sceneEdit';
import { reachedFloors, startOf, unreachableDescriptiveZones } from '../../state/mapQC';
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

function labelsAt(scene: ReturnType<typeof buildDiligenceFloorplan>, x: number, y: number, z: number): string[] {
  return (scene.effectZones ?? []).filter((zone) => {
    if ((zone.z ?? 0) !== z || zone.area.kind !== 'rect') return false;
    return x >= zone.area.x && x < zone.area.x + zone.area.w && y >= zone.area.y && y < zone.area.y + zone.area.h;
  }).map((zone) => zone.label);
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

  it('représente les 23 libellés et leurs zones disjointes sans bounding-box mensongère', () => {
    const scene = buildDiligenceFloorplan();
    const labels = new Set(scene.effectZones?.map((zone) => zone.label));
    expect(DILIGENCE_LABELS).toHaveLength(23);
    expect([...DILIGENCE_LABELS].every((label) => labels.has(label))).toBe(true);
    for (const [label, count] of Object.entries(DILIGENCE_ZONE_MULTIPLICITIES))
      expect(scene.effectZones?.filter((zone) => zone.label === label)).toHaveLength(count);
    expect(labelsAt(scene, 17, 2, 0)).toContain('Cour');
    expect(labelsAt(scene, 6, 27, 0)).toContain('Forge');
    expect(labelsAt(scene, 25, 23, 0)).toContain('Brasserie');
    expect(labelsAt(scene, 22, 21, 1)).toContain('Chambres individuelles');
  });

  it('rend toutes les zones descriptives et les deux étages atteignables', () => {
    const scene = buildDiligenceFloorplan();
    const start = startOf(scene);
    expect(start).not.toBeNull();
    expect(unreachableDescriptiveZones(scene, start!)).toEqual([]);
    expect([...reachedFloors(scene, start!)]).toEqual([0, 1]);
  });

  it('compile exactement deux volées distinctes z0 → z1', () => {
    const scene = buildDiligenceFloorplan();
    expect(Object.entries(DILIGENCE_FLOORPLAN_SPEC.cells ?? {}).filter(([, recipe]) => recipe.stair).map(([char]) => char).sort()).toEqual(['E', 'W']);
    const stairs = scene.entities.filter((entity) => entity.kind === 'prop' && entity.ref === 'escalier-bois');
    expect(stairs).toHaveLength(8);
    expect(stairs.filter((entity) => entity.pos.x === 12).map((entity) => entity.pos.y).sort((a, b) => a - b)).toEqual([21, 22, 23, 24]);
    expect(stairs.filter((entity) => entity.pos.x === 20).map((entity) => entity.pos.y).sort((a, b) => a - b)).toEqual([20, 21, 22, 23]);
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
