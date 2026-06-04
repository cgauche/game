import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, EnemyTurnInput } from './ai';
import { emptyScene } from './scene';
import { manhattan } from './path';
import type { Combatant, Weapon } from '../engine/types';

const MELEE: Weapon = { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] };
const RANGED: Weapon = { name: 'Arc', type: 'ranged', damage: '+9', range: 60, qualities: [] };

function mk(
  id: string,
  kind: 'hero' | 'enemy',
  pos: { x: number; y: number },
  opts: Partial<Combatant> = {},
): Combatant {
  return {
    id,
    name: id,
    kind,
    pos,
    wounds: { current: 10, max: 10 },
    weapons: [MELEE],
    characteristics: {} as never,
    advantage: 0,
    conditions: [],
    armour: {} as never,
    skills: [],
    talents: [],
    movement: 4,
    ...opts,
  } as Combatant;
}

const scene = emptyScene(12, 12);

function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return {
    enemy,
    heroes,
    scene,
    blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)),
    movement: enemy.movement,
    ...extra,
  };
}

describe("IA d'ennemi (chooseEnemyAction, pure)", () => {
  it('sans héros vivant → passe la main', () => {
    expect(chooseEnemyAction(input(mk('e', 'enemy', { x: 5, y: 5 }), [])).kind).toBe('end');
  });

  it('cible adjacente en mêlée → attaque', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 });
    const h = mk('h', 'hero', { x: 5, y: 6 });
    expect(chooseEnemyAction(input(e, [h]))).toEqual({ kind: 'melee', targetId: 'h' });
  });

  it('cible éloignée en mêlée → se rapproche (move) vers elle', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 3 });
    const h = mk('h', 'hero', { x: 5, y: 10 });
    const a = chooseEnemyAction(input(e, [h]));
    expect(a.kind).toBe('move');
    if (a.kind === 'move') {
      expect(a.thenTargetId).toBe('h');
      // a effectivement réduit la distance à la cible
      expect(manhattan(a.to, h.pos!)).toBeLessThan(manhattan(e.pos!, h.pos!));
    }
  });

  it('arme à distance → tient la position et tire (pas de charge en mêlée)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [RANGED] });
    const h = mk('h', 'hero', { x: 1, y: 1 });
    expect(chooseEnemyAction(input(e, [h]))).toEqual({ kind: 'shoot', targetId: 'h' });
  });

  it('sort offensif prêt → incante sur la cible', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { spells: ['Fléchette'] });
    const h = mk('h', 'hero', { x: 1, y: 1 });
    expect(chooseEnemyAction(input(e, [h], { offensiveSpell: 'Fléchette' }))).toEqual({
      kind: 'cast',
      targetId: 'h',
      spell: 'Fléchette',
    });
  });

  it('vise le héros le plus FAIBLE quand plusieurs sont frappables (sécurise l’élimination)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 4 });
    const strong = mk('strong', 'hero', { x: 6, y: 5 }, { wounds: { current: 10, max: 10 } }); // adjacent
    const weak = mk('weak', 'hero', { x: 5, y: 2 }, { wounds: { current: 2, max: 10 } }); // à 3 cases mais atteignable
    const a = chooseEnemyAction(input(e, [strong, weak]));
    expect(a.kind).toBe('move'); // délaisse le costaud adjacent pour fondre sur le blessé
    if (a.kind === 'move') {
      expect(a.thenTargetId).toBe('weak');
      expect(manhattan(a.to, weak.pos!)).toBe(1); // se met au contact du blessé
    }
  });

  it('ne court PAS après un blessé hors d’atteinte : frappe la cible accessible', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 1 });
    const strong = mk('strong', 'hero', { x: 5, y: 6 }, { wounds: { current: 10, max: 10 } }); // adjacent
    const weak = mk('weak', 'hero', { x: 5, y: 9 }, { wounds: { current: 1, max: 10 } }); // hors d’atteinte ce tour
    expect(chooseEnemyAction(input(e, [strong, weak]))).toEqual({ kind: 'melee', targetId: 'strong' });
  });

  it('encerclé et cible non adjacente → passe la main (pas de mouvement possible)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 4 });
    const h = mk('h', 'hero', { x: 1, y: 1 });
    const blocked = new Set(['4,5', '6,5', '5,4', '5,6']); // 4 voisins bloqués
    expect(chooseEnemyAction(input(e, [h], { blocked })).kind).toBe('end');
  });
});
