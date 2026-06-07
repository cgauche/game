import { describe, it, expect } from 'vitest';
import { IMPERIAL_MONTHS, INTERCALARY, WEEKDAYS, DAYS_PER_YEAR, MINUTES_PER_DAY, toDate, fromDate, formatImperial, CAMPAIGN_START } from './clock';

describe('clock — calendrier impérial', () => {
  it('a 12 mois, 6 intercalaires, 8 jours de semaine ; année auto-cohérente', () => {
    expect(IMPERIAL_MONTHS).toHaveLength(12);
    expect(IMPERIAL_MONTHS[0]).toEqual({ name: 'Nachhexen', days: 32 });
    expect(INTERCALARY).toHaveLength(6);
    expect(WEEKDAYS).toHaveLength(8);
    expect(DAYS_PER_YEAR).toBe(IMPERIAL_MONTHS.reduce((s, m) => s + m.days, 0) + INTERCALARY.length); // 395 + 6 = 401
  });

  it('toDate/fromDate font un aller-retour (époque = Hexenstag 2512 00:00)', () => {
    for (const min of [0, 1440, 33 * 1440, 401 * 1440, 401 * 1440 + 17 * 60 + 30]) {
      expect(fromDate(toDate(min))).toBe(min);
    }
  });

  it('minute 0 = Hexenstag 2512 (jour intercalaire de Nouvel An)', () => {
    const d = toDate(0);
    expect(d.year).toBe(2512);
    expect(d.intercalary).toBe('Hexenstag');
    expect(d.month).toBeNull();
  });

  it('le 1er jour après Hexenstag = 1 Nachhexen 2512, 00:00', () => {
    const d = toDate(1 * MINUTES_PER_DAY);
    expect(d).toMatchObject({ year: 2512, monthName: 'Nachhexen', day: 1, hour: 0, minute: 0, intercalary: null });
  });

  it('franchit l’intercalaire Mitterfrühl entre Jahrdrung et Pflugzeit', () => {
    // Hexenstag(1) + Nachhexen(32) + Jahrdrung(33) = 66 jours → jour 66 = Mitterfrühl
    const d = toDate(66 * MINUTES_PER_DAY);
    expect(d.intercalary).toBe('Mitterfrühl');
  });

  it('formatImperial affiche date + heure françaises', () => {
    // 32 j Nachhexen + 30e jour de Jahrdrung = totalDays 62 (Hexenstag = jour 0, déjà compté par l'époque).
    const min = (32 + 30) * MINUTES_PER_DAY + 14 * 60 + 30; // 30 Jahrdrung 2512, 14:30
    expect(formatImperial(min)).toMatch(/30 Jahrdrung 2512 CI · 14:30/);
  });

  it('CAMPAIGN_START = fin Jahrdrung 2512 08:00', () => {
    const d = toDate(CAMPAIGN_START);
    expect(d).toMatchObject({ year: 2512, monthName: 'Jahrdrung', day: 33, hour: 8, minute: 0 });
  });
});
