import { describe, it, expect } from 'vitest';
import { conditionMeta, summarizeEffects, topImportantCondition } from './effectIcons';
import type { ConditionInstance, ActiveEffect, CharKey } from '../engine/types';

const cond = (name: string, value = 1): ConditionInstance => ({ name, value });
const buff = (label: string, bonus: number, roundsLeft: number, char?: CharKey): ActiveEffect => ({ label, bonus, roundsLeft, char });

describe('conditionMeta', () => {
  it('donne une icône et marque les états incapacitants comme importants', () => {
    expect(conditionMeta('Sonné').icon).toBeTruthy();
    expect(conditionMeta('Sonné').important).toBe(true);
    expect(conditionMeta('Inconscient').important).toBe(true);
  });
  it('marque Exténué comme non-important (état mineur)', () => {
    expect(conditionMeta('Exténué').important).toBe(false);
  });
  it('a un repli pour un état inconnu', () => {
    expect(conditionMeta('TrucBizarre').icon).toBeTruthy();
    expect(conditionMeta('TrucBizarre').important).toBe(false);
  });
});

describe('summarizeEffects', () => {
  it('rend tout quand on est sous la limite', () => {
    const r = summarizeEffects([cond('Sonné'), cond('Aveuglé')], [], 5);
    expect(r.visible).toHaveLength(2);
    expect(r.moreCount).toBe(0);
  });
  it('tronque et compte le surplus quand ça déborde', () => {
    const r = summarizeEffects([cond('Sonné'), cond('Aveuglé'), cond('Empoisonné'), cond('Hémorragique')], [], 2);
    expect(r.visible).toHaveLength(2);
    expect(r.moreCount).toBe(2);
  });
  it('trie les malus par sévérité décroissante (le plus grave en premier)', () => {
    const r = summarizeEffects([cond('Exténué'), cond('Inconscient')], [], 5);
    expect(r.visible[0].label).toBe('Inconscient');
  });
  it('garde un empilement (value>1) comme compteur', () => {
    const r = summarizeEffects([cond('Hémorragique', 3)], [], 5);
    expect(r.visible[0].count).toBe(3);
    const single = summarizeEffects([cond('Sonné', 1)], [], 5);
    expect(single.visible[0].count).toBeUndefined();
  });
  it('place les buffs après les malus et expose leur durée + bonus', () => {
    const r = summarizeEffects([cond('Sonné')], [buff('Bénédiction de Bataille', 10, 2, 'CC')], 5);
    expect(r.visible.map((c) => c.kind)).toEqual(['malus', 'buff']);
    expect(r.visible[1].rounds).toBe(2);
    expect(r.visible[1].bonus).toBe(10);
  });
  it('priorise les malus quand le débordement coupe', () => {
    const r = summarizeEffects([cond('Inconscient'), cond('Sonné')], [buff('X', 10, 1)], 2);
    expect(r.visible.every((c) => c.kind === 'malus')).toBe(true);
    expect(r.moreCount).toBe(1);
  });
  it('tolère des entrées vides', () => {
    expect(summarizeEffects([], [], 3)).toEqual({ visible: [], moreCount: 0 });
  });
});

describe('topImportantCondition', () => {
  it('retourne le plus grave état important', () => {
    expect(topImportantCondition([cond('Aveuglé'), cond('Inconscient')])?.label).toBe('Inconscient');
  });
  it('null si aucun état important', () => {
    expect(topImportantCondition([cond('Exténué')])).toBeNull();
  });
});

describe('summarizeEffects — états-drapeaux (Frénésie)', () => {
  it('ajoute une pastille Frénésie (kind state) quand le drapeau est posé', () => {
    const r = summarizeEffects([], [], 5, { frenzied: true });
    const fr = r.visible.find((c) => c.label === 'Frénésie');
    expect(fr).toBeTruthy();
    expect(fr?.kind).toBe('state');
    expect(fr?.icon).toBeTruthy();
  });
  it('sans drapeau, aucune pastille Frénésie', () => {
    expect(summarizeEffects([cond('Sonné')], []).visible.some((c) => c.label === 'Frénésie')).toBe(false);
  });
  it('ordonne malus → état-drapeau → buff', () => {
    const r = summarizeEffects([cond('Sonné')], [buff('Bénédiction', 10, 2)], 5, { frenzied: true });
    expect(r.visible.map((c) => c.kind)).toEqual(['malus', 'state', 'buff']);
  });
  it('Visée / Sur la défensive / Focalisation (avec DR en compteur)', () => {
    const r = summarizeEffects([], [], 9, { aiming: true, defensiveStance: true, focusDr: 2 });
    const labels = r.visible.map((c) => c.label);
    expect(labels.some((l) => l.startsWith('En joue'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Sur la défensive'))).toBe(true);
    const focus = r.visible.find((c) => c.label.startsWith('Focalisation'));
    expect(focus?.count).toBe(2);
  });
});
