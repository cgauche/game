/**
 * CYCLE DE VIE DE L'ASSISE DU GROUPE — un héros du groupe (`kind:'party'`) ne reste jamais assis là
 * où son corps n'est plus : changement de meneur, retrait du groupe, transition de scène, ouverture
 * de combat. Le pendant `kind:'entity'` (PNJ authoré) vit dans `combat-entity-reconcile.test.ts` ; le
 * volet persistance (save/reload, élagage au chargement) dans `seating-persistence`/`sceneInstance`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { emptyScene, type Scene, type SceneEntity } from './scene';
import { seatPoseOf, type SeatOccupant } from './seating';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
const ABORD_NORD = { x: 5, y: 4 };

const hero = (id: string): Combatant =>
  ({ id, label: id.toUpperCase(), kind: 'hero', xp: 0, wounds: { current: 12, max: 12 }, conditions: [], movement: 4 }) as unknown as Combatant;

const place = (heroId: string): SeatOccupant => ({ kind: 'party', heroId });
const poseDe = (heroId: string) => seatPoseOf(useGame.getState().scene!, place(heroId));

function scèneDeTaverne(id: string): Scene {
  const s = emptyScene(12, 12);
  s.id = id;
  s.entities.push({ id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, ref: TABLE, facing: 'N' });
  return s;
}

/** Assoit `party[0]` à la place « nord » par le geste RÉEL (`interactEntity`), jamais à la main. */
function meneurAssis(party: Combatant[], sceneId = 'taverne'): void {
  useGame.setState({ party, scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null });
  useGame.getState().startScene(scèneDeTaverne(sceneId));
  useGame.setState({ partyPos: { ...ABORD_NORD } });
  useGame.getState().interactEntity(PROP);
}

describe('composition du groupe — le corps qui sort quitte sa place', () => {
  it('party[0] REMPLACÉ : l’ancien meneur ne garde pas sa chaise', () => {
    meneurAssis([hero('h'), hero('b')]);
    expect(poseDe('h')).not.toBeNull();
    useGame.getState().partyReplaceHero('h', hero('neuf'));
    expect(poseDe('h')).toBeNull();
    expect(poseDe('neuf')).toBeNull(); // le remplaçant n'HÉRITE pas de la place : il entre debout
    expect(useGame.getState().scene!.seatAssignments).toEqual({});
  });

  it('un remplacement À MÊME ID (édition en place) ne fait PAS lever le meneur', () => {
    meneurAssis([hero('h')]);
    useGame.getState().partyReplaceHero('h', { ...hero('h'), label: 'Retouché' } as Combatant);
    expect(poseDe('h')).toMatchObject({ slotId: 'nord' });
  });

  it('héros RETIRÉ du groupe : sa place est rendue', () => {
    meneurAssis([hero('h'), hero('b')]);
    useGame.getState().partyRemoveHero('h');
    expect(poseDe('h')).toBeNull();
    expect(useGame.getState().scene!.seatAssignments).toEqual({});
  });

  it('retirer un AUTRE héros ne touche pas la place du meneur, ni la référence de scène', () => {
    meneurAssis([hero('h'), hero('b')]);
    const avant = useGame.getState().scene!;
    useGame.getState().partyRemoveHero('b');
    expect(poseDe('h')).toMatchObject({ slotId: 'nord' });
    expect(useGame.getState().scene).toBe(avant); // aucune écriture inutile
  });
});

describe('transition de scène — une scène quittée ne garde pas un héros absent', () => {
  it('le groupe entier est levé AVANT la capture de mutation : le revisit ne rassoit personne', () => {
    const a = scèneDeTaverne('scene-a');
    const b = emptyScene(8, 8);
    b.id = 'scene-b';
    b.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    useGame.setState({ party: [hero('h')], battle: null, journal: [] });
    useGame.getState().loadProject([a, b], 'scene-a', undefined);
    useGame.setState({ partyPos: { ...ABORD_NORD } });
    useGame.getState().interactEntity(PROP);
    expect(poseDe('h')).not.toBeNull();

    useGame.getState().transitionTo('scene-b');
    expect(useGame.getState().scene!.id).toBe('scene-b');
    // Retour : la scène quittée a été capturée SANS le meneur assis.
    useGame.getState().transitionTo('scene-a');
    expect(poseDe('h')).toBeNull();
    expect(useGame.getState().scene!.seatAssignments).toEqual({});
  });
});

describe('ouverture de combat — le MENEUR assis se lève avec les autres enrôlés', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('sa place est libérée dans l’écriture de pose du combat', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [h], battle: null });
    useGame.getState().startScene(testScene);
    const sc = useGame.getState().scene!;
    // Table au NORD du groupe, cap `N` : son abord SUD est exactement la case du groupe.
    const table = { x: useGame.getState().partyPos.x, y: useGame.getState().partyPos.y - 1 };
    const entities: SceneEntity[] = [...sc.entities, { id: PROP, kind: 'prop', pos: table, ref: TABLE, facing: 'N' }];
    useGame.setState({ scene: { ...sc, entities } });
    useGame.getState().interactEntity(PROP);
    expect(poseDe(h.id)).toMatchObject({ slotId: 'sud' });

    useGame.getState().startCombat('enc-mutants');
    expect(poseDe(h.id)).toBeNull();
  });
});
