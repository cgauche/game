import { describe, expect, it } from 'vitest';
import { PROPS } from '../../gameIso/catalog/decor';
import { roofSvg } from '../../gameIso/backends/affineRoofs';
import { buildRoofs } from '../../gameIso/builders/roofs';
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

  it('AUCUNE masse authorée (#829) : l\'architecture est ENTIÈREMENT DÉRIVÉE du plancher réel, couverture totale, roomZoneIds calculés', () => {
    const scene = buildDiligenceScene();
    expect(Reflect.get(scene, 'roofs')).toBeUndefined();
    expect('roofs' in scene).toBe(false);
    expect(scene.architecture).toHaveLength(1);
    const masses = scene.architecture![0].masses;
    // Rien n'a été authoré à la main (`DILIGENCE_MASSES` est vide, floorplan.ts) — chaque masse ici
    // sort de `deriveArchitectureMasses` (#829) : `buildScene` l'aurait fait échouer sinon
    // (`validateBuildingMasses`, plancher sans masse).
    expect(masses.length).toBeGreaterThan(0);
    expect(masses.every((mass) => mass.id.includes('-auto-'))).toBe(true);
    // Chaque masse est une masse RÉELLE (#823) : rectangles contigus, niveaux entiers, pente en degrés.
    for (const mass of masses) {
      expect(mass.footprint.length).toBeGreaterThan(0);
      expect(Number.isInteger(mass.levels) && mass.levels >= 1).toBe(true);
      expect(mass.pitchDeg).toBeGreaterThanOrEqual(5);
      expect(mass.pitchDeg).toBeLessThanOrEqual(75);
      expect(mass.material).toBe('ardoise');
      expect(mass.profile).toBe('hip'); // défaut de la dérivation (#829, pas de `roofDefaults` authoré ici)
    }
    // Le corps d'étage (2 niveaux) est un volume dérivé — un seul faîtage résolu au long axe (#823,
    // « un seul long faîtage sur le corps principal » plutôt que cinq nefs parallèles).
    const corps = masses.find((mass) => mass.levels === 2)!;
    expect(corps).toBeDefined();
    expect(corps.profile).toBe('hip');

    // Chaque masse coïncide EXACTEMENT avec son plancher réel — buildScene l'a déjà fait échouer sinon
    // (`validateBuildingMasses`) ; on le reconfirme ici comme contrat de non-régression.
    const cellsOf = (mass: (typeof masses)[number]) => {
      const out = new Set<string>();
      for (const rect of mass.footprint)
        for (let y = rect.y; y < rect.y + rect.h; y++)
          for (let x = rect.x; x < rect.x + rect.w; x++) out.add(`${x},${y}`);
      return out;
    };
    const allCells = masses.flatMap((mass) => [...cellsOf(mass)]);
    expect(new Set(allCells).size).toBe(allCells.length); // aucun chevauchement (règle 3)

    const interiorIds = new Set(
      (scene.effectZones ?? [])
        .filter((zone) => zone.presentation === 'interior')
        .map((zone) => zone.id),
    );
    expect(interiorIds.size).toBeGreaterThan(0);
  });

  it('borne le coût de l’enveloppe extérieure', () => {
    const scene = buildDiligenceScene();
    const roofs = buildRoofs(scene);
    // Budgets RELEVÉS après la dérivation par défaut (#829 : 13 masses `hip`, une par composante
    // 4-connexe du plancher réel — plus aucune authorée à la main) : mesuré 131 nappes / 433 faces /
    // 1070 lignes / ≤338 157 car. de SVG (4 rotations) + headroom, pas un nombre magique hérité —
    // réécrit depuis le comportement attendu (doctrine : « refaire les tests de zéro », pas s'y plier).
    expect(roofs.length).toBeLessThanOrEqual(145);
    expect(roofs.reduce((count, roof) => count + roof.faces.length, 0)).toBeLessThanOrEqual(460);
    expect(roofs.reduce((count, roof) => count + roof.lines.length, 0)).toBeLessThanOrEqual(1150);
    for (const rot of [0, 1, 2, 3] as const) {
      const dims = { ...scene.dimensions, rot };
      expect(roofs.map((roof) => roofSvg(roof, dims, { zoom: 1 })).join('').length)
        .toBeLessThanOrEqual(350_000);
    }
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
