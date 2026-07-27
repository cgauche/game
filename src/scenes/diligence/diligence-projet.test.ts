import { describe, it, expect } from 'vitest';
import { diligenceCampaign } from '../campaign';
import { doorAt, edgeOf, isWalkable, type Scene } from '../../state/scene';
import { pathTo, walkNeighbors, type Pt } from '../../state/path';
import { sceneZoneTiles } from '../../state/zones';
import { gradeBetween } from '../../state/relief';
import { heightAt } from '../../state/scene';

/**
 * « La Diligence » — relais routier authoré dans l'éditeur, embarqué en paquet de campagne
 * (`diligence-projet.json`). Ce fichier verrouille ce dont le RUNTIME dépend : la scène se charge, et
 * l'étage se rejoint à pied. La liaison verticale n'est portée par AUCUN objet : elle se dérive du
 * relief peint (`state/relief.ts` — `gradeBetween` classe `flat`/`ramp`/`cliff`, `walkNeighbors` ne
 * franchit que les deux premiers).
 */
const scene: Scene = diligenceCampaign.scenes[0];
const heroStart = scene.entities.find((e) => e.kind === 'heroStart')!;
const start: Pt = { x: heroStart.pos.x, y: heroStart.pos.y, z: heroStart.z ?? 0 };

/** Toutes les surfaces marchables d'un niveau. */
function walkableTiles(z: number): Pt[] {
  const out: Pt[] = [];
  for (let y = 0; y < scene.dimensions.h; y++)
    for (let x = 0; x < scene.dimensions.w; x++) if (isWalkable(scene, x, y, z)) out.push({ x, y, z });
  return out;
}

/** Fermeture transitive de `walkNeighbors` depuis `from` — la MÊME connectivité que le pathfinding. */
function reachableFrom(from: Pt, on: Scene = scene): Set<string> {
  const key = (p: Pt) => `${p.x},${p.y},${p.z ?? 0}`;
  const seen = new Set([key(from)]);
  const queue: Pt[] = [from];
  while (queue.length) {
    const p = queue.shift()!;
    for (const n of walkNeighbors(on, p)) if (!seen.has(key(n))) { seen.add(key(n)); queue.push(n); }
  }
  return seen;
}

/** Le cellier de l'étage — pièce close du plan authoré : son périmètre à z1 est intégralement muré,
 *  aucune de ses arêtes ne porte de porte, donc aucun chemin ne l'atteint (mesuré ci-dessous). */
const cellier = scene.effectZones!.find((z) => z.id === 'zone-l-z1')!;
const casesCellier = sceneZoneTiles(cellier).map((p) => `${p.x},${p.y},${p.z ?? 0}`).sort();

describe('La Diligence — paquet de campagne authoré dans l’éditeur', () => {
  it('une seule scène, 32×38, deux niveaux', () => {
    expect(diligenceCampaign.scenes).toHaveLength(1);
    expect(scene.id).toBe('la-diligence');
    expect(scene.dimensions).toEqual({ w: 32, h: 38 });
    expect([...new Set(scene.layers.map((l) => l.z))].sort()).toEqual([0, 1]);
  });

  it('point de départ du groupe posé sur une case marchable du rez', () => {
    expect(isWalkable(scene, start.x, start.y, start.z ?? 0)).toBe(true);
  });

  it('la liaison verticale tient au RELIEF SEUL : privée de toutes ses entités, la scène garde le même étage accessible à pied', () => {
    const sansEntites: Scene = { ...scene, entities: [] };
    const etage = walkableTiles(1);
    const reached = reachableFrom(start, sansEntites);
    const atteintes = etage.filter((p) => reached.has(`${p.x},${p.y},1`));
    expect(atteintes).toHaveLength(414);
    expect(etage.length - atteintes.length).toBe(casesCellier.length);
  });

  it('les deux rampes montent du sol (0 m) au plancher de l’étage (4 m) par des paliers FRANCHISSABLES', () => {
    const volees = [
      [{ x: 19, y: 20 }, { x: 19, y: 21 }, { x: 19, y: 22 }, { x: 20, y: 22 }],
      [{ x: 14, y: 23 }, { x: 14, y: 24 }, { x: 14, y: 25 }, { x: 13, y: 25 }],
    ];
    for (const volee of volees) {
      const hauteurs = volee.map((c) => heightAt(scene, c.x, c.y, 0));
      expect(hauteurs).toEqual([1, 2, 3, 4]);
      for (let i = 1; i < hauteurs.length; i++) expect(gradeBetween(hauteurs[i - 1], hauteurs[i])).toBe('ramp');
      expect(gradeBetween(0, hauteurs[0])).toBe('ramp'); // depuis le sol de la cour
    }
  });

  it('l’étage compte 422 surfaces, dont 414 atteignables à pied depuis le départ : les SEULES hors d’atteinte sont les 8 cases du cellier `zone-l-z1`', () => {
    const reached = reachableFrom(start);
    const etage = walkableTiles(1);
    expect(etage).toHaveLength(422);
    const isoles = etage.filter((p) => !reached.has(`${p.x},${p.y},1`)).map((p) => `${p.x},${p.y},${p.z ?? 0}`).sort();
    expect(casesCellier).toHaveLength(8);
    expect(isoles).toEqual(casesCellier);
  });

  it('CAUSE de l’enclave, mesurée sur les arêtes : le périmètre du cellier à l’étage est muré sur ses 12 arêtes, aucune ne porte de porte', () => {
    const dedans = new Set(sceneZoneTiles(cellier).map((p) => `${p.x},${p.y}`));
    const aretes: { x: number; y: number; side: 'N' | 'E' }[] = [];
    for (const p of sceneZoneTiles(cellier)) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = p.x + dx, ny = p.y + dy;
        if (dedans.has(`${nx},${ny}`)) continue;
        const e = edgeOf(p.x, p.y, nx, ny)!;
        if (!aretes.some((a) => a.x === e.x && a.y === e.y && a.side === e.side)) aretes.push(e);
      }
    }
    expect(aretes).toHaveLength(12);
    const murees = aretes.filter((e) => scene.walls!.some((w) => w.x === e.x && w.y === e.y && w.side === e.side && (w.z ?? 0) === 1));
    expect(murees).toHaveLength(12);
    expect(aretes.filter((e) => doorAt(scene, e.x, e.y, e.side, 1))).toEqual([]);
  });

  it('`pathTo` rend un chemin réel du départ jusqu’à l’étage', () => {
    const etage = walkableTiles(1);
    const chemin = pathTo(scene, start, etage[0], { blocked: new Set() });
    expect(chemin).not.toBeNull();
    expect(chemin!.length).toBeGreaterThan(1);
    expect(chemin!.some((p) => (p.z ?? 0) === 1)).toBe(true);
  });
});
