import { describe, it, expect, beforeEach } from 'vitest';
import { rule, resetRule, OPTIONAL_RULES } from '../engine/policy';
import { loadHouseRules, setHouseRule } from './houseRules';

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
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

const KEY = 'wfrp4.house-rules.v1';

describe('houseRules — persistance des règles optionnelles (localStorage)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });

  it('setHouseRule : le registre reflète la surcharge ET elle est persistée', () => {
    setHouseRule('test-fast-sl', true);
    expect(rule('test-fast-sl')).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!)['test-fast-sl']).toBe(true);
  });

  it('loadHouseRules : recharge le localStorage vers le registre', () => {
    localStorage.setItem(KEY, JSON.stringify({ 'test-auto-bands': 'inverted' }));
    for (const r of OPTIONAL_RULES) resetRule(r.id); // registre vierge avant chargement
    loadHouseRules();
    expect(rule('test-auto-bands')).toBe('inverted');
  });

  it('robustesse : un id inconnu persisté est ignoré (retour au défaut)', () => {
    localStorage.setItem(KEY, JSON.stringify({ 'regle-fantome': true }));
    loadHouseRules();
    expect(rule('regle-fantome')).toBe(false);
  });
});
