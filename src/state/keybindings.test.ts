/**
 * CONTEXTE des raccourcis pendant un CIBLAGE PAR LA CARTE (désignation des cibles d'un sort) : la
 * souris cible, donc le curseur clavier/manette doit cibler aussi. Le registre distingue deux
 * gardes : la CARTE (verdict de l'arbitre `modalBlocksMapHover` — une modale pilotée par la carte
 * laisse la scène vivante) et le PILOTAGE hors-carte (fin de tour, barre d'action, menu système),
 * qui exige qu'aucune modale ne soit ouverte. Sans cette distinction, `pickActiveModalKey != null`
 * rendait TOUT le clavier muet pendant que la souris continuait de cibler.
 */
import { describe, it, expect } from 'vitest';
import { KEYBINDINGS } from './keybindings';
import type { GameState } from './store';

const binding = (id: string) => KEYBINDINGS.find((k) => k.id === id)!;

/** État minimal : combat en cours, écran de jeu, aucun pending — les cas posent le leur. */
const fake = (over: Partial<GameState> = {}): GameState =>
  ({
    mode: 'battle', screen: 'campaign', gameMenuOpen: false,
    battle: { over: null, order: [], turn: 0, combatants: [] },
    net: { mode: 'local', mySeat: 0, gmSeat: null, ownership: {} },
    ...over,
  }) as never;

/** Cascade d'incantation dont l'étape courante DÉSIGNE ses cibles sur la carte (`pickingTargets`). */
const cartePilote = (over: Partial<GameState> = {}) =>
  fake({
    pendingCascade: { participants: [{ actorId: 'h1' }], cursor: 0 } as never,
    pendingCast: { casterId: 'h1', pickingTargets: true } as never,
    ...over,
  });

/** Cascade ORDINAIRE (révélation) : elle bloque la carte — clavier ET souris se taisent. */
const cascadeBloquante = (over: Partial<GameState> = {}) =>
  fake({ pendingCascade: { participants: [{ actorId: 'h1' }], cursor: 0 } as never, ...over });

const CURSEUR = ['cursor-up', 'cursor-down', 'cursor-left', 'cursor-right'];

describe('raccourcis — le CURSEUR vit tant que la carte cible', () => {
  it('hors modale : le curseur répond (référence)', () => {
    for (const id of CURSEUR) expect(binding(id).when(fake()), id).toBe(true);
  });

  it('ciblage de sort PAR LA CARTE : le curseur clavier/manette RESTE vivant, comme la souris', () => {
    for (const id of CURSEUR) expect(binding(id).when(cartePilote()), id).toBe(true);
  });

  it('ciblage de sort PAR LA CARTE : Entrée commet le ciblage sous le curseur', () => {
    expect(binding('cursor-commit').when(cartePilote({ combatCursor: { tile: { x: 1, y: 1 } } as never }))).toBe(true);
  });

  it('cascade ORDINAIRE (carte inerte) : le curseur est MORT', () => {
    for (const id of CURSEUR) expect(binding(id).when(cascadeBloquante()), id).toBe(false);
    expect(binding('cursor-commit').when(cascadeBloquante({ combatCursor: { tile: { x: 1, y: 1 } } as never }))).toBe(false);
  });
});

describe('raccourcis — les gestes qui ENGAGENT ou QUITTENT restent gardés par la modale', () => {
  it('pendant le ciblage par la carte : ni fin de tour, ni barre d’action, ni menu système', () => {
    const s = cartePilote();
    expect(binding('end-turn').when(s), 'Espace finirait le tour au milieu d’une désignation de cibles').toBe(false);
    expect(binding('hotbar-1').when(s), 'une capacité de la barre ouvrirait un 2ᵉ flux par-dessus le sort').toBe(false);
    expect(binding('toggle-menu').when(s), 'Échap doit annuler le ciblage, pas ouvrir le menu système').toBe(false);
  });

  it('hors modale, ces mêmes gestes répondent (la garde n’est pas devenue muette)', () => {
    const s = fake();
    expect(binding('end-turn').when(s)).toBe(true);
    expect(binding('hotbar-1').when(s)).toBe(true);
    expect(binding('toggle-menu').when(s)).toBe(true);
  });
});
