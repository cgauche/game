import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, type Scene, type SceneEntity, type WallSeg } from './scene';
import { DIR8_ORDER, type Dir8 } from './dir8';
import { assignSeat, pruneSeatAssignments, releaseSeat, seatIsOccupiable, seatPoseOf, seatSlotsOf, type SeatOccupant } from './seating';

/** Meuble de référence du catalogue app-owned : 4 places cardinales, ancres à ±0,43 case, assise 0,49 m. */
const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
const POS = { x: 5, y: 5 };

const PARTY: SeatOccupant = { kind: 'party', rang: 1 };
const NPC: SeatOccupant = { kind: 'entity', entityId: 'pnj-1' };
const GROUPE = 1; // un groupe d'UN héros : seul l'emplacement 1 est tenu

/**
 * POSITIONS des PNJ : la `pos` d'un attablé est sa case d'ABORD, jamais la case du meuble
 * RÈGLE : la position LOGIQUE d'un corps assis est sa case d'abord — c'est de là qu'il s'est assis,
 * c'est là qu'il se relève, et c'est elle que lisent brouillard et chemins ; seul le RENDU applique
 * l'ancre fractionnaire. Défauts posés pour le cap `N`, où les abords sont N/E/S/O du meuble.
 */
const ABORDS_CAP_N = { 'pnj-1': { x: 6, y: 5 }, 'pnj-2': { x: 5, y: 6 }, 'pnj-3': { x: 4, y: 5 } } as const;

function seatingScene(opts: { propFacing?: Dir8; blocs?: { x: number; y: number }[]; pnjPos?: Record<string, { x: number; y: number }> } = {}): Scene {
  const s = emptyScene(12, 12);
  const pnj = { ...ABORDS_CAP_N, ...opts.pnjPos };
  const entities: SceneEntity[] = [
    { id: PROP, kind: 'prop', pos: { ...POS }, ref: TABLE, ...(opts.propFacing ? { facing: opts.propFacing } : {}) },
    { id: 'pnj-1', kind: 'personnage', pos: { ...pnj['pnj-1'] } },
    { id: 'pnj-2', kind: 'personnage', pos: { ...pnj['pnj-2'] } },
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
    const first = assignSeat(scene, PROP, 'nord', PARTY, GROUPE);
    expect(first.ok).toBe(true);
    const sameOccupant = assignSeat(first.scene, PROP, 'est', PARTY, GROUPE);
    const sameSlot = assignSeat(first.scene, PROP, 'nord', NPC, GROUPE);
    expect(sameOccupant).toMatchObject({ ok: false, reason: 'occupant-assis' });
    expect(sameSlot).toMatchObject({ ok: false, reason: 'slot-occupe' });
    // Un refus rend la scène d'ENTRÉE, intacte.
    expect(sameOccupant.scene).toBe(first.scene);
    expect(sameSlot.scene).toBe(first.scene);
  });

  it('la place occupée porte son occupant, et la scène d’entrée n’est jamais mutée', () => {
    const scene = seatingScene({ propFacing: 'N' });
    const res = assignSeat(scene, PROP, 'est', NPC, GROUPE);
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
    expect(assignSeat(scene, 'nulle-part', 'nord', NPC, GROUPE)).toMatchObject({ ok: false, reason: 'prop-absent' });
    expect(assignSeat(scene, PROP, 'nulle-part', NPC, GROUPE)).toMatchObject({ ok: false, reason: 'slot-absent' });
    expect(assignSeat(scene, PROP, 'nord', { kind: 'entity', entityId: 'fantome' }, GROUPE)).toMatchObject({ ok: false, reason: 'occupant-absent' });
    expect(assignSeat(scene, PROP, 'nord', { kind: 'party', rang: 9 }, GROUPE)).toMatchObject({ ok: false, reason: 'occupant-absent' });
  });

  it('releaseSeat lève l’occupant et vide le meuble ; debout = scène INCHANGÉE', () => {
    const scene = seatingScene({ propFacing: 'N' });
    const assis = assignSeat(scene, PROP, 'sud', NPC, GROUPE);
    expect(assis.ok).toBe(true);
    const debout = releaseSeat(assis.scene, NPC);
    expect(debout.seatAssignments).toEqual({}); // le meuble vidé perd son objet
    expect(releaseSeat(debout, NPC)).toBe(debout); // no-op : même référence
    expect(releaseSeat(scene, NPC)).toBe(scene);
  });
});

/**
 * SONDE promue de la revue (2026-08-21) : c'est l'ABORD qui individualise une place, jamais la case
 * du siège. Sur la table ronde, les 4 ancres tiennent dans la MÊME case — celle du meuble, SOLIDE —
 * tandis que les 4 abords sont distincts et marchables. Toute règle de document assise sur la case
 * du siège serait donc dégénérée (4 places pour 1 case) ET impossible à tenir (case non marchable).
 */
describe('sonde — la case du SIÈGE est unique et solide, les ABORDS sont quatre et marchables', () => {
  it('4 ancres → 1 case non marchable ; 4 abords → 4 cases marchables distinctes', () => {
    const scene = seatingScene({ propFacing: 'N' });
    const slots = seatSlotsOf(scene, PROP);
    const casesSiege = new Set(slots.map((s) => `${Math.round(s.anchor.x)},${Math.round(s.anchor.y)}`));
    expect(casesSiege).toEqual(new Set([`${POS.x},${POS.y}`]));
    expect(isWalkable(scene, POS.x, POS.y, 0), 'la case du meuble est SOLIDE').toBe(false);
    const abords = slots.map((s) => `${s.approach.x},${s.approach.y}`);
    expect(new Set(abords).size).toBe(4);
    for (const s of slots) expect(isWalkable(scene, s.approach.x, s.approach.y, 0), `abord de « ${s.slotId} »`).toBe(true);
  });
});

describe('approche EFFECTIVE — une chaise contre un comptoir reste occupable', () => {
  // Recoin : les cases d'abord DÉCLARÉES du nord (5,4) et de l'est (6,5) tombent sur des comptoirs
  // solides. La place ne se perd pas pour autant : elle se rejoint par une case voisine marchable —
  // et jamais par l'abord d'une autre place — RÈGLE : toutes les places d'un ensemble restent
  // simultanément occupables.
  const recoin = (pnjPos?: Record<string, { x: number; y: number }>) =>
    seatingScene({ propFacing: 'N', blocs: [{ x: 5, y: 4 }, { x: 6, y: 5 }], pnjPos });

  it('les 4 places restent occupables ; les 2 approches barrées se replient SANS jamais se partager', () => {
    const scene = recoin();
    expect(isWalkable(scene, 5, 4, 0), 'l’abord déclaré du nord DOIT être barré pour que le test morde').toBe(false);
    expect(isWalkable(scene, 6, 5, 0), 'l’abord déclaré de l’est DOIT être barré pour que le test morde').toBe(false);

    const slots = seatSlotsOf(scene, PROP);
    expect(slots).toHaveLength(4);
    for (const s of slots) expect(isWalkable(scene, s.approach.x, s.approach.y, 0), `approche de « ${s.slotId} »`).toBe(true);
    // Passe 1 : les abords déclarés MARCHABLES sont retenus et réservés.
    expect(slots.find((s) => s.slotId === 'sud')!.approach).toMatchObject({ x: 5, y: 6 });
    expect(slots.find((s) => s.slotId === 'ouest')!.approach).toMatchObject({ x: 4, y: 5 });
    // Passe 2 : repli autour du siège dans l'ordre `DIR8_ORDER`, en sautant les cases déjà réservées.
    expect(slots.find((s) => s.slotId === 'nord')!.approach).toMatchObject({ x: 6, y: 4 });  // N barré → NE
    expect(slots.find((s) => s.slotId === 'est')!.approach).toMatchObject({ x: 6, y: 6 });   // NE pris, E barré → SE
    expect(new Set(slots.map((s) => `${s.approach.x},${s.approach.y}`)).size, 'deux places simultanément occupables n’ont jamais le même abord').toBe(4);
  });

  it('les 4 places s’occupent simultanément, chaque PNJ posé SUR son abord', () => {
    const scene = recoin({ 'pnj-1': { x: 6, y: 6 }, 'pnj-2': { x: 5, y: 6 }, 'pnj-3': { x: 4, y: 5 } });
    scene.entities.push({ id: 'pnj-3', kind: 'personnage', pos: { x: 4, y: 5 } });
    const slots = seatSlotsOf(scene, PROP);
    const occupants: SeatOccupant[] = [PARTY, NPC, { kind: 'entity', entityId: 'pnj-2' }, { kind: 'entity', entityId: 'pnj-3' }];
    let courant: Scene = scene;
    slots.forEach((s, i) => {
      const res = assignSeat(courant, PROP, s.slotId, occupants[i], GROUPE);
      expect(res, `place « ${s.slotId} »`).toMatchObject({ ok: true });
      courant = res.scene;
    });
    expect(Object.keys(courant.seatAssignments![PROP])).toHaveLength(4);
    // La `pos` de chaque PNJ assis EST l'abord de sa place — l'invariant que `validateScene` garde.
    for (const s of seatSlotsOf(courant, PROP)) {
      const o = courant.seatAssignments![PROP][s.slotId];
      if (o.kind !== 'entity') continue;
      const pnj = courant.entities.find((e) => e.id === o.entityId)!;
      expect({ x: pnj.pos.x, y: pnj.pos.y }, `« ${o.entityId} » (place « ${s.slotId} »)`).toEqual({ x: s.approach.x, y: s.approach.y });
    }
  });

  it('une place TOTALEMENT emmurée reste le seul refus d’approche', () => {
    const murs = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: POS.x + dx, y: POS.y + dy })))
      .filter((p) => p.x !== POS.x || p.y !== POS.y);
    const scene = seatingScene({ propFacing: 'N', blocs: murs });
    expect(assignSeat(scene, PROP, 'nord', NPC, GROUPE)).toMatchObject({ ok: false, reason: 'approche-invalide' });
  });
});

/**
 * SONDE promue de la revue de la tâche 4 (2026-08-21) : la réservation des abords ne peut pas être
 * locale au MEUBLE. Deux tables voisines, l'abord déclaré du nord de la première barré : son repli
 * tombait sur l'abord DÉCLARÉ du sud de la seconde, et les deux places s'occupaient — deux corps
 * debout sur la même case. RÈGLE : deux places simultanément occupables n'ont jamais le même abord,
 * et la portée en est la SCÈNE, pas le meuble.
 */
describe('abords réservés à l’échelle de la SCÈNE — un repli ne vole pas l’abord d’un meuble voisin', () => {
  /** table-1 en (5,5) et table-2 en (6,3), toutes deux cap N ; comptoir SOLIDE sur l'abord nord de table-1. */
  function deuxTables(): Scene {
    const s = emptyScene(12, 12);
    s.entities = [
      { id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, ref: TABLE, facing: 'N' },
      { id: 'table-2', kind: 'prop', pos: { x: 6, y: 3 }, ref: TABLE, facing: 'N' },
      { id: 'comptoir-0', kind: 'prop', pos: { x: 5, y: 4 }, ref: 'comptoir-droit' },
      { id: 'pnj-1', kind: 'personnage', pos: { x: 6, y: 6 } },
      { id: 'pnj-2', kind: 'personnage', pos: { x: 6, y: 4 } },
    ];
    return s;
  }

  it('le repli du nord de table-1 saute l’abord déclaré du sud de table-2', () => {
    const scene = deuxTables();
    expect(isWalkable(scene, 5, 4, 0), 'l’abord déclaré du nord DOIT être barré pour que le test morde').toBe(false);
    expect(isWalkable(scene, 6, 4, 0), 'la case volée DOIT être marchable pour que le test morde').toBe(true);
    const nord = seatSlotsOf(scene, PROP).find((s) => s.slotId === 'nord')!;
    const sud2 = seatSlotsOf(scene, 'table-2').find((s) => s.slotId === 'sud')!;
    expect(sud2.approach).toMatchObject({ x: 6, y: 4 }); // abord DÉCLARÉ, retenu en passe 1
    expect(nord.approach).not.toMatchObject({ x: 6, y: 4 });
    expect(nord.approach).toMatchObject({ x: 6, y: 6 }); // N barré, NE réservé, E réservé → SE
  });

  it('les abords de TOUTES les places de la scène sont deux à deux distincts', () => {
    const scene = deuxTables();
    const abords = [...seatSlotsOf(scene, PROP), ...seatSlotsOf(scene, 'table-2')]
      .map((s) => `${s.approach.x},${s.approach.y}`);
    expect(new Set(abords).size).toBe(abords.length);
  });

  it('deux corps ne se posent jamais sur la même case d’abord', () => {
    const scene = deuxTables();
    const a = assignSeat(scene, PROP, 'nord', NPC, GROUPE);
    expect(a).toMatchObject({ ok: true });
    const b = assignSeat(a.scene, 'table-2', 'sud', { kind: 'entity', entityId: 'pnj-2' }, GROUPE);
    expect(b).toMatchObject({ ok: true });
    const nord = seatSlotsOf(b.scene, PROP).find((s) => s.slotId === 'nord')!;
    const sud2 = seatSlotsOf(b.scene, 'table-2').find((s) => s.slotId === 'sud')!;
    expect(`${nord.approach.x},${nord.approach.y}`).not.toBe(`${sud2.approach.x},${sud2.approach.y}`);
  });
});

/**
 * DÉFAUT MESURÉ à La Diligence (2026-08-23) : `table-ronde-3/ouest` (10,10) résolvait son abord en
 * (9,10) — marchable, mais DERRIÈRE le mur bâti `(9,10,E)`, dans la cuisine. Aucun héros ne pouvait
 * s'y asseoir alors que le prédicat d'occupabilité l'acceptait. RÈGLE : un abord n'est pas seulement
 * MARCHABLE, il est ATTEIGNABLE depuis la case du siège — même connectivité que le pas du joueur
 * (`walkNeighbors`), donc portes comprises.
 */
describe('abord ATTEIGNABLE — un mur entre le siège et son abord déclaré n’est pas un abord', () => {
  /** Table en (5,5) cap `N` ; l'arête (4,5,E) — entre l'abord déclaré de l’ouest et le siège — porte
   *  un mur, plein ou percé d’une porte. */
  const cloisonnee = (seg: Partial<WallSeg> = {}): Scene => {
    const s = seatingScene({ propFacing: 'N' });
    s.walls = [{ x: 4, y: 5, side: 'E', ...seg }];
    return s;
  };

  it('mur PLEIN : l’abord déclaré marchable est refusé, la place se replie et reste occupable', () => {
    const scene = cloisonnee();
    expect(isWalkable(scene, 4, 5, 0), 'la case derrière le mur DOIT être marchable pour que le test morde').toBe(true);
    const ouest = seatSlotsOf(scene, PROP).find((s) => s.slotId === 'ouest')!;
    expect(ouest.approach).not.toMatchObject({ x: 4, y: 5 });
    expect(ouest.approach).toMatchObject({ x: 6, y: 4 }); // N/E/S déclarés réservés → premier libre : NE
    expect(seatIsOccupiable(scene, ouest)).toBe(true);
    expect(assignSeat(scene, PROP, 'ouest', NPC, GROUPE)).toMatchObject({ ok: true });
    // Les trois autres places gardent leur abord déclaré : un mur ne déplace que la place qu’il coupe.
    expect(seatSlotsOf(scene, PROP).filter((s) => s.slotId !== 'ouest').map((s) => `${s.approach.x},${s.approach.y}`))
      .toEqual(['5,4', '6,5', '5,6']);
  });

  it('même arête, mais PORTE : l’abord déclaré est gardé', () => {
    const scene = cloisonnee({ door: true });
    const ouest = seatSlotsOf(scene, PROP).find((s) => s.slotId === 'ouest')!;
    expect(ouest.approach).toMatchObject({ x: 4, y: 5 });
    expect(assignSeat(scene, PROP, 'ouest', NPC, GROUPE)).toMatchObject({ ok: true });
  });

  it('une place que les MURS cernent est inoccupable, comme celle que les meubles cernent', () => {
    const scene = seatingScene({ propFacing: 'N' });
    // Les quatre arêtes cardinales du siège : les diagonales tombent avec elles (anti coupe-de-coin).
    scene.walls = [
      { x: POS.x, y: POS.y, side: 'N' }, { x: POS.x, y: POS.y + 1, side: 'N' },
      { x: POS.x, y: POS.y, side: 'E' }, { x: POS.x - 1, y: POS.y, side: 'E' },
    ];
    for (const slot of seatSlotsOf(scene, PROP)) expect(seatIsOccupiable(scene, slot), slot.slotId).toBe(false);
    expect(assignSeat(scene, PROP, 'nord', NPC, GROUPE)).toMatchObject({ ok: false, reason: 'approche-invalide' });
  });

  it('l’occupabilité se juge sur l’ATTEIGNABILITÉ, pas sur la seule marchabilité', () => {
    const scene = cloisonnee();
    const barree = { propId: PROP, slotId: 'ouest', anchor: { x: 4.57, y: 5, h: 0.49 }, facing: 'E' as Dir8, approach: { x: 4, y: 5 } };
    expect(isWalkable(scene, barree.approach.x, barree.approach.y, 0)).toBe(true);
    expect(seatIsOccupiable(scene, barree)).toBe(false);
  });
});

describe('pruneSeatAssignments — normalisation déterministe', () => {
  it('jette meuble absent, place absente, corps absent ; garde le PREMIER siège d’un occupant', () => {
    const scene = seatingScene({ propFacing: 'N' });
    scene.seatAssignments = {
      [PROP]: { nord: NPC, sud: NPC, est: { kind: 'party', rang: 1 }, nulle: NPC, ouest: { kind: 'entity', entityId: 'fantome' } },
      'meuble-disparu': { nord: NPC },
    };
    expect(pruneSeatAssignments(scene, GROUPE)).toEqual({ [PROP]: { nord: NPC, est: { kind: 'party', rang: 1 } } });
  });

  it('un héros hors du groupe fourni perd sa place', () => {
    const scene = seatingScene({ propFacing: 'N' });
    scene.seatAssignments = { [PROP]: { nord: PARTY } };
    expect(pruneSeatAssignments(scene, 0)).toEqual({});
    expect(pruneSeatAssignments(scene, GROUPE)).toEqual({ [PROP]: { nord: PARTY } });
  });
});
