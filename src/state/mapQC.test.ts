import { describe, it, expect } from 'vitest';
import { buildScene } from './mapSpec';
import { scenario as zonesPiecesScenario } from '../scenes/test-scenarios/zones-pieces';
import { reachableCells, unreachableDescriptiveZones, reachedFloors, startOf } from './mapQC';

describe('mapQC — harnais QC de cartes (#778)', () => {
  it('démo `zones-pieces` (4 pièces cloisonnées) : les 4 pièces sont toutes atteignables depuis heroStart', () => {
    const scene = zonesPiecesScenario.scene;
    const start = startOf(scene);
    expect(start).not.toBeNull();
    expect(unreachableDescriptiveZones(scene, start!)).toEqual([]);
  });

  it('deux étages reliés par une volée `cells.stair` (#780) : connexité verticale + pièces nommées atteignables', () => {
    // Reprend la géométrie éprouvée de mapSpec.test.ts (#780) : foyer z0 → volée `E` → galerie z1.
    const scene = buildScene({
      id: 's-2f', nom: 'Deux étages', size: [4, 3], terrain: 'mur',
      levels: { z0: ['....', 'FEEE', '....'].join('\n'), z1: ['...G', '....', '....'].join('\n') },
      legend: { F: 'pave', G: 'pierre' },
      elevate: { F: 1, G: 4 },
      cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } },
      heroStart: [0, 1],
      zoneMap: {
        z0: ['....', 'R...', '....'].join('\n'),
        z1: ['...S', '....', '....'].join('\n'),
      },
      zoneLegend: { R: { label: 'Foyer' }, S: { label: 'Galerie' } },
    });
    const start = startOf(scene);
    expect(start).toEqual({ x: 0, y: 1, z: 0 });
    const floors = reachedFloors(scene, start!);
    expect(floors.has(0)).toBe(true);
    expect(floors.has(1)).toBe(true);
    expect(unreachableDescriptiveZones(scene, start!)).toEqual([]);
  });

  it('pièce nommée MURÉE (enveloppe fermée par arêtes, aucune porte) → le harnais la signale inatteignable', () => {
    // Sol marchable `herbe` PARTOUT — la cellule (3,1) est scellée par ses 4 arêtes murées (`walls`
    // N/E/S/O), pas par du terrain `mur` (coins ÉTANCHES : `neighborsOf` bloque la diagonale via
    // l'arête posée sur la case CIBLE, #789 — aucun contournement par le terrain n'est nécessaire).
    const scene = buildScene({
      id: 's-mur', nom: 'Cellule scellée', size: [5, 3], terrain: 'herbe',
      heroStart: [1, 1],
      walls: [
        { x: 3, y: 1, side: 'N' },
        { x: 3, y: 1, side: 'E' },
        { x: 3, y: 1, side: 'S' },
        { x: 3, y: 1, side: 'O' },
      ],
      zoneMap: { z0: ['.....', '...X.', '.....'].join('\n') },
      zoneLegend: { X: { label: 'Cellule scellée' } },
    });
    const start = startOf(scene);
    expect(start).toEqual({ x: 1, y: 1, z: 0 });
    const unreachable = unreachableDescriptiveZones(scene, start!);
    expect(unreachable.map((z) => z.label)).toEqual(['Cellule scellée']);
  });

  it('zone posée sur du mur (aucune case marchable) → inatteignable', () => {
    const scene = buildScene({
      id: 's-vide', nom: 'Zone sur du mur', size: [3, 3], terrain: 'mur',
      levels: { z0: ['...', '.P.', '...'].join('\n') },
      legend: { P: 'herbe' },
      heroStart: [1, 1],
      zoneMap: { z0: ['..Z', '...', '...'].join('\n') },
      zoneLegend: { Z: { label: 'Sur du mur' } },
    });
    const start = startOf(scene);
    const unreachable = unreachableDescriptiveZones(scene, start!);
    expect(unreachable.map((z) => z.label)).toEqual(['Sur du mur']);
  });

  it('reachableCells depuis heroStart contient bien la case de départ', () => {
    const scene = zonesPiecesScenario.scene;
    const start = startOf(scene)!;
    const cells = reachableCells(scene, start);
    expect(cells.has(`${start.x},${start.y},${start.z}`)).toBe(true);
  });
});
