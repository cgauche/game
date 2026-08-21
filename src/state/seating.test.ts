import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, type Scene, type SceneEntity } from './scene';
import { DIR8_ORDER, type Dir8 } from './dir8';
import { assignSeat, pruneSeatAssignments, releaseSeat, seatPoseOf, seatSlotsOf, type SeatOccupant } from './seating';

/** Meuble de référence du catalogue app-owned : 4 places cardinales, ancres à ±0,43 case, assise 0,49 m. */
const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
const POS = { x: 5, y: 5 };

const PARTY: SeatOccupant = { kind: 'party', heroId: 'hero-1' };
const NPC: SeatOccupant = { kind: 'entity', entityId: 'pnj-1' };
const HEROS = new Set(['hero-1']);

function seatingScene(opts: { propFacing?: Dir8; blocs?: { x: number; y: number }[] } = {}): Scene {
  const s = emptyScene(12, 12);
  const entities: SceneEntity[] = [
    { id: PROP, kind: 'prop', pos: { ...POS }, ref: TABLE, ...(opts.propFacing ? { facing: opts.propFacing } : {}) },
    { id: 'pnj-1', kind: 'personnage', pos: { ...POS } },
    { id: 'pnj-2', kind: 'personnage', pos: { x: 1, y: 1 } },
  ];
  // Recoin : chaque bloc est un comptoir SOLIDE (`props.json`) posé sur une case d'abord déclarée.
  opts.blocs?.forEach((p, i) => entities.push({ id: `comptoir-${i}`, kind: 'prop', pos: { ...p }, ref: 'comptoir-droit' }));
  s.entities = entities;
  return s;
}

/**
 * Attendu LITTÉRAL par cap (jamais recalculé par la formule sous test) : la recette s'écrit FACE AU
 * NORD (cap d'identité, `data/props.types.ts`), chaque cran la tourne de 45° horaires. Pour la place
 * « nord » (ancre locale (0, −0,43), corps face au `S`, abord local (0, −1)) :
 * l'ancre décrit un cercle de rayon 0,43 et l'abord suit le cap lui-même.
 */
const R = 0.43;
const D = 0.43 * Math.SQRT1_2; // 0,3041 — composante d'une ancre en diagonale
const ATTENDU_NORD: Record<Dir8, { dx: number; dy: number; facing: Dir8; approche: { x: number; y: number } }> = {
  N: { dx: 0, dy: -R, facing: 'S', approche: { x: 5, y: 4 } },
  NE: { dx: D, dy: -D, facing: 'SO', approche: { x: 6, y: 4 } },
  E: { dx: R, dy: 0, facing: 'O', approche: { x: 6, y: 5 } },
  SE: { dx: D, dy: D, facing: 'NO', approche: { x: 6, y: 6 } },
  S: { dx: 0, dy: R, facing: 'N', approche: { x: 5, y: 6 } },
  SO: { dx: -D, dy: D, facing: 'NE', approche: { x: 4, y: 6 } },
  O: { dx: -R, dy: 0, facing: 'E', approche: { x: 4, y: 5 } },
  NO: { dx: -D, dy: -D, facing: 'SE', approche: { x: 4, y: 4 } },
};

describe('seatSlotsOf — transformation des places au cap de l’instance', () => {
  it.each<Dir8>(DIR8_ORDER)('résout slots, cap et approche en %s', (facing) => {
    const scene = seatingScene({ propFacing: facing });
    const slots = seatSlotsOf(scene, PROP);
    // Ordre du CATALOGUE conservé, quel que soit le cap.
    expect(slots.map((s) => s.slotId)).toEqual(['nord', 'est', 'sud', 'ouest']);
    const attendu = ATTENDU_NORD[facing];
    const nord = slots[0];
    expect(nord.propId).toBe(PROP);
    expect(nord.anchor.x).toBeCloseTo(POS.x + attendu.dx, 4);
    expect(nord.anchor.y).toBeCloseTo(POS.y + attendu.dy, 4);
    expect(nord.anchor.h).toBeCloseTo(0.49, 4); // hauteur d'assise, sol de la case à 0 m
    expect(nord.facing).toBe(attendu.facing);
    expect({ x: nord.approach.x, y: nord.approach.y }).toEqual(attendu.approche);
    // Les quatre ancres restent distinctes et à distance d'assise du centre du meuble.
    for (const s of slots) expect(Math.hypot(s.anchor.x - POS.x, s.anchor.y - POS.y)).toBeCloseTo(R, 4);
    expect(new Set(slots.map((s) => `${s.anchor.x.toFixed(3)},${s.anchor.y.toFixed(3)}`)).size).toBe(4);
  });

  it('une instance SANS cap vaut `S` (défaut canonique) — demi-tour par rapport à la recette', () => {
    const nu = seatSlotsOf(seatingScene(), PROP)[0];
    const sud = seatSlotsOf(seatingScene({ propFacing: 'S' }), PROP)[0];
    expect(nu).toEqual(sud);
    expect(nu.facing).toBe('N');
  });

  it('meuble absent, type sans places : aucune place, jamais d’exception', () => {
    expect(seatSlotsOf(seatingScene(), 'inconnu')).toEqual([]);
    const sansPlaces = seatingScene();
    sansPlaces.entities = [{ id: PROP, kind: 'prop', pos: { ...POS }, ref: 'lit' }];
    expect(seatSlotsOf(sansPlaces, PROP)).toEqual([]);
  });
});

describe('assignSeat / releaseSeat — exclusivités et raisons stables', () => {
  it('assigne une seule place par occupant et un seul occupant par slot', () => {
    const scene = seatingScene({ propFacing: 'N' });
    const first = assignSeat(scene, PROP, 'nord', PARTY, HEROS);
    expect(first.ok).toBe(true);
    const sameOccupant = assignSeat(first.scene, PROP, 'est', PARTY, HEROS);
    const sameSlot = assignSeat(first.scene, PROP, 'nord', NPC, HEROS);
    expect(sameOccupant).toMatchObject({ ok: false, reason: 'occupant-assis' });
    expect(sameSlot).toMatchObject({ ok: false, reason: 'slot-occupe' });
    // Un refus rend la scène d'ENTRÉE, intacte.
    expect(sameOccupant.scene).toBe(first.scene);
    expect(sameSlot.scene).toBe(first.scene);
  });

  it('la place occupée porte son occupant, et la scène d’entrée n’est jamais mutée', () => {
    const scene = seatingScene({ propFacing: 'N' });
    const res = assignSeat(scene, PROP, 'est', NPC, HEROS);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.pose).toMatchObject({ propId: PROP, slotId: 'est', occupant: NPC });
    expect(res.scene.seatAssignments).toEqual({ [PROP]: { est: NPC } });
    expect(scene.seatAssignments).toBeUndefined(); // pureté
    expect(seatPoseOf(res.scene, NPC)).toMatchObject({ slotId: 'est' });
    expect(seatPoseOf(res.scene, PARTY)).toBeNull();
  });

  it('chaque refus porte SA raison', () => {
    const scene = seatingScene({ propFacing: 'N' });
    expect(assignSeat(scene, 'nulle-part', 'nord', NPC, HEROS)).toMatchObject({ ok: false, reason: 'prop-absent' });
    expect(assignSeat(scene, PROP, 'nulle-part', NPC, HEROS)).toMatchObject({ ok: false, reason: 'slot-absent' });
    expect(assignSeat(scene, PROP, 'nord', { kind: 'entity', entityId: 'fantome' }, HEROS)).toMatchObject({ ok: false, reason: 'occupant-absent' });
    expect(assignSeat(scene, PROP, 'nord', { kind: 'party', heroId: 'hero-9' }, HEROS)).toMatchObject({ ok: false, reason: 'occupant-absent' });
  });

  it('releaseSeat lève l’occupant et vide le meuble ; debout = scène INCHANGÉE', () => {
    const scene = seatingScene({ propFacing: 'N' });
    const assis = assignSeat(scene, PROP, 'sud', NPC, HEROS);
    expect(assis.ok).toBe(true);
    const debout = releaseSeat(assis.scene, NPC);
    expect(debout.seatAssignments).toEqual({}); // le meuble vidé perd son objet
    expect(releaseSeat(debout, NPC)).toBe(debout); // no-op : même référence
    expect(releaseSeat(scene, NPC)).toBe(scene);
  });
});

describe('approche EFFECTIVE — une chaise contre un comptoir reste occupable', () => {
  // Recoin : les cases d'abord DÉCLARÉES du nord (5,4) et de l'est (6,5) tombent sur des comptoirs
  // solides. La place ne se perd pas pour autant : elle se rejoint par une case voisine marchable.
  const recoin = () => seatingScene({ propFacing: 'N', blocs: [{ x: 5, y: 4 }, { x: 6, y: 5 }] });

  it('les 4 places restent occupables ; les 2 approches barrées se replient sur une case marchable', () => {
    const scene = recoin();
    expect(isWalkable(scene, 5, 4, 0), 'l’abord déclaré du nord DOIT être barré pour que le test morde').toBe(false);
    expect(isWalkable(scene, 6, 5, 0), 'l’abord déclaré de l’est DOIT être barré pour que le test morde').toBe(false);

    const slots = seatSlotsOf(scene, PROP);
    expect(slots).toHaveLength(4);
    for (const s of slots) expect(isWalkable(scene, s.approach.x, s.approach.y, 0), `approche de « ${s.slotId} »`).toBe(true);
    // Balayage déterministe autour de la case du siège, dans l'ordre de `DIR8_ORDER` : N barré → NE.
    expect(slots.find((s) => s.slotId === 'nord')!.approach).toMatchObject({ x: 6, y: 4 });
    expect(slots.find((s) => s.slotId === 'est')!.approach).toMatchObject({ x: 6, y: 4 });
    // Les deux places NON barrées gardent leur abord déclaré.
    expect(slots.find((s) => s.slotId === 'sud')!.approach).toMatchObject({ x: 5, y: 6 });
    expect(slots.find((s) => s.slotId === 'ouest')!.approach).toMatchObject({ x: 4, y: 5 });

    let courant: Scene = scene;
    const occupants: SeatOccupant[] = [PARTY, NPC, { kind: 'entity', entityId: 'pnj-2' }, { kind: 'entity', entityId: 'pnj-3' }];
    courant.entities.push({ id: 'pnj-3', kind: 'personnage', pos: { ...POS } });
    slots.forEach((s, i) => {
      const res = assignSeat(courant, PROP, s.slotId, occupants[i], HEROS);
      expect(res, `place « ${s.slotId} »`).toMatchObject({ ok: true });
      courant = res.scene;
    });
    expect(Object.keys(courant.seatAssignments![PROP])).toHaveLength(4);
  });

  it('une place TOTALEMENT emmurée reste le seul refus d’approche', () => {
    const murs = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: POS.x + dx, y: POS.y + dy })))
      .filter((p) => p.x !== POS.x || p.y !== POS.y);
    const scene = seatingScene({ propFacing: 'N', blocs: murs });
    expect(assignSeat(scene, PROP, 'nord', NPC, HEROS)).toMatchObject({ ok: false, reason: 'approche-invalide' });
  });
});

describe('pruneSeatAssignments — normalisation déterministe', () => {
  it('jette meuble absent, place absente, corps absent ; garde le PREMIER siège d’un occupant', () => {
    const scene = seatingScene({ propFacing: 'N' });
    scene.seatAssignments = {
      [PROP]: { nord: NPC, sud: NPC, est: { kind: 'party', heroId: 'hero-1' }, nulle: NPC, ouest: { kind: 'entity', entityId: 'fantome' } },
      'meuble-disparu': { nord: NPC },
    };
    expect(pruneSeatAssignments(scene, HEROS)).toEqual({ [PROP]: { nord: NPC, est: { kind: 'party', heroId: 'hero-1' } } });
  });

  it('un héros hors du groupe fourni perd sa place', () => {
    const scene = seatingScene({ propFacing: 'N' });
    scene.seatAssignments = { [PROP]: { nord: PARTY } };
    expect(pruneSeatAssignments(scene, new Set())).toEqual({});
    expect(pruneSeatAssignments(scene, HEROS)).toEqual({ [PROP]: { nord: PARTY } });
  });
});
