import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordError,
  errorEntries,
  clearErrors,
  exportErrorsJson,
  setErrorContextProvider,
  installErrorCollector,
  subscribeErrors,
} from './errorCollector';

describe('errorCollector — #304 collecteur local de playtest', () => {
  beforeEach(() => {
    clearErrors();
    setErrorContextProvider(() => ({ scene: null, seed: null }));
  });

  it('recordError capture message + stack tronquée + contexte + horodatage', () => {
    setErrorContextProvider(() => ({ scene: 'auberge-alt', seed: 42 }));
    recordError('boom', 'Error: boom\n  at foo\n  at bar');
    const [entry] = errorEntries();
    expect(entry.message).toBe('boom');
    expect(entry.stack).toContain('at foo');
    expect(entry.scene).toBe('auberge-alt');
    expect(entry.seed).toBe(42);
    expect(entry.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(entry.at).toEqual(expect.any(String));
  });

  it('tronque une stack trop longue', () => {
    const longStack = 'x'.repeat(5000);
    recordError('long', longStack);
    expect(errorEntries()[0].stack.length).toBeLessThanOrEqual(2000);
  });

  it('buffer borné à 50 entrées (FIFO)', () => {
    for (let i = 0; i < 60; i++) recordError(`err-${i}`);
    const entries = errorEntries();
    expect(entries.length).toBe(50);
    expect(entries[0].message).toBe('err-10');
    expect(entries[entries.length - 1].message).toBe('err-59');
  });

  it('exportErrorsJson produit un JSON valide reflétant le buffer', () => {
    recordError('un');
    recordError('deux');
    const json = exportErrorsJson();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].message).toBe('deux');
  });

  it('clearErrors vide le buffer', () => {
    recordError('un');
    clearErrors();
    expect(errorEntries()).toHaveLength(0);
  });

  it('subscribeErrors notifie à chaque enregistrement (microtâche — jamais pendant un rendu), se désabonne proprement', async () => {
    let calls = 0;
    const unsub = subscribeErrors(() => { calls++; });
    recordError('un');
    recordError('deux');
    await Promise.resolve(); // laisse les microtâches de notification s'écouler
    unsub();
    recordError('trois');
    await Promise.resolve();
    expect(calls).toBe(2);
  });

  it('installErrorCollector est un no-op sûr hors navigateur (environnement de test Node)', () => {
    expect(() => installErrorCollector()).not.toThrow();
  });
});
