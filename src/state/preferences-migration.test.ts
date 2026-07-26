import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadPreferences } from './preferences';
import { loadHouseRules } from './houseRules';
import { rule, resetRule, OPTIONAL_RULES } from '../engine/policy';
import { cadence, setCadence, CADENCE_DEFAULT } from '../engine/cadence';

/**
 * REPRISE d'un réglage passé des règles maison aux préférences de confort (`combat-cadence`, #839).
 *
 * Une partie déjà jouée porte son choix dans `wfrp4.house-rules.v1` ; le registre des règles ne
 * connaît plus cet id (`loadRuleOverrides` ignore les ids inconnus) et le magasin des préférences ne
 * l'a jamais vu. Sans reprise, le joueur retrouve le défaut « manuel » sans un mot.
 */
const HOUSE_RULES_KEY = 'wfrp4.house-rules.v1';
const PREFS_KEY = 'wfrp4.prefs.v1';

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

const store = () => globalThis.localStorage;
const houseRulesBlob = () => JSON.parse(store().getItem(HOUSE_RULES_KEY) ?? '{}') as Record<string, unknown>;
const prefsBlob = () => JSON.parse(store().getItem(PREFS_KEY) ?? '{}') as Record<string, unknown>;

describe('préférences — reprise du réglage de Cadence laissé dans les règles maison', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    setCadence(CADENCE_DEFAULT);
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });
  afterEach(() => {
    setCadence(CADENCE_DEFAULT);
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });

  it('une partie existante garde sa Cadence : le réglage est adopté, puis retiré du magasin d’origine', () => {
    store().setItem(HOUSE_RULES_KEY, JSON.stringify({ 'combat-cadence': 'auto', 'combat-frappe-mortelle': true }));

    loadPreferences();

    expect(cadence()).toBe('auto');
    expect(prefsBlob()['combat-cadence']).toBe('auto'); // désormais persisté du bon côté
    expect('combat-cadence' in houseRulesBlob()).toBe(false); // la reprise ne se rejoue pas
    expect(houseRulesBlob()['combat-frappe-mortelle']).toBe(true); // les VRAIES règles restent en place

    loadHouseRules();
    expect(rule('combat-frappe-mortelle')).toBe(true);
  });

  it('CONTRE-ÉPREUVE : sans réglage laissé derrière, la Cadence reste au défaut', () => {
    store().setItem(HOUSE_RULES_KEY, JSON.stringify({ 'combat-frappe-mortelle': true }));
    loadPreferences();
    expect(cadence()).toBe('manuel');
    expect(store().getItem(PREFS_KEY)).toBeNull();
  });

  it('le magasin des préférences PRIME sur le réglage laissé derrière (choix le plus récent)', () => {
    store().setItem(HOUSE_RULES_KEY, JSON.stringify({ 'combat-cadence': 'auto' }));
    store().setItem(PREFS_KEY, JSON.stringify({ 'combat-cadence': 'rapide' }));
    loadPreferences();
    expect(cadence()).toBe('rapide');
    expect('combat-cadence' in houseRulesBlob()).toBe(false);
  });
});
