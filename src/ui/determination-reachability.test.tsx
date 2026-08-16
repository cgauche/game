// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, type BattleState } from '../state/store';
import { ActionBar } from './ActionBar';
import type { Combatant } from '../engine/types';

const BASE_CHARS = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const heros = (over: Partial<Combatant>) =>
  ({
    id: 'grimm', name: 'Grimm', label: 'Grimm', kind: 'hero', wounds: { current: 8, max: 12 },
    conditions: [], advantage: 0, weapons: [], skills: [], items: [], movement: 4, talents: [], traumas: [],
    engagedWith: [], size: 'moyenne', species: 'humains-reiklander', bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, career: 'agitateur',
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    characteristics: { ...BASE_CHARS },
    ...over,
  }) as unknown as Combatant;

/** Barre d'action MONTÉE sur le store RÉEL (patron `createRoot`/`act` de `ActiveFrame.test.tsx`). */
let host: HTMLDivElement;
let root: Root;

function monter(hero: Combatant) {
  useGame.setState({
    battle: {
      combatants: [hero], order: [hero.id], baseOrder: [hero.id], turn: 0, round: 1, action: null,
      selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false,
      log: [], over: null, preview: null,
    } as unknown as BattleState,
    // `scene` est requise : `battleSelectAction` sort tout de suite sans elle (combatSlice.ts:2803).
    scene: { id: 'test', name: 'Test', entities: [], tiles: [] } as never,
    mode: 'battle', party: [hero], pendingRoundStart: null, pendingAttack: null, pendingCast: null,
    pendingCleave: null, pendingDualStrike: null, pendingSiegeAim: null, hoverDelta: null,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
  act(() => { root.render(<ActionBar />); });
}

const slotResolve = () => host.querySelector<HTMLButtonElement>('button.ab-slot[data-slot="resolve"]');

/** Ouvre le panneau de Détermination en cliquant le slot. */
function ouvrirPanneau() {
  const slot = slotResolve();
  expect(slot, 'aucun slot « Détermination » dans la barre').toBeTruthy();
  act(() => { slot!.click(); });
}

const libelles = () => [...host.querySelectorAll('.ab-spells .ab-spell-row button')].map((b) => b.textContent ?? '');

describe('Détermination — les trois usages sont ATTEIGNABLES depuis la barre (LDB 17 l.59-61)', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useGame.setState({ battle: null, party: [], mode: 'menu' } as never);
  });

  it('héros SANS État mais Détermination > 0 : le slot est présent et mène à l\'immunité Psychologie', () => {
    monter(heros({ resolve: 2, conditions: [], traumas: [] }));
    expect(slotResolve()?.textContent).toContain('Détermination (2)');
    ouvrirPanneau();
    expect(libelles().some((t) => t.includes('Immunité Psychologie'))).toBe(true);
  });

  it('héros SANS État, avec une Blessure critique : « Ignorer modifs de critique » est atteignable', () => {
    monter(heros({ resolve: 1, conditions: [], traumas: [{ label: 'Fracture', ops: [] }] as never }));
    ouvrirPanneau();
    const t = libelles();
    expect(t.some((x) => x.includes('Immunité Psychologie'))).toBe(true);
    expect(t.some((x) => x.includes('Ignorer modifs de critique'))).toBe(true);
  });

  it('héros AVEC État : la liste des États retirables reste rendue (usage 3)', () => {
    monter(heros({ resolve: 1, conditions: [{ id: 'aveugle', value: 1 }] as never }));
    ouvrirPanneau();
    expect(libelles().some((x) => x.includes('Retirer aveugle'))).toBe(true);
  });

  it('Détermination à 0 : aucun slot (rien à dépenser)', () => {
    monter(heros({ resolve: 0, conditions: [] }));
    expect(slotResolve()).toBeNull();
  });
});
