/**
 * POSE ASSISE CONSOMMÉE AU RENDU — `Scene.seatAssignments` ne s'arrête pas au builder : la place
 * résolue (`SeatPose`) porte l'ANCRE du quad, le CAP du corps et sa POSE, pour les deux corps qui
 * peuvent s'attabler — le PNJ authoré (voie `collectBillboards`) et le MENEUR du groupe (voie
 * `actorBillboards`). Une donnée exposée sans lecteur serait une affordance morte : chaque assertion
 * ci-dessous compare le corps ASSIS à ce que le MÊME corps rend DEBOUT.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../state/scene';
import { seatPoseOf } from '../../state/seating';
import { buildTokens, partyTokenOf } from '../builders/tokens';
import { actorBillboards, actorPoseKey, collectBillboards, memesBillboardEls, type ActorPose } from '../backends/webgl/sceneMeshes';
import type { TokenEl } from '../builders/types';
import type { Combatant } from '../../engine/types';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';

/** Table en (2,2) cap N ; le PNJ attablé à l'EST, sa `pos` étant son abord (2+1, 2). */
function scèneAttablée(assis: boolean): Scene {
  const s = emptyScene(8, 8);
  s.entities = [
    { id: PROP, kind: 'prop', pos: { x: 2, y: 2 }, ref: TABLE, facing: 'N' },
    { id: 'f1', kind: 'personnage', pos: { x: 3, y: 2 }, facing: 'S', appearance: { species: 'humain' } },
  ] as unknown as SceneEntity[];
  if (assis) s.seatAssignments = { [PROP]: { est: { kind: 'entity', entityId: 'f1' } } };
  return s;
}

const mpt = sceneMetresPerTile(emptyScene(8, 8));
const toutVisible = (s: Scene) => {
  const v = new Set<string>();
  for (let y = 0; y < s.dimensions.h; y++) for (let x = 0; x < s.dimensions.w; x++) v.add(`${x},${y},0`);
  return v;
};
const élémentsDe = (s: Scene) => ({ tokens: buildTokens(s, toutVisible(s), null, { activeZ: 0, viewZ: null, top: false }), props: [] as never[] });
const sujetFigurant = (s: Scene) => collectBillboards(s, mpt, élémentsDe(s)).find((b) => b.identity.startsWith('perso:f1'))!;

const meneur = (): Combatant =>
  ({
    id: 'h', label: 'Meneur', kind: 'hero', pos: { x: 3, y: 2 }, size: 'moyenne', wounds: { current: 12, max: 12 },
    weapons: [], characteristics: {}, advantage: 0, conditions: [], armour: {}, skills: [], talents: [], movement: 4,
    career: 'soldat', species: 'Humain',
  }) as unknown as Combatant;

describe('PNJ authoré attablé — le billboard de figurant consomme sa place', () => {
  it('ancre, cap et corps viennent de la PLACE, pas de la case du PNJ', () => {
    const assis = sujetFigurant(scèneAttablée(true));
    const debout = sujetFigurant(scèneAttablée(false));
    const place = seatPoseOf(scèneAttablée(true), { kind: 'entity', entityId: 'f1' })!;

    // ANCRE : le point posé est celui de la place (fraction de case × mètres/case, hauteur d'assise).
    expect(assis.anchor.x).toBeCloseTo(place.anchor.x * mpt, 6);
    expect(assis.anchor.z).toBeCloseTo(place.anchor.y * mpt, 6);
    expect(assis.anchor.y).toBeCloseTo(place.anchor.h, 6);
    expect(assis.anchor.x).not.toBeCloseTo(debout.anchor.x, 6); // …et pas celui de sa case

    // CAP : celui du corps assis (place « est » d'une recette face au N → regard à l'ouest).
    expect(assis.facing).toBe('O');
    expect(debout.facing).toBe('S'); // témoin : debout, c'est le `facing` authoré de l'entité

    // CORPS : le fragment DIFFÈRE — sans consommation de la place, ce seraient deux fois le même.
    expect(assis.svg('front', false, 0)).not.toBe(debout.svg('front', false, 0));

    // CASE : inchangée — c'est elle qui porte la teinte de visibilité et le tri.
    expect(assis.cell).toEqual(debout.cell);
  });

  it('la place entre dans l’IDENTITÉ de cache et dans l’égalité des lots', () => {
    const assise = scèneAttablée(true);
    const debout = scèneAttablée(false);
    expect(sujetFigurant(assise).identity).not.toBe(sujetFigurant(debout).identity);
    expect(memesBillboardEls(élémentsDe(assise), élémentsDe(debout))).toBe(false);
    // TÉMOIN : deux dérivations de la MÊME scène restent égales (le lot neuf ne remonte rien).
    expect(memesBillboardEls(élémentsDe(assise), élémentsDe(assise))).toBe(true);
  });
});

describe('MENEUR attablé — l’acteur du monde volumique consomme la même place', () => {
  const place = () => seatPoseOf(scèneAttablée(true), { kind: 'entity', entityId: 'f1' })!;
  const poseDebout = (): ActorPose => ({ c: meneur(), x: 3, y: 2, z: 0, facing: 'S' });
  const poseAssise = (): ActorPose => ({ ...poseDebout(), seat: place() });

  it('ancre, cap et corps viennent de la place ; la case logique ne bouge pas', () => {
    const scene = scèneAttablée(true);
    const assis = actorBillboards([poseAssise()], scene, mpt)[0];
    const debout = actorBillboards([poseDebout()], scene, mpt)[0];

    expect(assis.anchor.x).toBeCloseTo(place().anchor.x * mpt, 6);
    expect(assis.anchor.z).toBeCloseTo(place().anchor.y * mpt, 6);
    expect(assis.anchor.y).toBeCloseTo(place().anchor.h, 6);
    expect(assis.facing).toBe('O');
    expect(debout.facing).toBe('S');
    expect(assis.svg('front', false, 0)).not.toBe(debout.svg('front', false, 0));
    expect(assis.cell).toEqual(debout.cell); // brouillard et tri restent sur la case d'abord
    expect(assis.identity).not.toBe(debout.identity);
  });

  it('s’asseoir REFORGE l’acteur : la clé de mémo change', () => {
    expect(actorPoseKey(poseAssise())).not.toBe(actorPoseKey(poseDebout()));
  });

  it('aucun `mountId` : une chaise n’est pas une monture', () => {
    const assis = actorBillboards([poseAssise()], scèneAttablée(true), mpt)[0];
    expect(assis).not.toHaveProperty('mountId');
    expect(JSON.stringify(Object.keys(assis))).not.toContain('mount');
  });
});

describe('partyTokenOf — la dérivation UNIQUE du jeton de groupe', () => {
  it('meneur assis : la position de RENDU devient l’ancre, la place voyage avec lui', () => {
    const scene = scèneAttablée(false);
    scene.seatAssignments = { [PROP]: { est: { kind: 'party', heroId: 'h' } } };
    const jeton = partyTokenOf(scene, meneur(), { x: 3, y: 2 })!;
    const place = seatPoseOf(scene, { kind: 'party', heroId: 'h' })!;
    expect(jeton.seat).toEqual(place);
    expect(jeton.pos.x).toBeCloseTo(place.anchor.x, 6);
    expect(jeton.pos.y).toBeCloseTo(place.anchor.y, 6);
    expect(jeton.pos).not.toEqual({ x: 3, y: 2 });
  });

  it('meneur debout : la case logique telle quelle, aucune place', () => {
    const jeton = partyTokenOf(scèneAttablée(false), meneur(), { x: 3, y: 2 })!;
    expect(jeton.pos).toEqual({ x: 3, y: 2 });
    expect(jeton.seat).toBeUndefined();
  });

  it('aucun meneur → aucun jeton', () => {
    expect(partyTokenOf(scèneAttablée(false), undefined, { x: 3, y: 2 })).toBeNull();
  });
});

/** Le token du builder porte bien la place — la SOURCE que les deux voies de rendu consomment. */
describe('buildTokens → rendu : la chaîne complète', () => {
  it('le sujet `figurant` d’un attablé expose sa place, et le billboard la lit', () => {
    const els = buildTokens(scèneAttablée(true), toutVisible(scèneAttablée(true)), null, { activeZ: 0, viewZ: null, top: false });
    const tk = els.find((e) => e.id === 'f1') as TokenEl;
    expect(tk.subject).toMatchObject({ kind: 'figurant', seat: { propId: PROP, slotId: 'est' } });
  });
});
