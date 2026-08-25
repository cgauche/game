/**
 * INTERACTION D'ASSISE — le meneur s'assoit et se relève par le MÊME `interactEntity` (aucune route
 * `sit`/`seat`, aucun second pending). Ce que ces tests tiennent : la BASCULE, la condition d'abord
 * EXACT, l'unicité de l'occupant sur la dernière place, et les libérations de la marche.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { emptyScene, type Scene } from './scene';
import { seatPoseOf, seatSlotsOf, type SeatOccupant } from './seating';
import type { Combatant } from '../engine/types';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
/** Table en (5,5) au cap N : abords déclarés nord (5,4), est (6,5), sud (5,6), ouest (4,5). */
const ABORD_NORD = { x: 5, y: 4 };
const MENEUR: SeatOccupant = { kind: 'party', heroId: 'h' };

const hero = (id = 'h'): Combatant =>
  ({ id, label: id.toUpperCase(), kind: 'hero', xp: 0, wounds: { current: 12, max: 12 }, conditions: [], movement: 4 }) as unknown as Combatant;

function scèneDeTaverne(): Scene {
  const s = emptyScene(12, 12);
  s.id = 'taverne';
  s.entities = [
    { id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } },
    { id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, ref: TABLE, facing: 'N' },
    { id: 'pnj-1', kind: 'personnage', pos: { x: 6, y: 5 } },
  ];
  return s;
}

/** Pose la scène, le groupe, et place le meneur sur `pos`. */
function poser(pos: { x: number; y: number }, seatAssignments?: Scene['seatAssignments']) {
  useGame.setState({ party: [hero()], scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null, pendingInteract: null });
  const sc = scèneDeTaverne();
  if (seatAssignments) sc.seatAssignments = seatAssignments;
  useGame.getState().startScene(sc);
  useGame.setState({ partyPos: { ...pos } });
}

const poseDuMeneur = () => seatPoseOf(useGame.getState().scene!, MENEUR);
const dernierJournal = () => { const j = useGame.getState().journal; return j[j.length - 1] ?? ''; };
const occupants = (sc: Scene) => Object.values(sc.seatAssignments ?? {}).flatMap((m) => Object.values(m));

describe('interactEntity sur un meuble à places — bascule s’asseoir / se relever', () => {
  beforeEach(() => poser(ABORD_NORD));

  it('assoit puis relève party[0] par le même interactEntity', () => {
    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()).toMatchObject({ propId: PROP, slotId: 'nord' });
    expect(dernierJournal()).toContain('Vous prenez place');

    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()).toBeNull();
    expect(dernierJournal()).toContain('Vous vous levez');
  });

  it('la place prise porte l’ANCRE et le CAP de la place, pas la case du groupe', () => {
    useGame.getState().interactEntity(PROP);
    const pose = poseDuMeneur()!;
    expect(pose.facing).toBe('S');                       // assis au nord de la table, on regarde le sud
    expect(pose.anchor.x).toBeCloseTo(5, 5);
    expect(pose.anchor.y).toBeCloseTo(4.57, 5);
    expect(pose.approach).toMatchObject(ABORD_NORD);     // la position LOGIQUE reste l'abord
    expect(useGame.getState().partyPos).toMatchObject(ABORD_NORD);
  });

  it('refuse la transaction si le groupe n’est pas exactement sur l’approche du slot', () => {
    poser({ x: ABORD_NORD.x + 1, y: ABORD_NORD.y });
    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()).toBeNull();
    expect(dernierJournal()).toContain('Vous devez rejoindre la place');
  });

  it('toutes les places prises → refus explicite, aucune écriture', () => {
    const pris = (id: string): SeatOccupant => ({ kind: 'entity', entityId: id });
    poser(ABORD_NORD, { [PROP]: { nord: pris('pnj-1'), est: pris('pnj-2'), sud: pris('pnj-3'), ouest: pris('pnj-4') } });
    const avant = useGame.getState().scene!;
    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()).toBeNull();
    expect(dernierJournal()).toContain('Toutes les places sont occupées');
    expect(useGame.getState().scene).toBe(avant); // aucune écriture de scène
  });

  it('un seul gagnant sur la DERNIÈRE place : celle que tient déjà un corps ne se redonne pas', () => {
    // « nord » (le seul abord sous les pieds du groupe) est déjà tenu par un PNJ.
    poser(ABORD_NORD, { [PROP]: { nord: { kind: 'entity', entityId: 'pnj-1' } } });
    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()).toBeNull();
    const sc = useGame.getState().scene!;
    expect(occupants(sc)).toHaveLength(1);
    expect(occupants(sc)[0]).toMatchObject({ kind: 'entity', entityId: 'pnj-1' });
  });

  it('un meuble SANS place suit le chemin d’interaction historique (aucune branche d’assise)', () => {
    useGame.setState({ party: [hero()], scene: null, mode: 'exploration', journal: [] });
    const sc = emptyScene(12, 12);
    sc.id = 'sans-places';
    sc.entities = [{ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } }, { id: 'caisse', kind: 'prop', pos: { x: 5, y: 5 }, ref: 'comptoir-droit' }];
    useGame.getState().startScene(sc);
    useGame.setState({ partyPos: { x: 5, y: 4 } });
    useGame.getState().interactEntity('caisse');
    expect(useGame.getState().scene!.seatAssignments).toBeUndefined();
    expect(dernierJournal()).not.toContain('Vous prenez place');
  });
});

describe('marcher, c’est se lever — et le déplacement-puis-assise arrive sur l’ABORD', () => {
  it('moveParty libère la place du meneur AVANT de le déplacer', () => {
    poser(ABORD_NORD);
    useGame.getState().interactEntity(PROP);
    expect(poseDuMeneur()).not.toBeNull();
    useGame.getState().moveParty({ x: 5, y: 3 });
    expect(poseDuMeneur()).toBeNull();
    expect(useGame.getState().partyPos).toMatchObject({ x: 5, y: 3 });
  });

  it('une scène SANS assise ne produit aucun delta de scène au déplacement', () => {
    poser({ x: 0, y: 0 });
    const avant = useGame.getState().scene!;
    useGame.getState().moveParty({ x: 1, y: 0 });
    expect(useGame.getState().scene).toBe(avant);
  });

  it('pendingInteract armé sur un meuble à places se consomme À L’ARRIVÉE sur l’abord', () => {
    poser({ x: 5, y: 2 });
    useGame.getState().setPendingInteract(PROP);
    useGame.getState().moveParty({ x: 5, y: 3 }); // hors de tout abord : rien ne se déclenche
    expect(useGame.getState().pendingInteract).toBe(PROP);
    expect(poseDuMeneur()).toBeNull();

    useGame.getState().moveParty(ABORD_NORD); // sur l'abord → assise automatique
    expect(useGame.getState().pendingInteract).toBeNull();
    expect(poseDuMeneur()).toMatchObject({ slotId: 'nord' });
  });

  it('les 4 abords de la table mènent chacun à LEUR place', () => {
    for (const attendu of seatSlotsOf(scèneDeTaverne(), PROP)) {
      poser(attendu.approach);
      useGame.getState().interactEntity(PROP);
      expect(poseDuMeneur(), `abord de « ${attendu.slotId} »`).toMatchObject({ slotId: attendu.slotId });
    }
  });
});
