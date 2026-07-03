/**
 * Curseur de combat unifié (clavier + manette) — logique PURE.
 *  - `nextCursorTile` : voisin de grille dont le centre PROJETÉ colle le mieux à la direction
 *    ÉCRAN poussée (le curseur « suit les yeux ») → en iso une « droite » est un pas diagonal de
 *    grille, en vue du dessus un pas cardinal. Gère rotation caméra + projection sans cas particulier.
 *  - `cursorCommitIntent` : décision de commit, RÉPLIQUE de la branche `battle` de performClick
 *    (IsoStage) → parité souris (ennemi → attaque, case libre → déplacement, allié → inspection).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { nextCursorTile, cursorCommitIntent } from './combatCursor';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';
import type { Dims } from '../gameIso/iso';

/** Arène d'herbe minimale (cursorCommitIntent dérive l'affordance d'attaque → besoin d'une scène). */
const arena = () => {
  const w = 22, h = 16;
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
};

const dims = (over: Partial<Dims> = {}): Dims => ({ w: 22, h: 16, ...over });

/** Scène PLATE (couche unique, hauteur 0 partout) : `screenStepDot` projette au lift métrique réel —
 *  sans relief, le lift vaut 0 → projection identique à l'ancienne (résultats inchangés). */
const flat = () => ({ dimensions: { w: 22, h: 16 }, layers: [{ z: 0, tiles: new Array(22 * 16).fill('herbe') }], entities: [] }) as never;

describe('nextCursorTile — curseur écran-relatif', () => {
  it('curseur null → apparaît sur le combattant actif (pas de pas)', () => {
    expect(nextCursorTile(flat(), null, 'right', dims(), { x: 6, y: 10 })).toEqual({ x: 6, y: 10 });
  });

  it('iso rot0 : « droite » écran = voisin diagonal de grille (x+1, y-1)', () => {
    expect(nextCursorTile(flat(), { tile: { x: 6, y: 10 } }, 'right', dims(), { x: 6, y: 10 })).toEqual({ x: 7, y: 9 });
  });

  it('iso rot0 : « haut » écran = (x-1, y-1)', () => {
    expect(nextCursorTile(flat(), { tile: { x: 6, y: 10 } }, 'up', dims(), { x: 6, y: 10 })).toEqual({ x: 5, y: 9 });
  });

  it('iso rot0 : « gauche » = (x-1, y+1) ; « bas » = (x+1, y+1)', () => {
    expect(nextCursorTile(flat(), { tile: { x: 6, y: 10 } }, 'left', dims(), { x: 6, y: 10 })).toEqual({ x: 5, y: 11 });
    expect(nextCursorTile(flat(), { tile: { x: 6, y: 10 } }, 'down', dims(), { x: 6, y: 10 })).toEqual({ x: 7, y: 11 });
  });

  it('vue du dessus : « droite » = pas cardinal de grille (x+1, y)', () => {
    expect(nextCursorTile(flat(), { tile: { x: 6, y: 10 } }, 'right', dims({ view: 'top' }), { x: 6, y: 10 })).toEqual({ x: 7, y: 10 });
  });

  it('rotation caméra (rot=1) : « droite » reste à droite à l’écran (autre delta de grille)', () => {
    // rot impair → la grille tourne ; le pas écran-droite cible un autre couple (dx,dy). On vérifie
    // seulement qu’il bouge ET reste dans la carte (la projection arbitre, pas un delta codé en dur).
    const r = nextCursorTile(flat(), { tile: { x: 6, y: 10 } }, 'right', dims({ rot: 1 }), { x: 6, y: 10 });
    expect(r).not.toEqual({ x: 6, y: 10 });
    expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x).toBeLessThan(22);
    expect(r.y).toBeGreaterThanOrEqual(0); expect(r.y).toBeLessThan(16);
  });

  it('ne sort jamais de la grille : au coin, reste sur place', () => {
    expect(nextCursorTile(flat(), { tile: { x: 21, y: 0 } }, 'right', dims(), { x: 21, y: 0 })).toEqual({ x: 21, y: 0 });
  });
});

describe('cursorCommitIntent — parité performClick (mode-aware)', () => {
  beforeEach(() => { useGame.setState({ battle: null, party: [], inspectEnabled: false }); }); // ACTION par défaut (Inspection OFF)
  function makeState(over: Record<string, unknown> = {}) {
    const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 10 };
    const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 10 };
    const enemy = spawnEnemy('Bandit de Grand Chemin', undefined, 'e1', { x: 7, y: 10 }); // adjacent au héros
    const battle = {
      combatants: [hero, ally, enemy], order: ['h1', 'h2', 'e1'], baseOrder: ['h1', 'h2', 'e1'],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ battle: battle as never, scene: arena(), party: [hero, ally], inspectEnabled: false, ...over });
    return { hero, ally, enemy };
  }

  it('curseur sur un ennemi → intention { entity }', () => {
    const { enemy } = makeState();
    expect(cursorCommitIntent(useGame.getState, { tile: { x: 7, y: 10 } })).toEqual({ kind: 'entity', id: enemy.id });
  });

  it('curseur sur une case libre → intention { tile }', () => {
    makeState();
    expect(cursorCommitIntent(useGame.getState, { tile: { x: 12, y: 4 } })).toEqual({ kind: 'tile', pt: { x: 12, y: 4 } });
  });

  it('curseur sur un allié, inspection activée → { inspect }', () => {
    const { ally } = makeState({ inspectEnabled: true });
    expect(cursorCommitIntent(useGame.getState, { tile: { x: 5, y: 10 } })).toEqual({ kind: 'inspect', id: ally.id });
  });

  it('MODE INSPECTION (Inspection ON) : curseur sur un ENNEMI → { inspect } (on regarde, on n’attaque pas)', () => {
    const { enemy } = makeState({ inspectEnabled: true });
    expect(cursorCommitIntent(useGame.getState, { tile: { x: 7, y: 10 } })).toEqual({ kind: 'inspect', id: enemy.id });
  });

  it('curseur sur un allié, inspection désactivée → null (no-op, jamais clic-case)', () => {
    makeState({ inspectEnabled: false });
    expect(cursorCommitIntent(useGame.getState, { tile: { x: 5, y: 10 } })).toBeNull();
  });

  it('hors combat → null', () => {
    useGame.setState({ battle: null });
    expect(cursorCommitIntent(useGame.getState, { tile: { x: 1, y: 1 } })).toBeNull();
  });
});
