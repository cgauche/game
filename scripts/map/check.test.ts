/**
 * Verrouille le COMPORTEMENT de `auditFacade`/`locateGrid` sur des fixtures SYNTHÉTIQUES (petites
 * scènes construites pour le test), jamais sur les comptes de la scène RÉELLE (#823) — la première
 * correction de plan rendrait un contrat figé sur ces comptes rouge à tort. Les mesures sur les
 * scènes réelles restent en bas, en NON-RÉGRESSION INFORMATIVE seulement (elles bougent légitimement
 * à chaque correction de plan, ce n'est PAS le contrat de ce fichier).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditFacade, auditUnsupportedFloor, auditZoneCoverage, floorPairs, type Defect } from './audit';
import { locateGrid } from './locate';
import { findMap } from './registry';
import type { Scene, SceneEffectZone, WallSeg } from '../../src/state/scene';

function makeScene(w: number, h: number, z0: string[], z1: string[], walls: WallSeg[], zones: SceneEffectZone[]): Scene {
  return {
    id: 'fixture',
    nom: 'Fixture de test',
    description: '',
    dimensions: { w, h },
    layers: [{ z: 0, tiles: z0 }, { z: 1, tiles: z1 }],
    walls,
    effectZones: zones,
    entities: [],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}

describe('auditFacade — critère GÉOMÉTRIQUE (#823 défauts 1+2)', () => {
  it("une trémie ENCERCLÉE par la dalle (mezzanine/garde-corps sur un vide central) n'est PAS un mur manquant", () => {
    const w = 5, h = 5;
    const z0 = new Array(w * h).fill('plancher');
    const z1 = new Array(w * h).fill('plancher');
    z1[2 * w + 2] = 'vide'; // trémie centrale (2,2), encerclée de tous côtés
    const zones: SceneEffectZone[] = [{ id: 'salle', label: 'Salle', area: { kind: 'rect', x: 0, y: 0, w, h }, z: 0 }];
    const scene = makeScene(w, h, z0, z1, [], zones);
    const nearHole = (d: Defect) =>
      (d.x === 1 && d.y === 2 && d.side === 'E') ||
      (d.x === 3 && d.y === 2 && d.side === 'O') ||
      (d.x === 2 && d.y === 1 && d.side === 'S') ||
      (d.x === 2 && d.y === 3 && d.side === 'N');

    const filtered = auditFacade(scene, 1, 0, true).filter(nearHole);
    expect(filtered).toHaveLength(0);

    // CONTRE-PREUVE : le test ci-dessus vérifie le FILTRE, pas l'absence de trou — sans lui, le même
    // trou remonte bien (garde qu'un test qui « passe toujours » ne masque pas une assertion vide).
    const unfiltered = auditFacade(scene, 1, 0, false).filter(nearHole);
    expect(unfiltered.length).toBeGreaterThan(0);
  });

  it("le vide au-dessus d'une annexe de plain-pied REJOINT le dehors — reste détecté même si la zone dessous est 'interior' (#823 défaut 2 : l'ancien filtre zonal s'y fiait à tort)", () => {
    const w = 5, h = 3; // corps principal x=0..2 (2 étages), annexe x=3..4 (1 seul étage)
    const z0 = new Array(w * h).fill('plancher');
    const z1 = new Array(w * h).fill('vide');
    for (let y = 0; y < h; y++) for (let x = 0; x <= 2; x++) z1[y * w + x] = 'plancher';
    const zones: SceneEffectZone[] = [
      { id: 'corps', label: 'Corps principal', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 3, h }, z: 0 },
      { id: 'annexe', label: 'Annexe', presentation: 'interior', area: { kind: 'rect', x: 3, y: 0, w: 2, h }, z: 0 },
    ];
    const scene = makeScene(w, h, z0, z1, [], zones);

    const defects = auditFacade(scene, 1, 0, true);
    const junction = defects.filter((d) => d.side === 'E' && d.x === 2 && [0, 1, 2].includes(d.y));
    expect(junction).toHaveLength(3);
    expect(junction.every((d) => d.family === 'mur-manquant')).toBe(true);
  });

  it("sans AUCUNE zone descriptive déclarée, refuse de rendre un verdict plutôt que de deviner (#823 défaut 1, ceinture — un faux positif est pire qu'un défaut raté)", () => {
    const w = 5, h = 3;
    const z0 = new Array(w * h).fill('plancher');
    const z1 = new Array(w * h).fill('vide');
    for (let y = 0; y < h; y++) for (let x = 0; x <= 2; x++) z1[y * w + x] = 'plancher';
    const scene = makeScene(w, h, z0, z1, [], []); // zéro zoneMap

    expect(auditFacade(scene, 1, 0, true)).toEqual([]);
    expect(auditFacade(scene, 1, 0, false)).toEqual([]);
  });

  it('CONTRE-PREUVE sur La Diligence (scène réelle) : retirer le mur z1 en (12,7)O fait apparaître EXACTEMENT un défaut de plus — le silence structurel du défaut 2 est corrigé', () => {
    const entry = findMap('diligence');
    const scene = entry.build();
    const [[aboveZ, belowZ]] = floorPairs(scene);
    // (12,7)O = forme canonique E de (11,7), cf. geometry.ts#canonical.
    const targetWall = (w: WallSeg) => (w.z ?? 0) === aboveZ && w.side === 'E' && w.x === 11 && w.y === 7;
    expect((scene.walls ?? []).some(targetWall)).toBe(true); // le mur existe bien sur le plan actuel

    const before = auditFacade(scene, aboveZ, belowZ);
    const mutated: Scene = { ...scene, walls: (scene.walls ?? []).filter((w) => !targetWall(w)) }; // EN MÉMOIRE — aucun fichier touché
    const after = auditFacade(mutated, aboveZ, belowZ);
    expect(after.length).toBe(before.length + 1);
  });
});

describe('locateGrid — jamais de position devinée (#823 défaut 3)', () => {
  function withTempDir(fn: (dir: string) => void): void {
    const dir = mkdtempSync(join(tmpdir(), 'map-locate-test-'));
    try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  it('jette une erreur AMBIGUË (jamais le premier choisi au hasard) quand deux blocs identiques existent', () => {
    withTempDir((dir) => {
      const raw = 'AAA\nBBB';
      writeFileSync(join(dir, 'aile-ouest.ts'), `export const AILE_OUEST = String.raw\`${raw}\`;\n`);
      writeFileSync(join(dir, 'aile-est.ts'), `export const AILE_EST = String.raw\`${raw}\`;\n`);
      expect(() => locateGrid(dir, raw, 'single')).toThrow(/AMBIGU/);
      try {
        locateGrid(dir, raw, 'single');
        expect.unreachable();
      } catch (e) {
        expect(String(e)).toContain('AILE_OUEST');
        expect(String(e)).toContain('AILE_EST');
      }
    });
  });

  it("CONTRE-PREUVE : un seul bloc correspondant se localise normalement (l'ambiguïté ci-dessus n'est pas un fantôme structurel)", () => {
    withTempDir((dir) => {
      const raw = 'CCC\nDDD';
      writeFileSync(join(dir, 'unique.ts'), `export const UNIQUE = String.raw\`${raw}\`;\n`);
      const loc = locateGrid(dir, raw, 'single');
      expect(loc.rows).toEqual(['CCC', 'DDD']);
    });
  });

  it('jette une erreur INTROUVABLE (distincte de AMBIGUË) quand rien ne correspond', () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, 'autre.ts'), 'export const AUTRE = String.raw`XYZ`;\n');
      expect(() => locateGrid(dir, 'introuvable', 'single')).toThrow(/introuvable/);
    });
  });
});

describe('mesures INFORMATIVES sur les scènes réelles (non contractuelles — bougent légitimement à chaque correction de plan)', () => {
  it('La Diligence — familles 1-5 (corps principal, post-correctif géométrique)', () => {
    const entry = findMap('diligence');
    const scene = entry.build();
    const [[aboveZ, belowZ]] = floorPairs(scene);
    const facade = auditFacade(scene, aboveZ, belowZ);
    const zones = auditZoneCoverage(scene, aboveZ, belowZ);
    const unsupported = auditUnsupportedFloor(scene, aboveZ, belowZ, entry.groundTerrains);
    expect(facade.filter((d) => d.family === 'facade-decalee')).toHaveLength(19);
    expect(facade.filter((d) => d.family === 'mur-manquant')).toHaveLength(16);
    expect(zones.filter((d) => d.family === 'etage-sur-exterior')).toHaveLength(24);
    expect(zones.filter((d) => d.family === 'case-sans-zone')).toHaveLength(24);
    expect(unsupported).toHaveLength(5);
  });

  it('Théâtre Staatsoper — aucune zone descriptive authorée, `auditFacade` ne rend plus 83 faux positifs mais 0 (#823 défaut 1)', () => {
    const entry = findMap('opera');
    const scene = entry.build();
    const [[aboveZ, belowZ]] = floorPairs(scene);
    expect(auditFacade(scene, aboveZ, belowZ)).toHaveLength(0);
  });
});
