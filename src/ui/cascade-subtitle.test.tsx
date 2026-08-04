// @vitest-environment jsdom
/**
 * #1078 LOT B2 — SOUS-TITRE d'étape de cascade (zone Z1) : UNE source pour les six branches
 * (`stepSubtitle`), donc un libellé DÉDOUBLONNÉ contre le titre de la fenêtre partout. Quand une
 * séquence s'ouvre sur une étape, elle lui EMPRUNTE son libellé (`pushStep`) : l'afficher aussi en
 * sous-titre empile deux fois la même phrase (double rendu de classe #352). Contrat mesuré à
 * l'ÉCRAN (montage réel, patron `createRoot`/`act` du repo) sur les trois branches qui composaient
 * leur sous-titre à la main : CHOIX, BATCH, JET.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { CascadeBody } from './CascadeModal';
import type { CascadeStep } from '../state/pendings';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;

const HERO = () => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', rng: makeRNG(1) });

/** Ouvre une séquence à UNE étape, le titre de la fenêtre étant fourni par l'appelant. */
function openStep(title: string, step: (heroId: string) => CascadeStep) {
  return openSteps(title, (id) => [step(id)], 0);
}

/** Ouvre une séquence à N étapes, curseur posé — sert à mesurer le COMPTEUR de la branche jet. */
function openSteps(title: string, steps: (heroId: string) => CascadeStep[], cursor: number) {
  const hero = HERO();
  useGame.setState({
    battle: null, party: [hero], suspendedCascades: [], journal: [],
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    pendingCascade: { title, icon: 'nav/dice', purpose: 'affichage', cursor, log: [], participants: steps(hero.id) },
  });
  return hero;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCascade: null, party: [], suspendedCascades: [] });
});

const render = () => act(() => { root.render(<CascadeBody />); });
/** Ce qu'un joueur LIT dans la fenêtre, espaces normalisés. */
const screen = () => (host.textContent ?? '').replace(/\s+/g, ' ');
/** Combien de fois la phrase se lit dans la fenêtre. */
const occurrences = (needle: string) => (screen().match(new RegExp(needle, 'g')) ?? []).length;

const LIBELLE = 'Gueule de bois';

describe('sous-titre d’étape — le libellé ne REDIT pas le titre de la fenêtre', () => {
  it('branche CHOIX : titre = libellé d’étape → la phrase se lit UNE fois', () => {
    openStep(LIBELLE, () => ({
      id: 'c1', kind: 'choix', label: LIBELLE, interactive: true,
      options: [{ key: 'boire', label: 'Boire' }, { key: 'dormir', label: 'Dormir' }],
    } as unknown as CascadeStep));
    render();
    expect(occurrences(LIBELLE)).toBe(1);
  });

  it('branche BATCH : titre = libellé d’étape → la phrase se lit UNE fois', () => {
    openStep(LIBELLE, (id) => ({
      id: 'b1', kind: 'batch', label: LIBELLE, interactive: true,
      participants: [{ id, label: 'Résistance', interactive: true, base: 40, target: 40, result: null }],
    } as unknown as CascadeStep));
    render();
    expect(occurrences(LIBELLE)).toBe(1);
  });

  it('branche JET : titre = libellé d’étape → la phrase se lit UNE fois', () => {
    openStep(LIBELLE, (id) => ({
      id: 'j1', kind: 'tally', actorId: id, label: LIBELLE, rollLabel: 'Résistance',
      base: 40, target: 40, result: null, interactive: true,
    } as unknown as CascadeStep));
    render();
    expect(occurrences(LIBELLE)).toBe(1);
  });

  it('libellé DISTINCT du titre : le sous-titre le porte (il n’est pas avalé)', () => {
    openStep('Nuit à l’auberge', (id) => ({
      id: 'j1', kind: 'tally', actorId: id, label: LIBELLE, rollLabel: 'Résistance',
      base: 40, target: 40, result: null, interactive: true,
    } as unknown as CascadeStep));
    render();
    expect(occurrences(LIBELLE)).toBe(1);
    expect(occurrences('Nuit à l’auberge')).toBe(1);
  });
});

/**
 * COMPTEUR de la branche JET (arbitrage user 2026-07-11) : « jet N/M » compte les JETS DE DÉ RÉELS,
 * pas les étapes — un pas BATCH vaut ses N rangées, un pas d'affichage/agrégation vaut 0. N = les
 * jets déjà passés + celui-ci. (Le rang d'étape « n/m » nu reste celui des autres branches.)
 */
describe('sous-titre de la branche JET — compteur en JETS DE DÉ', () => {
  const jetStep = (id: string, actorId: string): CascadeStep =>
    ({ id, kind: 'tally', actorId, label: `Étape ${id}`, rollLabel: 'Résistance', base: 40, target: 40, result: null, interactive: true } as unknown as CascadeStep);

  it('deux pas-jet : le premier annonce « jet 1/2 », le second « jet 2/2 »', () => {
    openSteps('Nuit à l’auberge', (id) => [jetStep('a', id), jetStep('b', id)], 0);
    render();
    expect(screen()).toContain('jet 1/2');
    act(() => { useGame.setState({ pendingCascade: { ...useGame.getState().pendingCascade!, cursor: 1 } }); });
    expect(screen()).toContain('jet 2/2');
  });

  it('un pas BATCH de 3 rangées compte 3 jets : le pas-jet suivant annonce « jet 4/4 »', () => {
    openSteps('Traversée', (id) => [
      { id: 'batch', kind: 'weatherResistance', label: 'Traversée — Blizzard', interactive: true,
        participants: [1, 2, 3].map((n) => ({ id, label: `Rôle ${n}`, interactive: true, base: 40, target: 40, result: null })) } as unknown as CascadeStep,
      jetStep('j', id),
    ], 1);
    render();
    expect(screen()).toContain('jet 4/4');
  });

  it('séquence à UN seul jet : aucun compteur (rien à situer)', () => {
    openSteps('Nuit à l’auberge', (id) => [jetStep('a', id)], 0);
    render();
    expect(screen()).not.toContain('jet 1/1');
  });
});
