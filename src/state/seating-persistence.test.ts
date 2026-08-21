import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene, type SceneEntity } from './scene';
import { applyMutation, captureMutation } from './sceneInstance';
import { assignSeat, releaseSeat, type SeatAssignments, type SeatOccupant } from './seating';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
const NPC: SeatOccupant = { kind: 'entity', entityId: 'pnj-1' };
const AUTHORED_NPC_SEAT: SeatAssignments = { [PROP]: { nord: NPC } };

function sceneWithAssignments(seatAssignments?: SeatAssignments): Scene {
  const s = emptyScene(10, 10);
  s.id = 'taverne';
  // Table en (4,4) cap `N`. RÈGLE : la `pos` d'un attablé EST l'abord de sa place —
  // nord (4,3), sud (4,5).
  s.entities = [
    { id: PROP, kind: 'prop', pos: { x: 4, y: 4 }, ref: TABLE, facing: 'N' },
    { id: 'pnj-1', kind: 'personnage', pos: { x: 4, y: 3 } },
    { id: 'pnj-2', kind: 'personnage', pos: { x: 4, y: 5 } },
  ] as SceneEntity[];
  if (seatAssignments) s.seatAssignments = seatAssignments;
  return s;
}

describe('SceneMutation — l’assise se persiste en OVERRIDE COMPLET', () => {
  it('round-trip un effacement complet sans ressusciter l’assise authorée', () => {
    const authored = sceneWithAssignments(AUTHORED_NPC_SEAT);
    const current = { ...authored, seatAssignments: {} };
    const mutation = captureMutation(current, authored);
    expect(mutation?.seatAssignments).toEqual({});
    expect(applyMutation(structuredClone(authored), mutation).seatAssignments).toEqual({});
  });

  it('un déplacement de place se capture en entier et se réapplique tel quel', () => {
    const authored = sceneWithAssignments(AUTHORED_NPC_SEAT);
    const leve = releaseSeat(authored, NPC);
    const rassis = assignSeat(leve, PROP, 'sud', NPC, new Set());
    expect(rassis.ok).toBe(true);
    const mutation = captureMutation(rassis.scene, authored);
    expect(mutation?.seatAssignments).toEqual({ [PROP]: { sud: NPC } });
    const revisite = applyMutation(structuredClone(authored), mutation);
    expect(revisite.seatAssignments).toEqual({ [PROP]: { sud: NPC } });
  });

  it('une assise INCHANGÉE (même contenu, autre ordre d’écriture) ne produit AUCUNE mutation', () => {
    const authored = sceneWithAssignments({ [PROP]: { nord: NPC, sud: { kind: 'entity', entityId: 'pnj-2' } } });
    const current: Scene = {
      ...authored,
      seatAssignments: { [PROP]: { sud: { kind: 'entity', entityId: 'pnj-2' }, nord: { kind: 'entity', entityId: 'pnj-1' } } },
    };
    expect(captureMutation(current, authored)).toBeUndefined();
  });

  it('une scène SANS assise des deux côtés reste sans mutation ; une assise APPARUE en produit une', () => {
    const authored = sceneWithAssignments();
    expect(captureMutation(sceneWithAssignments(), authored)).toBeUndefined();
    expect(captureMutation(sceneWithAssignments({}), authored)).toBeUndefined(); // `{}` == rien d'assis
    const apparue = captureMutation(sceneWithAssignments(AUTHORED_NPC_SEAT), authored);
    expect(apparue?.seatAssignments).toEqual(AUTHORED_NPC_SEAT);
  });

  it('applyMutation sans override d’assise laisse l’assise AUTHORÉE intacte', () => {
    const authored = sceneWithAssignments(AUTHORED_NPC_SEAT);
    const out = applyMutation(structuredClone(authored), { removedEntityIds: [], flags: { porte: true } });
    expect(out.seatAssignments).toEqual(AUTHORED_NPC_SEAT);
  });
});

/**
 * Spec §4.2 : « Au chargement et à l'application d'une mutation, `pruneSeatAssignments` élimine les
 * références devenues invalides ». Les deux coutures sont mesurées ici (pur) et sur le store (bout
 * en bout) dans `sceneInstance.test.ts`.
 */
describe('applyMutation — élagage de l’assise quand le groupe est fourni', () => {
  it('la mutation qui RETIRE le meuble emporte la place, dans la même application', () => {
    const authored = sceneWithAssignments(AUTHORED_NPC_SEAT);
    const out = applyMutation(structuredClone(authored), { removedEntityIds: [PROP], flags: {} }, new Set());
    expect(out.entities.map((e) => e.id)).not.toContain(PROP);
    expect(out.seatAssignments).toEqual({});
  });

  it('la mutation qui RETIRE le PNJ emporte sa place', () => {
    const authored = sceneWithAssignments(AUTHORED_NPC_SEAT);
    const out = applyMutation(structuredClone(authored), { removedEntityIds: ['pnj-1'], flags: {} }, new Set());
    expect(out.seatAssignments).toEqual({});
  });

  it('un héros HORS du groupe fourni perd sa place ; le meneur du groupe garde la sienne', () => {
    const authored = sceneWithAssignments({ [PROP]: { nord: { kind: 'party', heroId: 'hero-1' } } });
    expect(applyMutation(structuredClone(authored), undefined, new Set()).seatAssignments).toEqual({});
    expect(applyMutation(structuredClone(authored), undefined, new Set(['hero-1'])).seatAssignments)
      .toEqual({ [PROP]: { nord: { kind: 'party', heroId: 'hero-1' } } });
  });

  it('un slot que le catalogue n’offre pas est élagué, les autres survivent', () => {
    const authored = sceneWithAssignments({ [PROP]: { nord: NPC, plafond: { kind: 'entity', entityId: 'pnj-2' } } });
    expect(applyMutation(structuredClone(authored), undefined, new Set()).seatAssignments).toEqual({ [PROP]: { nord: NPC } });
  });

  it('SANS groupe fourni, aucun élagage : la superposition reste NUE (comportement d’origine)', () => {
    const authored = sceneWithAssignments({ [PROP]: { nord: NPC, plafond: { kind: 'entity', entityId: 'pnj-2' } } });
    const out = applyMutation(structuredClone(authored), { removedEntityIds: ['pnj-1'], flags: {} });
    expect(out.seatAssignments).toEqual({ [PROP]: { nord: NPC, plafond: { kind: 'entity', entityId: 'pnj-2' } } });
  });
});
