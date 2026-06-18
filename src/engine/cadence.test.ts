import { describe, it, expect, afterEach } from 'vitest';
import { cadence, cadenceAuto, cadenceAutoCombat } from './cadence';
import { setRule, resetRule } from './policy';

describe('cadence — lecture typée de la règle combat-cadence', () => {
  afterEach(() => resetRule('combat-cadence'));

  it('défaut = manuel : aucune automatisation', () => {
    expect(cadence()).toBe('manuel');
    expect(cadenceAuto()).toBe(false);
    expect(cadenceAutoCombat()).toBe(false);
  });

  it('rapide : auto-jets OUI, auto-combat NON', () => {
    setRule('combat-cadence', 'rapide');
    expect(cadence()).toBe('rapide');
    expect(cadenceAuto()).toBe(true);
    expect(cadenceAutoCombat()).toBe(false);
  });

  it('auto : auto-jets ET auto-combat', () => {
    setRule('combat-cadence', 'auto');
    expect(cadence()).toBe('auto');
    expect(cadenceAuto()).toBe(true);
    expect(cadenceAutoCombat()).toBe(true);
  });
});
