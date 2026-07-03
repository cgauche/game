import { describe, it, expect } from 'vitest';
import { postesToStations } from './stations';
import { posteAnchor, applyShipPostes } from './shipPostes';
import { itemFromTrappingById } from '../engine/items';
import type { Combatant, ShipPoste, ShipDeck } from '../engine/types';
import type { FireArc } from './fireArc';

/**
 * INDEX de Stations (postes d'artillerie) + résolveur d'ancre spatiale — PURS, sans store.
 * Coque = un Combattant portant `postes` (emplacement de siège au sol ou navire) ; une Station par poste.
 */

const CHARS = { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };

const mkCrew = (id: string): Combatant =>
  ({ id, name: id, kind: 'npc', characteristics: CHARS, conditions: [], skills: [], talents: [], weapons: [],
    wounds: { current: 12, max: 12 } }) as unknown as Combatant;

const mkPoste = (engineId: string, crewIds: string[], side?: FireArc): ShipPoste =>
  ({ item: itemFromTrappingById(engineId)!, crewIds, ...(side ? { side } : {}) });

const mkHull = (id: string, kind: Combatant['kind'], postes: ShipPoste[], pos = { x: 5, y: 7 }, footprint?: number): Combatant =>
  ({ id, name: id, kind, pos, conditions: [], skills: [], talents: [], weapons: [], postes,
    ...(footprint ? { footprint } : {}), wounds: { current: 0, max: 0 } }) as unknown as Combatant;

describe('postesToStations — une Station par poste, ids/assignedIds/side/ref', () => {
  it('coque à 2 postes → 2 Stations avec id `poste:<hull>:<uid>` et le bon détail', () => {
    const p1 = mkPoste('baliste', ['gunner', 's1'], 'tribord');
    const p2 = mkPoste('pierrier', ['g2'], 'babord');
    const hull = mkHull('emplacement', 'enemy', [p1, p2]);
    const stations = postesToStations([hull, mkCrew('gunner'), mkCrew('s1'), mkCrew('g2')]);

    expect(stations).toHaveLength(2);
    const s1 = stations[0], s2 = stations[1];
    expect(s1.id).toBe(`poste:emplacement:${p1.item.uid}`);
    expect(s2.id).toBe(`poste:emplacement:${p2.item.uid}`);
    expect(s1.assignedIds).toEqual(['gunner', 's1']);
    expect(s1.side).toBe('tribord');
    expect(s2.side).toBe('babord');
    expect(s1.ref).toEqual({ kind: 'poste', hullId: 'emplacement', posteUid: p1.item.uid });
    expect(s1.label).toBe(p1.item.name);
    expect(s1.icon).toBe('action/serve-engine');
    expect(s1.kind).toBe('poste');
  });

  it('faction dérivée du kind de la coque : hero→ally, enemy→enemy, npc→neutral', () => {
    const mk = (kind: Combatant['kind']) => postesToStations([mkHull('h', kind, [mkPoste('baliste', ['c'])])])[0];
    expect(mk('hero').faction).toBe('ally');
    expect(mk('enemy').faction).toBe('enemy');
    expect(mk('npc').faction).toBe('neutral');
  });

  it('un Combattant SANS postes ne produit aucune Station', () => {
    expect(postesToStations([mkCrew('lone')])).toHaveLength(0);
  });

  it('`manned` true quand le chef sert le poste, false quand l’équipage est vide', () => {
    const poste = mkPoste('baliste', ['gunner', 's1']);
    const hull = mkHull('emplacement', 'enemy', [poste]);
    const gunner = mkCrew('gunner');
    const all = [hull, gunner, mkCrew('s1')];
    applyShipPostes(all); // pose mannedPoste sur le chef (crewIds[0])
    expect(postesToStations(all)[0].manned).toBe(true);

    const empty = mkHull('emp2', 'enemy', [mkPoste('baliste', [])]);
    expect(postesToStations([empty])[0].manned).toBe(false);
  });

  it('ancre par défaut = pos de la coque ; l’injecteur `anchorOf` (posteAnchor) fait foi', () => {
    const poste = mkPoste('baliste', ['g'], 'tribord');
    const hull = mkHull('h', 'enemy', [poste], { x: 3, y: 4 });
    expect(postesToStations([hull])[0].pos).toMatchObject({ x: 3, y: 4 }); // défaut = hull.pos

    poste.anchor = { x: 20, y: 21 }; // ancre authorée → posteAnchor la retourne
    const st = postesToStations([hull], (h, p) => posteAnchor(h, p, { heading: 'N' }))[0];
    expect(st.pos).toEqual({ x: 20, y: 21 });
  });

  it('poste dont l’ancre résout undefined → ignoré', () => {
    const hull = mkHull('h', 'enemy', [mkPoste('baliste', ['g'])], undefined as never);
    delete (hull as { pos?: unknown }).pos; // coque sans position
    expect(postesToStations([hull], (h, p) => posteAnchor(h, p))).toHaveLength(0);
  });
});

describe('posteAnchor — ordre de résolution', () => {
  const hull = (pos: { x: number; y: number; z?: number } | undefined, footprint?: number): Combatant =>
    ({ id: 'h', name: 'h', kind: 'enemy', pos, ...(footprint ? { footprint } : {}) }) as unknown as Combatant;

  it('`poste.anchor` authoré fait foi (par-dessus deck-slot / empreinte)', () => {
    const poste: ShipPoste = { item: itemFromTrappingById('baliste')!, side: 'tribord', anchor: { x: 9, y: 9, z: 1 } };
    const deck: ShipDeck = { ascii: [], postes: [{ pos: { x: 1, y: 1 }, side: 'tribord' }] };
    expect(posteAnchor(hull({ x: 5, y: 5 }, 3), poste, { heading: 'N', deck })).toEqual({ x: 9, y: 9, z: 1 });
  });

  it('deck-slot du même bord utilisé HORS échelle mer seulement', () => {
    const poste: ShipPoste = { item: itemFromTrappingById('baliste')!, side: 'tribord' };
    const deck: ShipDeck = { ascii: [], postes: [{ pos: { x: 2, y: 3 }, side: 'tribord' }, { pos: { x: 8, y: 3 }, side: 'babord' }] };
    // hors mer : le slot du bord tribord fait foi
    expect(posteAnchor(hull({ x: 5, y: 5 }), poste, { deck })).toEqual({ x: 2, y: 3 });
    // échelle mer : coords de pont invalides → repli sur la coque
    expect(posteAnchor(hull({ x: 5, y: 5 }), poste, { deck, sea: true })).toMatchObject({ x: 5, y: 5 });
  });

  it('empreinte>1 + arc + cap → décalage HORS-CENTRE, deux bords donnent deux cases distinctes', () => {
    const item = itemFromTrappingById('baliste')!;
    const tribord: ShipPoste = { item, side: 'tribord' };
    const babord: ShipPoste = { item, side: 'babord' };
    const h = hull({ x: 10, y: 10 }, 3); // step = floor(3/2) = 1
    const at = posteAnchor(h, tribord, { heading: 'N' })!; // tribord d’un cap N = Est → +x
    const ab = posteAnchor(h, babord, { heading: 'N' })!; // babord d’un cap N = Ouest → −x
    expect(at).toMatchObject({ x: 11, y: 10 });
    expect(ab).toMatchObject({ x: 9, y: 10 });
    expect(at.x).not.toBe(ab.x); // deux bords → deux cases
  });

  it('sans empreinte/side/cap → pos de coque telle quelle ; sans pos → undefined', () => {
    const poste: ShipPoste = { item: itemFromTrappingById('baliste')! };
    expect(posteAnchor(hull({ x: 4, y: 6 }), poste)).toMatchObject({ x: 4, y: 6 });
    expect(posteAnchor(hull(undefined), poste)).toBeUndefined();
  });
});
