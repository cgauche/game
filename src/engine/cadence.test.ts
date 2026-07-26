import { describe, it, expect, afterEach } from 'vitest';
import { cadence, cadenceAuto, cadenceAutoCombat, resetCadence, setCadence } from './cadence';

describe('cadence — préférence de rythme de combat (hors registre des règles optionnelles)', () => {
  afterEach(() => resetCadence());

  it('défaut = manuel : aucune automatisation', () => {
    expect(cadence()).toBe('manuel');
    expect(cadenceAuto()).toBe(false);
    expect(cadenceAutoCombat()).toBe(false);
  });

  it('rapide : auto-jets OUI, auto-combat NON', () => {
    setCadence('rapide');
    expect(cadence()).toBe('rapide');
    expect(cadenceAuto()).toBe(true);
    expect(cadenceAutoCombat()).toBe(false);
  });

  it('auto : auto-jets ET auto-combat', () => {
    setCadence('auto');
    expect(cadence()).toBe('auto');
    expect(cadenceAuto()).toBe(true);
    expect(cadenceAutoCombat()).toBe(true);
  });
});
