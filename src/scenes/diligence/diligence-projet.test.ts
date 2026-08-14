import { describe, it, expect } from 'vitest';
import { diligenceCampaign } from '../campaign';
import { doorAt, edgeOf, heightAt, isWalkable, type Scene } from '../../state/scene';
import { pathTo, walkNeighbors, type Pt } from '../../state/path';
import { sceneZoneTiles } from '../../state/zones';
import { gradeBetween } from '../../state/relief';

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

function planSanctuarise(on: Scene) {
  const cells = on.layers.flatMap((layer) => {
    const z = layer.z;
    const out: { x: number; y: number; z: number; walkable: boolean; height: number }[] = [];
    for (let y = 0; y < on.dimensions.h; y++)
      for (let x = 0; x < on.dimensions.w; x++)
        out.push({ x, y, z, walkable: isWalkable(on, x, y, z), height: heightAt(on, x, y, z) });
    return out;
  });
  const walls = (on.walls ?? []).map(({ window: _window, ...wall }) => wall)
    .sort((a, b) => `${a.z ?? 0}:${a.y}:${a.x}:${a.side}`.localeCompare(`${b.z ?? 0}:${b.y}:${b.x}:${b.side}`));
  const zones = (on.effectZones ?? []).map((zone) => ({
    id: zone.id,
    z: zone.z ?? 0,
    presentation: zone.presentation ?? null,
    area: zone.area,
    tiles: sceneZoneTiles(zone).map((p) => [p.x, p.y, p.z ?? zone.z ?? 0]).sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));
  const entities = on.entities.map((entity) => ({
    id: entity.id,
    kind: entity.kind,
    pos: entity.pos,
    z: entity.z ?? 0,
  })).sort((a, b) => a.id.localeCompare(b.id));
  return { dimensions: on.dimensions, cells, walls, zones, entities };
}

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

/** Le cellier de l'étage — pièce close du plan authoré, desservie par une porte percée sur son
 *  périmètre à z1 : la connectivité de `walkNeighbors` l'atteint (mesuré ci-dessous). */
const cellier = scene.effectZones!.find((z) => z.id === 'zone-l-z1')!;
const casesCellier = sceneZoneTiles(cellier).map((p) => `${p.x},${p.y},${p.z ?? 0}`).sort();

describe('La Diligence — paquet de campagne authoré dans l’éditeur', () => {
  it('sanctuarise le plan hors apparence et fenêtres', () => {
    expect(planSanctuarise(scene)).toMatchSnapshot();
  });

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
    expect(etage).toHaveLength(422);
    expect(atteintes).toHaveLength(etage.length);
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

  it('l’étage est INTÉGRALEMENT desservi : ses 422 surfaces sont atteignables à pied depuis le départ, et chacune de ses 18 pièces est rejointe en entier', () => {
    const reached = reachableFrom(start);
    // Une pièce qui se referme doit se DÉSIGNER : le rapport porte son libellé et son id — il passe donc EN PREMIER.
    const pieces = scene.effectZones!.filter((z) => (z.z ?? 0) === 1);
    expect(pieces).toHaveLength(18);
    const encloses = pieces.flatMap((z) => {
      const sol = sceneZoneTiles(z).filter((p) => isWalkable(scene, p.x, p.y, 1));
      const hors = sol.filter((p) => !reached.has(`${p.x},${p.y},1`));
      return hors.length ? [`${z.label} (${z.id}) : ${hors.length}/${sol.length} cases hors d’atteinte`] : [];
    });
    expect(encloses).toEqual([]);
    const etage = walkableTiles(1);
    expect(etage).toHaveLength(422);
    const isoles = etage.filter((p) => !reached.has(`${p.x},${p.y},1`)).map((p) => `${p.x},${p.y},${p.z ?? 0}`).sort();
    expect(isoles).toEqual([]);
  });

  it('le cellier de l’étage est DESSERVI : son périmètre de 12 arêtes est entièrement bâti, et au moins une de ces arêtes se franchit par une porte', () => {
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
    // Une porte reste une arête BÂTIE : elle figure dans `walls`, marquée `door`.
    const murees = aretes.filter((e) => scene.walls!.some((w) => w.x === e.x && w.y === e.y && w.side === e.side && (w.z ?? 0) === 1));
    expect(murees).toHaveLength(12);
    const portes = aretes.filter((e) => doorAt(scene, e.x, e.y, e.side, 1));
    expect(portes.length).toBeGreaterThanOrEqual(1);
    const reached = reachableFrom(start);
    expect(casesCellier).toHaveLength(8);
    expect(casesCellier.filter((k) => !reached.has(k))).toEqual([]);
  });

  it('`pathTo` rend un chemin réel du départ jusqu’à l’étage', () => {
    const etage = walkableTiles(1);
    const chemin = pathTo(scene, start, etage[0], { blocked: new Set() });
    expect(chemin).not.toBeNull();
    expect(chemin!.length).toBeGreaterThan(1);
    expect(chemin!.some((p) => (p.z ?? 0) === 1)).toBe(true);
  });
});
