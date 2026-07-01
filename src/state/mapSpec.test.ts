import { describe, it, expect } from 'vitest';
import { buildScene } from './mapSpec';
import { layerTiles } from './scene';
import { edgeWallState } from '../ui/editor/editorState';

/** GOLDEN = spécification exécutable du format `MapSpec`. Chaque bloc verrouille une section de la
 *  compilation `buildScene` (headless-editor). L'ordre de compilation est figé par ces attentes. */

describe('buildScene — cas trivial + scalaires', () => {
  const s = buildScene({
    id: 't', nom: 'T', size: [4, 3], terrain: 'pave', heroStart: [1, 1],
    ambiance: 'interieur', metresPerTile: 10, flags: { ouvert: true },
  });
  it('pose dimensions, une couche pleine, le départ héros et les scalaires', () => {
    expect(s.dimensions).toEqual({ w: 4, h: 3 });
    expect(s.layers).toHaveLength(1);
    expect(layerTiles(s, 0).every((t) => t === 'pave')).toBe(true);
    expect(s.metresPerTile).toBe(10);
    expect(s.ambiance).toBe('interieur');
    expect(s.flags).toEqual({ ouvert: true });
    const hero = s.entities.find((e) => e.kind === 'heroStart');
    expect(hero?.pos).toEqual({ x: 1, y: 1 });
  });
});

describe('buildScene — multi-niveaux + relief métrique', () => {
  const s = buildScene({
    id: 'r', nom: 'R', size: [3, 3],
    levels: { z0: '...\n...\n...', z1: 'WWW\nWWW\nWWW' },
    legend: { W: 'pierre' },
    relief: [
      { rect: [0, 2, 2, 2], height: 4, z: 1 }, // rangée du bas de z1 à 4 m
      { ramp: [0, 0, 0, 2], from: 0, to: 2, z: 0 }, // colonne x=0 de z0 : 0→1→2 m
    ],
  });
  it('crée deux couches, la légende s’applique, les hauteurs sont posées', () => {
    expect(s.layers.map((l) => l.z)).toEqual([0, 1]);
    expect(layerTiles(s, 0).every((t) => t === 'herbe')).toBe(true); // base z0 par défaut
    expect(layerTiles(s, 1).every((t) => t === 'pierre')).toBe(true);
    const l1 = s.layers.find((l) => l.z === 1)!;
    expect(l1.height![2 * 3 + 0]).toBe(4); // (0,2)
    expect(l1.height![2 * 3 + 2]).toBe(4); // (2,2)
    const l0 = s.layers.find((l) => l.z === 0)!;
    expect(l0.height![0 * 3 + 0]).toBe(0); // (0,0)
    expect(l0.height![1 * 3 + 0]).toBe(1); // (0,1)
    expect(l0.height![2 * 3 + 0]).toBe(2); // (0,2)
  });
});

describe('buildScene — murs d’arête explicites', () => {
  const s = buildScene({
    id: 'w', nom: 'W', size: [3, 3], terrain: 'pave',
    walls: [
      { x: 1, y: 1, side: 'N' },
      { x: 1, y: 1, side: 'E', door: true },
      { x: 0, y: 0, side: 'N', structure: 'porte-de-ville' },
    ],
  });
  it('pose cloisons, portes et structures brèchables', () => {
    expect(edgeWallState(s, 1, 1, 'N')).toBe('wall');
    expect(edgeWallState(s, 1, 1, 'E')).toBe('door');
    expect(s.walls!.find((w) => w.x === 0 && w.y === 0 && w.side === 'N')!.structure).toBe('porte-de-ville');
  });
});

describe('buildScene — rooms (bâtiment composé)', () => {
  const s = buildScene({
    id: 'b', nom: 'B', size: [8, 8], terrain: 'herbe',
    rooms: [{ foot: [2, 2, 3, 3], style: 'taverne', door: { x: 3, y: 4, side: 'S' }, floor: 'planches', wallStructure: 'mur-en-bois' }],
  });
  it('pose toit + périmètre + porte + sol', () => {
    expect(s.roofs).toHaveLength(1);
    expect(s.roofs![0].style).toBe('taverne');
    expect(edgeWallState(s, 2, 2, 'N')).toBe('wall');
    expect(edgeWallState(s, 3, 4, 'S')).toBe('door');
    expect(layerTiles(s, 0)[2 + 2 * 8]).toBe('planches');
  });
});

describe('buildScene — bind (marqueurs → poses)', () => {
  const s = buildScene({
    id: 'm', nom: 'M', size: [6, 2],
    levels: { z0: '@.k.A.\n......' },
    bind: {
      '@': 'heroStart',
      k: { emplacement: 'canon-petit', crew: 'crew-0' },
      A: { kind: 'personnage', ref: 'garde-du-village', weapon: 'Arc' },
    },
  });
  it('interprète départ, emplacement+équipage et entité-modèle aux positions des marqueurs', () => {
    expect(s.entities.find((e) => e.kind === 'heroStart')?.pos).toEqual({ x: 0, y: 0 });
    const empl = s.entities.find((e) => e.postes?.length);
    expect(empl?.pos).toEqual({ x: 2, y: 0 });
    expect(empl?.postes![0].crewIds).toEqual(['crew-0']);
    const garde = s.entities.find((e) => e.ref === 'garde-du-village');
    expect(garde?.pos).toEqual({ x: 4, y: 0 });
    expect(garde?.weapon).toBe('Arc');
    // les marqueurs ne laissent pas de terrain parasite (nettoyés → base 'herbe')
    expect(layerTiles(s, 0)[0]).toBe('herbe');
  });
});

describe('buildScene — encounters (terse → entités + members)', () => {
  const s = buildScene({
    id: 'e', nom: 'E', size: [10, 6], terrain: 'herbe', heroStart: [1, 3],
    encounters: [{ id: 'enc', enemies: [{ ref: 'gobelin', pos: { x: 8, y: 3 } }] }],
  });
  it('expanse les ennemis en entités cachées + rencontre', () => {
    expect(s.encounters).toHaveLength(1);
    expect(s.encounters[0].id).toBe('enc');
    expect(s.encounters[0].members).toEqual([{ entityId: 'enemy-enc-0' }]);
    const gob = s.entities.find((e) => e.id === 'enemy-enc-0');
    expect(gob?.ref).toBe('gobelin');
    expect(gob?.pos).toEqual({ x: 8, y: 3 });
  });
});

describe('buildScene — bind enrôle les entités posées dans une rencontre', () => {
  const s = buildScene({
    id: 'bm', nom: 'BM', size: [6, 2],
    levels: { z0: 'k.A...\n......' },
    bind: {
      k: { emplacement: 'canon-petit', crew: 'crew-0', member: { enc: 'def', side: 'ally' } },
      A: { entity: { kind: 'personnage', ref: 'garde-du-village' }, member: { enc: 'def', side: 'ally', ai: true } },
    },
    encounters: [{ id: 'def' }], // roster vide — rempli par les marqueurs bind
  });
  it('emplacement et entité-template posés aux marqueurs deviennent members (id généré → enrôlé)', () => {
    const empl = s.entities.find((e) => e.postes?.length)!;
    const garde = s.entities.find((e) => e.ref === 'garde-du-village')!;
    expect(empl.pos).toEqual({ x: 0, y: 0 });
    expect(garde.pos).toEqual({ x: 2, y: 0 });
    const def = s.encounters.find((e) => e.id === 'def')!;
    expect(def.members).toEqual(
      expect.arrayContaining([
        { entityId: empl.id, side: 'ally' },
        { entityId: garde.id, side: 'ally', ai: true },
      ]),
    );
  });
});

describe('buildScene — encounters à membres PRÉ-DÉCLARÉS (roster mixte)', () => {
  const s = buildScene({
    id: 'e2', nom: 'E2', size: [10, 6], terrain: 'herbe',
    entities: [{ id: 'pnj-1', kind: 'personnage', pos: { x: 5, y: 3 }, ref: 'garde-du-village', label: 'Garde' }],
    encounters: [
      // terse (entité fraîche cachée) + membre référençant une entité DÉJÀ posée (visible, dialogue…)
      { id: 'mix', enemies: [{ ref: 'gobelin', pos: { x: 8, y: 3 } }], members: [{ entityId: 'pnj-1', side: 'ally', ai: true }] },
    ],
  });
  it('fusionne les members terse et les members pré-déclarés, sans dupliquer l’entité existante', () => {
    expect(s.encounters[0].members).toEqual([
      { entityId: 'enemy-mix-0' },
      { entityId: 'pnj-1', side: 'ally', ai: true },
    ]);
    expect(s.entities.find((e) => e.id === 'enemy-mix-0')?.ref).toBe('gobelin');
    const pnj = s.entities.filter((e) => e.id === 'pnj-1');
    expect(pnj).toHaveLength(1); // pas de doublon fantôme
    expect(pnj[0].ref).toBe('garde-du-village');
  });
});
