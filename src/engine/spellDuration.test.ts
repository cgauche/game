import { describe, it, expect } from 'vitest';
import { parseSpellDuration, type SpellDuration } from './spellDuration';
import { formatSpellDuration } from './spellRangeFormat';

describe('spellDuration — round-trip parse∘format = identité', () => {
  const ds: SpellDuration[] = [
    { kind: 'instant' },
    { kind: 'rounds', value: 6 },
    { kind: 'rounds', value: { bonusOf: 'force-mentale' } },
    { kind: 'clock', value: 1, unit: 'hours' },
    { kind: 'clock', value: { charOf: 'force-mentale' }, unit: 'minutes' },
    { kind: 'clock', value: { bonusOf: 'sociabilite' }, unit: 'days' },
    { kind: 'untilDawn' },
    { kind: 'special', text: 'Variable' },
  ];
  for (const d of ds) it(JSON.stringify(d), () => expect(parseSpellDuration(formatSpellDuration(d))).toEqual(d));
});

describe('spellDuration — parse prose réelle (sanity)', () => {
  it('échelles', () => {
    expect(parseSpellDuration('Instantané')).toEqual({ kind: 'instant' });
    expect(parseSpellDuration('Instantanée')).toEqual({ kind: 'instant' }); // variante normalisée
    expect(parseSpellDuration('(Bonus de Force Mentale) Rounds')).toEqual({ kind: 'rounds', value: { bonusOf: 'force-mentale' } });
    expect(parseSpellDuration('6 rounds')).toEqual({ kind: 'rounds', value: 6 });
    expect(parseSpellDuration('1 heure')).toEqual({ kind: 'clock', value: 1, unit: 'hours' });
    expect(parseSpellDuration('(Force Mentale) minutes')).toEqual({ kind: 'clock', value: { charOf: 'force-mentale' }, unit: 'minutes' });
    expect(parseSpellDuration("Jusqu'au lever du soleil")).toEqual({ kind: 'untilDawn' });
    expect(parseSpellDuration('8 Tours')).toEqual({ kind: 'special', text: '8 Tours' }); // non chiffrable (préservé)
  });
});
