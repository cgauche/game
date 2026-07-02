import { describe, it, expect } from 'vitest';
import { emptyScene } from '../../state/scene';
import type { BattleState } from '../../state/store';
import { Combatant } from '../../engine/types';
import { buildHighlights, type HighlightsView } from './highlights';

function cbt(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number; z?: number }, extra: Partial<Combatant> = {}): Combatant {
  return { id, name: id, kind, pos, size: 'moyenne', conditions: [], wounds: { current: 10, max: 10 }, ...extra } as unknown as Combatant;
}

const VIEW: HighlightsView = {
  myTurn: true,
  walkReach: new Map(),
  runReach: new Map(),
  activeId: null,
  eligibleIds: null,
  crowdIds: null,
  candidates: null,
};

describe('buildHighlights — surbrillances sémantiques (clés historiques stables)', () => {
  const scene = () => emptyScene(6, 6);

  it('grilles de Marche/Course : clés z-aware, la Course exclut les cases déjà en Marche', () => {
    const b = { combatants: [], zones: [] } as unknown as BattleState;
    const els = buildHighlights(scene(), b, {
      ...VIEW,
      walkReach: new Map([['1,1', 1], ['2,1,1', 2]]),
      runReach: new Map([['1,1', 1], ['3,1', 3]]),
    });
    expect(els.map((e) => e.key)).toEqual(['h1,1', 'h2,1,1', 'r3,1']);
    expect(els[1].cell).toEqual({ x: 2, y: 1, z: 1 });
    expect(els[0].h).toBe(0); // au sol : lift 0 (byte-identique mono-niveau)
  });

  it('hors de mon tour (coop) : AUCUNE grille, mais les teintes d’équipe restent', () => {
    const b = { combatants: [cbt('h1', 'hero', { x: 0, y: 0 }), cbt('e1', 'enemy', { x: 3, y: 3 })], zones: [] } as unknown as BattleState;
    const els = buildHighlights(scene(), b, { ...VIEW, myTurn: false, walkReach: new Map([['1,1', 1]]), activeId: 'h1' });
    expect(els.every((e) => e.kind === 'team')).toBe(true);
    expect(els.find((e) => e.key === 'tth1-0-0')).toMatchObject({ kind: 'team', hero: true, active: true });
    expect(els.find((e) => e.key === 'tte1-0-0')).toMatchObject({ kind: 'team', hero: false, active: false });
  });

  it('teintes d’équipe : cavalier exclu (représenté par sa monture), empreinte N×N couverte, monture du cavalier actif « active »', () => {
    const rider = cbt('h1', 'hero', { x: 0, y: 0 }, { mountId: 'm1' });
    const mount = cbt('m1', 'enemy', { x: 0, y: 0 }, { riderId: 'h1', size: 'grande' } as Partial<Combatant>);
    const b = { combatants: [rider, mount], zones: [] } as unknown as BattleState;
    const els = buildHighlights(scene(), b, { ...VIEW, activeId: 'h1' });
    expect(els.find((e) => e.key.startsWith('tth1'))).toBeUndefined(); // pas de pastille 1×1 du cavalier
    const mTiles = els.filter((e) => e.key.startsWith('ttm1'));
    expect(mTiles).toHaveLength(4); // Grande créature → empreinte 2×2
    expect(mTiles[0]).toMatchObject({ kind: 'team', active: true }); // monture du cavalier actif
  });

  it('zones persistantes : fumée vs feu, au sol', () => {
    const b = { combatants: [], zones: [{ label: 'Fumée', blocksLoS: true, tiles: [{ x: 1, y: 1 }] }, { label: 'Feu', tiles: [{ x: 2, y: 2 }] }] } as unknown as BattleState;
    const els = buildHighlights(scene(), b, VIEW);
    expect(els.find((e) => e.key === 'zone-Fumée-1-1')).toMatchObject({ kind: 'zone', smoke: true });
    expect(els.find((e) => e.key === 'zone-Feu-2-2')).toMatchObject({ kind: 'zone', smoke: false });
  });

  it('anneaux : cibles d’attaque (target), tirer-dans-le-tas (crowd), candidats soin/cochés (ally)', () => {
    const b = {
      combatants: [cbt('e1', 'enemy', { x: 1, y: 1 }), cbt('e2', 'enemy', { x: 2, y: 2 }), cbt('a1', 'hero', { x: 3, y: 3 })],
      zones: [],
    } as unknown as BattleState;
    const els = buildHighlights(scene(), b, {
      ...VIEW,
      eligibleIds: new Set(['e1']),
      crowdIds: new Set(['e2']),
      candidates: { ids: ['a1', 'e2'], friendly: false, checkedIds: new Set(['a1']) },
    });
    expect(els.find((e) => e.key === 'tgt-e1')).toMatchObject({ kind: 'ring', tone: 'target' });
    expect(els.find((e) => e.key === 'crowd-e2')).toMatchObject({ kind: 'ring', tone: 'crowd' });
    expect(els.find((e) => e.key === 'cand-a1')).toMatchObject({ kind: 'ring', tone: 'ally' }); // déjà coché → vert
    expect(els.find((e) => e.key === 'cand-e2')).toMatchObject({ kind: 'ring', tone: 'target' });
  });
});
