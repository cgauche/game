// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from '../state/store';
import { SaveLoadModal } from './SaveLoadModal';
import { ManannPriestModal } from './ManannPriestModal';
import { ShoreLeaveModal } from './ShoreLeaveModal';
import { RenounceModal } from './RenounceModal';
import type { Combatant } from '../engine/types';

/**
 * `.roll-modal` porte la GÉOMÉTRIE DE JET (voile allégé + ancrage par le bord haut, `combat-modals.css`) :
 * elle existe pour qu'on VOIE le champ de bataille sous la fenêtre pendant qu'un jet se résout. Une
 * fenêtre qui ne résout aucun jet — sauvegarde, décision d'escale/d'accostage, « Je te renie ! » après
 * un Test déjà résolu — n'a rien à montrer dessous : elle prend la coquille nue (`variant="plain"`).
 * Le contrat se mesure sur le RENDU (la classe posée), jamais sur la prop passée.
 *
 * Rendu DOM et non SSR : ces fenêtres sont CONNECTÉES au store, et `renderToStaticMarkup` sert
 * l'instantané serveur (chaîne vide) — le contrat n'y mesurerait aucune boîte.
 */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

const HERO = {
  id: 'H', name: 'H', label: 'Héros', kind: 'hero',
  characteristics: { endurance: 40 }, wounds: { current: 8, max: 12 }, advantage: 0,
  conditions: [], traumas: [], resilience: 2, fortune: 0, weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
} as unknown as Combatant;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  useGame.setState({
    party: [HERO],
    battle: null,
    pendingManannPriest: { cost: { co: 1, sc: 0, pa: 0 }, vesselId: 'V' } as never,
    pendingShoreLeave: { to: { id: 'p', label: 'Marienburg' } } as never,
    pendingRenounce: { heroId: 'H', testRoll: 71, testTarget: 40 } as never,
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete (globalThis as { localStorage?: Storage }).localStorage;
  useGame.setState({ pendingManannPriest: null, pendingShoreLeave: null, pendingRenounce: null });
});

const NON_JET: [string, () => JSX.Element][] = [
  ['SaveLoadModal', () => <SaveLoadModal mode="save" onClose={() => {}} />],
  ['ManannPriestModal', () => <ManannPriestModal />],
  ['ShoreLeaveModal', () => <ShoreLeaveModal />],
  ['RenounceModal', () => <RenounceModal />],
];

describe('géométrie de jet : réservée aux fenêtres QUI RÉSOLVENT un jet', () => {
  for (const [name, node] of NON_JET) {
    it(`${name} rend sa boîte SANS la classe de fenêtre de jet`, () => {
      act(() => root.render(node()));
      const box = host.querySelector('[role="dialog"]');
      // Sans cette borne, une fenêtre rendue `null` (pending absent) passerait le contrat pour rien.
      expect(box, `${name} n'a rendu aucune boîte : le contrat ci-dessous ne mesurerait rien.`).not.toBeNull();
      expect([...box!.classList]).not.toContain('roll-modal');
    });
  }
});
