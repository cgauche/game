import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { diligenceCampaign } from '../campaign';
import { doorAt, edgeOf, heightAt, isWalkable, type Scene } from '../../state/scene';
import { pathTo, walkNeighbors, type Pt } from '../../state/path';
import { sceneZoneTiles } from '../../state/zones';
import { gradeBetween } from '../../state/relief';
import { structureAppearance } from '../../gameIso/catalog/structures';
import { WALL_H_M } from '../../gameIso/iso';
import { findStructureById } from '../../data';

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

function wallVertices(wall: NonNullable<Scene['walls']>[number]): [string, string] | undefined {
  const z = wall.z ?? 0;
  if (wall.side === 'N') return [`${wall.x},${wall.y},${z}`, `${wall.x + 1},${wall.y},${z}`];
  if (wall.side === 'E') return [`${wall.x + 1},${wall.y},${z}`, `${wall.x + 1},${wall.y + 1},${z}`];
  return undefined;
}

/** Le cellier de l'étage — pièce close du plan authoré, desservie par une porte percée sur son
 *  périmètre à z1 : la connectivité de `walkNeighbors` l'atteint (mesuré ci-dessous). */
const cellier = scene.effectZones!.find((z) => z.id === 'zone-l-z1')!;
const casesCellier = sceneZoneTiles(cellier).map((p) => `${p.x},${p.y},${p.z ?? 0}`).sort();

describe('La Diligence — paquet de campagne authoré dans l’éditeur', () => {
  it('exclut les diagonales visuelles du voisinage des portes cardinales', () => {
    const diagonal = { x: 0, y: 0, side: '\\' } as NonNullable<Scene['walls']>[number];
    expect(wallVertices(diagonal)).toBeUndefined();
  });

  it('sanctuarise le plan hors apparence et fenêtres', () => {
    expect(planSanctuarise(scene)).toMatchSnapshot();
  });

  it('authorise la peau de relais sans toucher au plan', () => {
    const body = scene.architecture?.find((candidate) => candidate.id === 'diligence');
    expect(body?.facades.length).toBeGreaterThan(0);
    expect(body?.facades.every((facade) => facade.appearance === 'auberge-relais-imperiale')).toBe(true);
    const windows = (scene.walls ?? []).filter((wall) => wall.window);
    expect(windows.length).toBeGreaterThan(9);
    expect(windows.every((wall) => !wall.door)).toBe(true);
  });

  it('ne conserve aucune porte totalement orpheline', () => {
    const walls = scene.walls ?? [];
    const doorWithoutIncidentWall = walls.filter((wall, index) => {
      if (!wall.door) return false;
      const doorVertices = wallVertices(wall);
      if (!doorVertices) return false;
      const vertices = new Set(doorVertices);
      return !walls.some((other, otherIndex) => {
        const otherVertices = wallVertices(other);
        return otherIndex !== index && otherVertices?.some((vertex) => vertices.has(vertex));
      });
    });

    expect(walls).not.toContainEqual({ x: 27, y: 30, side: 'N', door: true });
    expect(doorWithoutIncidentWall).toEqual([]);
  });

  it('abaisse seulement les murs existants du jardin et les six séparations de box de la zone 5', () => {
    const clayonnage = 'cloture-en-clayonnage';
    const cloisonBasse = 'cloison-basse-a-ossature-en-bois';
    const jardin = [
      ...[33, 34, 35, 36].map((y) => ({ x: 0, y, side: 'E' as const })),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => ({ x, y: 37, side: 'N' as const })),
    ];
    const boxes = [
      ...[31, 32].map((y) => ({ x: 19, y, side: 'E' as const })),
      ...[29, 30].map((y) => ({ x: 21, y, side: 'E' as const })),
      ...[29, 30].map((y) => ({ x: 23, y, side: 'E' as const })),
    ];
    const wallAt = ({ x, y, side }: (typeof jardin)[number]) =>
      scene.walls!.find((wall) => wall.x === x && wall.y === y && wall.side === side && (wall.z ?? 0) === 0);

    expect(jardin).toHaveLength(13);
    expect(boxes).toHaveLength(6);
    expect(scene.walls).toHaveLength(668);
    expect(jardin.map((edge) => wallAt(edge)?.structure)).toEqual(new Array(13).fill(clayonnage));
    const mursDesBoxes = boxes.map(wallAt);
    expect(mursDesBoxes.map((wall) => wall?.structure)).toEqual(new Array(6).fill('mur-a-ossature-en-bois'));
    expect(mursDesBoxes.map((wall) => wall?.appearance))
      .toEqual(new Array(6).fill(cloisonBasse));

    const murOssature = findStructureById('mur-a-ossature-en-bois')!;
    expect(findStructureById(cloisonBasse)).toBeUndefined();
    expect(mursDesBoxes.map((wall) => findStructureById(wall!.structure!))).toEqual(new Array(6).fill(murOssature));

    const apparenceMur = structureAppearance('mur-a-ossature-en-bois');
    const apparenceCloison = structureAppearance(cloisonBasse);
    const { id: _murAppId, label: _murAppLabel, wallHeightM: _murHeight, ...peauMur } = apparenceMur;
    const { id: _cloisonAppId, label: _cloisonAppLabel, wallHeightM, ...peauCloison } = apparenceCloison;
    expect(wallHeightM).toBe(1.25);
    expect(peauCloison).toEqual(peauMur);
    const clayonnagesPreexistants = [0, 1, 2, 3, 4, 5]
      .map((y) => wallAt({ x: 19, y, side: 'E' }));
    expect(clayonnagesPreexistants.map((wall) => wall?.structure)).toEqual(
      new Array(6).fill(clayonnage),
    );
    expect(structureAppearance(clayonnage).wallHeightM).toBe(1.25);

    const zones5 = scene.effectZones!.filter((zone) =>
      ['zone-E-z0', 'zone-e-z0'].includes(zone.id));
    const dedans = new Set(zones5.flatMap((zone) =>
      sceneZoneTiles(zone).map((tile) => `${tile.x},${tile.y}`)));
    const perimetre = new Map<string, { x: number; y: number; side: 'N' | 'E' }>();
    for (const key of dedans) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (dedans.has(`${x + dx},${y + dy}`)) continue;
        const edge = edgeOf(x, y, x + dx, y + dy)!;
        perimetre.set(`${edge.x},${edge.y},${edge.side}`, edge);
      }
    }
    const mursPeripheriques = [...perimetre.values()].map(wallAt);
    expect(mursPeripheriques).toHaveLength(44);
    expect(mursPeripheriques.every((wall) => wall && wall.structure !== clayonnage)).toBe(true);
    expect(mursPeripheriques.every((wall) =>
      wall && (structureAppearance(wall.structure).wallHeightM ?? WALL_H_M) === WALL_H_M)).toBe(true);
  });

  it('le relais est la scène d’ENTRÉE, 32×38, deux niveaux ; la carte du chapitre 1 y ajoute l’arrivée', () => {
    expect(diligenceCampaign.startSceneId).toBe('la-diligence');
    expect(diligenceCampaign.scenes.map((s) => s.id)).toEqual(['la-diligence', 'altdorf-porte-sud']);
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

/**
 * Cadre de campagne (#717) — le pitch de l'ouverture est un COPIÉ/COLLÉ de la source (règle stricte 5) :
 * on le confronte au fichier `Source/` LU ICI, paragraphe par paragraphe, À L'OCTET. Une reformulation,
 * une italique ajoutée ou une apostrophe « corrigée » rougissent. Patron `book-source-integrity.test.ts`.
 */
const SOURCE_CH1 = fileURLToPath(new URL(
  "../../../Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/01 - Chapitre 1 - On recherche - aventuriers courageux.md",
  import.meta.url,
));

describe('La Diligence — cadre de campagne (#717)', () => {
  const ouverture = diligenceCampaign.narratif.ouverture!;

  it('le pitch de l’ouverture est contenu À L’OCTET dans le Source (chaque paragraphe)', () => {
    const source = readFileSync(SOURCE_CH1, 'utf8');
    const paragraphes = ouverture.pitch.split('\n\n');
    expect(paragraphes.length).toBe(2);
    for (const p of paragraphes) {
      expect(p.length).toBeGreaterThan(80);
      expect(source.includes(p)).toBe(true);
    }
  });

  it('l’ouverture cite sa source (EDO, folio 12) et sa note nomme les lignes recopiées', () => {
    expect(ouverture.source).toEqual({ book: 'ennemi-dans-l-ombre', page: 12, note: 'EDO 01 l.5 · l.13' });
    const lignes = readFileSync(SOURCE_CH1, 'utf8').split(/\r?\n/);
    expect(lignes[4]).toBe(ouverture.pitch.split('\n\n')[0]);
    expect(lignes[12].endsWith(ouverture.pitch.split('\n\n')[1])).toBe(true);
  });

  it('la clôture du chapitre est un fait de DONNÉE (drapeau), avec son titre d’écran', () => {
    expect(diligenceCampaign.narratif.cloture).toEqual({
      when: { kind: 'flag', expr: 'edo-ch1-altdorf-revelee' },
      titre: 'Chapitre 1 — la route d’Altdorf',
      sousTitre: 'Ce que la compagnie emporte vers la capitale',
    });
  });
});
