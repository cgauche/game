/**
 * hoverTargeting — source unique du tooltip/réticule de visée (IsoStage). Rejoue les MÊMES
 * prédicats que le clic : ok ⇔ le clic aboutirait ; invalid porte la raison (⛔ LdV / portée).
 */
import { describe, it, expect } from 'vitest';
import { hoverTargeting } from './targeting';
import { findSpell } from '../data';
import { parseSpellDamage } from '../engine/magic';
import { bonus } from '../engine/characteristics';
import type { Combatant } from '../engine/types';
import type { GameState } from './store';
import type { Scene } from './scene';

const combatant = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'A', name: 'A', kind: 'hero',
    characteristics: { CC: 50, CT: 50, F: 35, E: 35, I: 30, Ag: 35, Dex: 30, Int: 30, FM: 40, Soc: 30 },
    wounds: { current: 14, max: 14 }, advantage: 0, conditions: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: '+BF+4', reach: 'Moyenne', qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

const scene = (mur?: number): Scene => {
  const tiles = new Array(64).fill('herbe');
  if (mur != null) tiles[mur] = 'mur'; // sur la ligne y=0
  return { id: 's', name: 's', dimensions: { w: 8, h: 8 }, ambiance: 'jour', levels: [{ z: 0, tiles }], entities: [], buildings: [], dialogues: [], triggers: [], encounters: [] } as unknown as Scene;
};

const mkGet = (combatants: Combatant[], battleOver: Partial<Record<string, unknown>> = {}, sc = scene()): (() => GameState) =>
  (() => ({
    scene: sc,
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, movementUsed: 0, action: null, selectedSpellId: null, acted: false, over: null, ...battleOver },
    facing: {}, gameTime: 0, log: () => {},
  })) as unknown as () => GameState;

const bow = { name: 'Arc', type: 'ranged', damage: '+8', range: 4, qualities: [] }; // ×3 = 12 m = 6 cases

describe('hoverTargeting — mode neutre (attaque implicite)', () => {
  it('tir valide → ok pointillé : nom d’arme, compétence, base, dégâts d’ARME', () => {
    const a = combatant({ id: 'A', weapons: [bow] as never });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 2, y: 0 } });
    const ht = hoverTargeting(mkGet([a, b]), a, b);
    expect(ht).toMatchObject({ kind: 'ok', line: 'dashed', title: 'Arc', skill: 'Projectiles', base: 50, dmg: 8 });
  });

  it('mêlée adjacente → ok ligne PLEINE', () => {
    const a = combatant({ id: 'A' });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const ht = hoverTargeting(mkGet([a, b]), a, b);
    expect(ht).toMatchObject({ kind: 'ok', line: 'solid', title: 'Épée', skill: 'Corps à corps', dmg: 7 }); // BF 3 + 4
  });

  it('cible chargeable (hors Allonge, Mouvement intact) → ok PLEINE (aperçu depuis l’arrivée)', () => {
    const a = combatant({ id: 'A' });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 4, y: 0 } });
    const ht = hoverTargeting(mkGet([a, b]), a, b);
    expect(ht).toMatchObject({ kind: 'ok', line: 'solid', title: 'Épée' });
  });

  it('tir hors LdV → invalid los ; au-delà de ×3 → invalid range', () => {
    const a = combatant({ id: 'A', weapons: [bow] as never });
    const hidden = combatant({ id: 'B', kind: 'enemy', pos: { x: 6, y: 0 } });
    expect(hoverTargeting(mkGet([a, hidden], {}, scene(3)), a, hidden)).toMatchObject({ kind: 'invalid', reason: 'los' });
    const far = combatant({ id: 'C', kind: 'enemy', pos: { x: 7, y: 0 } }); // 14 m > 12 m
    expect(hoverTargeting(mkGet([a, far]), a, far)).toMatchObject({ kind: 'invalid', reason: 'range' });
  });

  it('survol d’un allié → none', () => {
    const a = combatant({ id: 'A' });
    const friend = combatant({ id: 'H2', pos: { x: 1, y: 0 } });
    expect(hoverTargeting(mkGet([a, friend]), a, friend).kind).toBe('none');
  });
});

describe('hoverTargeting — mode incantation', () => {
  const castBattle = (spellId: string) => ({ action: 'cast', selectedSpellId: spellId });

  it('Projectile sur un ennemi visible → ok pointillé, Langue (Magick), dégâts sort + BFM', () => {
    const a = combatant({ id: 'A' });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 2, y: 0 } });
    const ht = hoverTargeting(mkGet([a, b], castBattle('carreau')), a, b);
    const dmg = parseSpellDamage(findSpell('Carreau')!.desc)!.damage + bonus(40); // FM 40
    expect(ht).toMatchObject({ kind: 'ok', line: 'dashed', title: 'Carreau', skill: 'Langue (Magick)', dmg });
  });

  it('Projectile sur un ALLIÉ → none ; ennemi derrière un mur → invalid los', () => {
    const a = combatant({ id: 'A' });
    const friend = combatant({ id: 'H2', pos: { x: 2, y: 0 } });
    expect(hoverTargeting(mkGet([a, friend], castBattle('carreau')), a, friend).kind).toBe('none');
    const hidden = combatant({ id: 'B', kind: 'enemy', pos: { x: 6, y: 0 } });
    expect(hoverTargeting(mkGet([a, hidden], castBattle('carreau'), scene(3)), a, hidden)).toMatchObject({ kind: 'invalid', reason: 'los' });
  });

  it('sort « Vous » : sur soi → ok SANS ligne de dégâts ; sur un allié → invalid range', () => {
    const a = combatant({ id: 'A' });
    const friend = combatant({ id: 'H2', pos: { x: 2, y: 0 } });
    const self = hoverTargeting(mkGet([a, friend], castBattle('bouclier-magique')), a, a);
    expect(self).toMatchObject({ kind: 'ok', dmg: null });
    expect(hoverTargeting(mkGet([a, friend], castBattle('bouclier-magique')), a, friend)).toMatchObject({ kind: 'invalid', reason: 'range' });
  });
});
