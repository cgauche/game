import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { diligenceCampaign } from '../campaign';
import { doorAt, heightAt, isWalkable, wallBetween, type Scene, type SceneEntity } from '../../state/scene';
import { walkNeighbors, type Pt } from '../../state/path';
import { sceneZoneTiles } from '../../state/zones';
import { seatSlotsOf, seatIsOccupiable, type ResolvedSeatSlot } from '../../state/seating';
import { findPropById } from '../../data';
import { buildPropVolumes } from '../../gameIso/builders/propVolumes';

/**
 * MEUBLEMENT DE LA SALLE PRINCIPALE — preuve SPATIALE des quinze poses de `zone-S-z0`.
 *
 * Ce fichier tient deux promesses distinctes :
 *  1. le meublement n'a RIEN touché de l'architecture — digests témoins figés, calculés au commit
 *     83d02a10, celui qui précède la pose, et jamais régénérés depuis ;
 *  2. la salle meublée reste JOUABLE : 89 tuiles libres d'une seule composante, dix-huit places
 *     dont l'abord effectif est marchable et exclusif, volumes contenus dans leur case, coutures
 *     obligatoires (portes, fenêtres, rampe) intactes.
 */
const scene: Scene = diligenceCampaign.scenes[0];

/** Les quinze ancres, dans leur ordre d'inscription au document. */
const EXPECTED = [
  ['cheminee-interieure', 10, 8],
  ['comptoir-droit', 10, 24], ['comptoir-angle', 11, 24],
  ['comptoir-droit', 11, 23], ['comptoir-droit', 11, 22], ['comptoir-droit', 11, 21],
  ['comptoir-droit', 11, 20], ['comptoir-droit', 11, 19], ['comptoir-droit', 10, 19],
  ['table-ronde-4-tabourets', 10, 23], ['table-ronde-4-tabourets', 12, 14], ['table-ronde-4-tabourets', 10, 10],
  ['table-murale-2-tabourets', 13, 10], ['table-murale-2-tabourets', 13, 14], ['table-murale-2-tabourets', 13, 19],
] as const;

/** Cap EXPLICITE attendu de chaque pose, dans le même ordre — un meuble à dos ne se laisse pas au défaut. */
const CAPS = ['E', 'S', 'S', 'E', 'E', 'E', 'E', 'E', 'N', 'N', 'N', 'N', 'O', 'O', 'O'] as const;

/** Ids stables des quinze poses, dans le même ordre. */
const IDS = [
  'diligence-salle-cheminee',
  'diligence-salle-comptoir-1', 'diligence-salle-comptoir-2', 'diligence-salle-comptoir-3',
  'diligence-salle-comptoir-4', 'diligence-salle-comptoir-5', 'diligence-salle-comptoir-6',
  'diligence-salle-comptoir-7', 'diligence-salle-comptoir-8',
  'diligence-salle-table-ronde-1', 'diligence-salle-table-ronde-2', 'diligence-salle-table-ronde-3',
  'diligence-salle-table-murale-1', 'diligence-salle-table-murale-2', 'diligence-salle-table-murale-3',
] as const;

/** Empreinte figée de l'ARCHITECTURE au commit qui précède la pose (83d02a10). Un meublement qui
 *  déplace un mur, une ouverture, un terrain ou une zone fait bouger l'un de ces témoins. */
const TOPOLOGY_BEFORE = {
  walls: 668,
  edgeDigest: 'a8573f5ba372806b',
  layersDigest: 'bec00d303b88f5cc',
  effectZones: 39,
  effectZonesDigest: '007e9059756e689d',
  architectureDigest: 'f55715704e6a6e5f',
};

const digest = (valeurs: readonly string[]) =>
  createHash('sha256').update([...valeurs].sort().join('|')).digest('hex').slice(0, 16);

/** Digest des arêtes sur le tuple `x,y,z,side,door,window,structure`. */
const edgeDigest = (murs: NonNullable<Scene['walls']>) =>
  digest(murs.map((m) => `${m.x},${m.y},${m.z ?? 0},${m.side},${m.door ? 1 : 0},${m.window ? 1 : 0},${m.structure ?? ''}`));

const layersDigest = (couches: Scene['layers']) =>
  digest(couches.map((c) => `${c.z}:${digest([JSON.stringify(c)])}`));

const zonesDigest = (zones: NonNullable<Scene['effectZones']>) =>
  digest(zones.map((z) => `${z.id}:${z.z ?? 0}:${JSON.stringify(z.area)}:${sceneZoneTiles(z).map((p) => `${p.x},${p.y},${p.z ?? z.z ?? 0}`).sort().join(';')}`));

/** Les ancres de mobilier du document : `[ref, x, y]`, dans l'ordre des entités. */
const furnitureAnchors = (on: Scene) =>
  on.entities.filter((e) => e.kind === 'prop').map((e) => [e.ref ?? '', e.pos.x, e.pos.y]);

const furnitureAt = (on: Scene, x: number, y: number): SceneEntity =>
  on.entities.find((e) => e.kind === 'prop' && e.pos.x === x && e.pos.y === y && (e.z ?? 0) === 0)!;

interface Boite { x0: number; x1: number; y0: number; y1: number; h0: number; h1: number }

/** AABB monde du meuble, dérivée de ses FACES réelles (`buildPropVolumes`) — pas d'une relecture
 *  parallèle de la recette : ce que le test mesure est ce que le monde cuit. */
function propBounds(ent: SceneEntity): Boite {
  const prop = findPropById(ent.ref ?? '')!;
  const faces = buildPropVolumes(ent, prop, heightAt(scene, ent.pos.x, ent.pos.y, ent.z ?? 0));
  const pts = faces.flatMap((f) => f.poly);
  return {
    x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)),
    h0: Math.min(...pts.map((p) => p.h)), h1: Math.max(...pts.map((p) => p.h)),
  };
}

/** Recouvrement STRICT : deux volumes qui se touchent joint à joint ne s'intersectent pas. */
const intersects = (a: Boite, b: Boite, eps = 1e-9) =>
  a.x0 < b.x1 - eps && b.x0 < a.x1 - eps && a.y0 < b.y1 - eps && b.y0 < a.y1 - eps && a.h0 < b.h1 - eps && b.h0 < a.h1 - eps;

/** Boîte au sol d'une case : le monde des décors centre la case sur ses coordonnées entières. */
const caseBox = (x: number, y: number): Boite =>
  ({ x0: x - 0.5, x1: x + 0.5, y0: y - 0.5, y1: y + 0.5, h0: -Infinity, h1: Infinity });

const contenu = (petit: Boite, grand: Boite, eps = 1e-9) =>
  petit.x0 >= grand.x0 - eps && petit.x1 <= grand.x1 + eps && petit.y0 >= grand.y0 - eps && petit.y1 <= grand.y1 + eps;

const zoneSalle = scene.effectZones!.find((z) => z.id === 'zone-S-z0')!;
const tuilesSalle = sceneZoneTiles(zoneSalle);
const dansSalle = new Set(tuilesSalle.map((t) => `${t.x},${t.y}`));

/** La CASE que tient un corps assis — sa position LOGIQUE au sens de `state/seating.ts` (l'ancre
 *  fractionnaire n'est que du rendu). */
const caseDuCorps = (slot: ResolvedSeatSlot) => `${Math.round(slot.anchor.x)},${Math.round(slot.anchor.y)}`;

/** La case du SIÈGE d'une place — l'origine dont son abord doit être voisin. */
const caseDuSiege = (slot: ResolvedSeatSlot) => ({ x: Math.round(slot.anchor.x), y: Math.round(slot.anchor.y) });

/**
 * Une CLOISON sépare-t-elle ces deux cases ? Lu ici directement au document (`wallBetween`,
 * `state/scene`), sans passer par `seating.ts` : c'est le fait de la SCÈNE que ce test vérifie, pas
 * la parole du module. En diagonale, les deux chemins en L doivent être libres de mur.
 */
function cloisonEntre(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 || dy === 0) return wallBetween(scene, a.x, a.y, b.x, b.y, 0);
  return wallBetween(scene, a.x, a.y, a.x + dx, a.y, 0) || wallBetween(scene, a.x + dx, a.y, b.x, b.y, 0)
    || wallBetween(scene, a.x, a.y, a.x, a.y + dy, 0) || wallBetween(scene, a.x, a.y + dy, b.x, b.y, 0);
}

/** Toutes les places de la salle, meuble par meuble, dans l'ordre du document. */
const placesDeLaSalle = (): ResolvedSeatSlot[] =>
  scene.entities.filter((e) => e.kind === 'prop').flatMap((e) => seatSlotsOf(scene, e.id));

describe('La Diligence — meublement de la salle principale', () => {
  it('pose les quinze ancres sans toucher la topologie', () => {
    expect(furnitureAnchors(scene)).toEqual(EXPECTED.map(([ref, x, y]) => [ref, x, y]));
    expect(scene.walls).toHaveLength(TOPOLOGY_BEFORE.walls);
    expect(edgeDigest(scene.walls!)).toBe(TOPOLOGY_BEFORE.edgeDigest);
    expect(layersDigest(scene.layers)).toBe(TOPOLOGY_BEFORE.layersDigest);
    expect(scene.effectZones).toHaveLength(TOPOLOGY_BEFORE.effectZones);
    expect(zonesDigest(scene.effectZones!)).toBe(TOPOLOGY_BEFORE.effectZonesDigest);
    expect(digest((scene.architecture ?? []).map((a) => JSON.stringify(a)))).toBe(TOPOLOGY_BEFORE.architectureDigest);
  });

  it('chaque meuble porte un id stable, un cap explicite, et repose au niveau du sol de la salle', () => {
    const meubles = scene.entities.filter((e) => e.kind === 'prop');
    expect(meubles.map((e) => e.id)).toEqual([...IDS]);
    expect(meubles.map((e) => e.facing)).toEqual([...CAPS]);
    expect(meubles.map((e) => e.z ?? 0)).toEqual(new Array(15).fill(0));
    expect(meubles.map((e) => heightAt(scene, e.pos.x, e.pos.y, 0))).toEqual(new Array(15).fill(0));
    expect(meubles.filter((e) => !dansSalle.has(`${e.pos.x},${e.pos.y}`)).map((e) => e.id)).toEqual([]);
  });

  it('la salle meublée garde 89 tuiles libres sur 104, en une seule composante', () => {
    expect(tuilesSalle).toHaveLength(104);
    const libres = tuilesSalle.filter((t) => isWalkable(scene, t.x, t.y, 0));
    expect(libres).toHaveLength(89);
    const cle = (p: Pt) => `${p.x},${p.y},${p.z ?? 0}`;
    const vues = new Set([cle(libres[0])]);
    const file: Pt[] = [libres[0]];
    while (file.length) {
      const p = file.shift()!;
      for (const n of walkNeighbors(scene, p)) {
        if ((n.z ?? 0) !== 0 || !dansSalle.has(`${n.x},${n.y}`) || vues.has(cle(n))) continue;
        vues.add(cle(n));
        file.push(n);
      }
    }
    expect(libres.filter((t) => !vues.has(cle(t))).map((t) => `${t.x},${t.y}`)).toEqual([]);
  });

  it('les coutures obligatoires de la salle restent libres', () => {
    for (const [x, y] of [[14, 8], [14, 9], [9, 11], [8, 20]] as const)
      expect(doorAt(scene, x, y, 'E', 0)).toBeTruthy();
    for (const [x, y] of [[14, 12], [14, 16], [14, 20], [14, 24]] as const)
      expect(scene.walls!.find((m) => m.x === x && m.y === y && m.side === 'E' && (m.z ?? 0) === 0)?.window).toBe(true);
    for (const [x, y] of [[11, 7], [10, 26], [13, 26]] as const)
      expect(scene.walls!.find((m) => m.x === x && m.y === y && m.side === 'N' && (m.z ?? 0) === 0)?.window).toBe(true);
    const rampe = [[14, 23], [14, 24], [14, 25], [13, 25]] as const;
    expect(rampe.map(([x, y]) => heightAt(scene, x, y, 0))).toEqual([1, 2, 3, 4]);
    expect(rampe.every(([x, y]) => isWalkable(scene, x, y, 0))).toBe(true);
    expect(furnitureAnchors(scene).filter(([, x, y]) => rampe.some(([rx, ry]) => rx === x && ry === y))).toEqual([]);
  });

  it('chaque volume tient dans sa propre case et aucun meuble n’en recoupe un autre', () => {
    const meubles = scene.entities.filter((e) => e.kind === 'prop');
    expect(meubles.filter((e) => !contenu(propBounds(e), caseBox(e.pos.x, e.pos.y))).map((e) => e.id)).toEqual([]);
    const boites = meubles.map((e) => ({ id: e.id, boite: propBounds(e) }));
    const collisions: string[] = [];
    for (let i = 0; i < boites.length; i++)
      for (let j = i + 1; j < boites.length; j++)
        if (intersects(boites[i].boite, boites[j].boite)) collisions.push(`${boites[i].id} × ${boites[j].id}`);
    expect(collisions).toEqual([]);
  });

  it('les dix-huit places sont occupables : abord marchable, exclusif, et corps assis dans la salle', () => {
    const places = placesDeLaSalle();
    expect(places).toHaveLength(18);
    expect(places.filter((s) => !seatIsOccupiable(scene, s)).map((s) => `${s.propId}/${s.slotId}`)).toEqual([]);
    const abords = places.map((s) => `${s.approach.x},${s.approach.y}`);
    expect(new Set(abords).size).toBe(18);
    const meubles = new Set(scene.entities.filter((e) => e.kind === 'prop').map((e) => `${e.pos.x},${e.pos.y}`));
    expect(abords.filter((a) => meubles.has(a))).toEqual([]);
    const rampe = new Set(['14,23', '14,24', '14,25', '13,25']);
    expect(abords.filter((a) => rampe.has(a))).toEqual([]);
    expect(places.filter((s) => !dansSalle.has(caseDuCorps(s))).map((s) => `${s.propId}/${s.slotId}`)).toEqual([]);
  });

  /**
   * SONDE promue (Task 4bis, 2026-08-23) : un abord marchable ne suffit pas, il doit être VOISIN du
   * siège et qu'aucune CLOISON ne l'en sépare. `table-ronde-3/ouest` résolvait son abord en (9,10),
   * marchable mais derrière le mur bâti (9,10,E) — dans la CUISINE : la place était tenue pour
   * occupable et personne ne pouvait s'y asseoir.
   */
  it('les dix-huit abords sont voisins de leur siège, sans cloison entre eux, et tous dans la salle', () => {
    const places = placesDeLaSalle();
    expect(places).toHaveLength(18);
    const lointains = places.filter((s) => {
      const siege = caseDuSiege(s);
      return Math.max(Math.abs(s.approach.x - siege.x), Math.abs(s.approach.y - siege.y)) !== 1;
    });
    expect(lointains.map((s) => `${s.propId}/${s.slotId}`)).toEqual([]);
    expect(places.filter((s) => cloisonEntre(caseDuSiege(s), s.approach)).map((s) => `${s.propId}/${s.slotId}`)).toEqual([]);
    expect(places.filter((s) => !dansSalle.has(`${s.approach.x},${s.approach.y}`)).map((s) => `${s.propId}/${s.slotId}`)).toEqual([]);
  });

  it('la table adossée au mur de la cuisine assoit quatre convives DU CÔTÉ SALLE', () => {
    const table = furnitureAt(scene, 10, 10);
    expect(table.id).toBe('diligence-salle-table-ronde-3');
    expect(wallBetween(scene, 10, 10, 9, 10, 0), 'le mur de la cuisine DOIT séparer le siège de (9,10) pour que le test morde').toBe(true);
    expect(isWalkable(scene, 9, 10, 0), '(9,10) DOIT rester marchable pour que le test morde').toBe(true);
    const places = seatSlotsOf(scene, table.id);
    expect(places.every((s) => seatIsOccupiable(scene, s))).toBe(true);
    expect(places.map((s) => `${s.slotId}:${s.approach.x},${s.approach.y}`))
      .toEqual(['nord:10,9', 'est:11,10', 'sud:10,11', 'ouest:11,9']);
  });

  it('la table frontière et ses quatre corps tiennent contre le comptoir', () => {
    const table = furnitureAt(scene, 10, 23);
    expect(table.ref).toBe('table-ronde-4-tabourets');
    const places = seatSlotsOf(scene, table.id);
    expect(places).toHaveLength(4);
    expect(intersects(propBounds(table), propBounds(furnitureAt(scene, 10, 24)))).toBe(false);
    expect(intersects(propBounds(table), propBounds(furnitureAt(scene, 11, 23)))).toBe(false);
    expect(places.every((slot) => dansSalle.has(caseDuCorps(slot)))).toBe(true);
    expect(places.every((slot) => seatIsOccupiable(scene, slot))).toBe(true);
    expect(places.map((slot) => `${slot.slotId}:${slot.approach.x},${slot.approach.y}`))
      .toEqual(['nord:10,22', 'est:9,24', 'sud:9,22', 'ouest:9,23']);
  });
});
