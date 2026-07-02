import { describe, it, expect } from 'vitest';
import { IMPERIAL_MONTHS, INTERCALARY, WEEKDAYS, DAYS_PER_YEAR, daysPerYear, MINUTES_PER_DAY, toDate, fromDate, formatImperial, CAMPAIGN_START, dayPhase, isNight, minutesUntilNext } from './clock';
import { setDataset } from '../data/overrides';
import { calendarMonths } from '../data';

describe('clock — calendrier impérial', () => {
  it('a 12 mois, 6 intercalaires, 8 jours de semaine ; année auto-cohérente', () => {
    expect(IMPERIAL_MONTHS).toHaveLength(12);
    expect(IMPERIAL_MONTHS[0]).toEqual({ name: 'Nachhexen', days: 32 });
    expect(INTERCALARY).toHaveLength(6);
    expect(WEEKDAYS).toHaveLength(8);
    expect(DAYS_PER_YEAR).toBe(IMPERIAL_MONTHS.reduce((s, m) => s + m.days, 0) + INTERCALARY.length); // 394 + 6 = 400
  });

  it('année = 400 jours (canon EiS Annexe 3 l.20/68) ; mois = 394 = 2×32 + 10×33', () => {
    expect(DAYS_PER_YEAR).toBe(400);
    expect(IMPERIAL_MONTHS.reduce((s, m) => s + m.days, 0)).toBe(394);
    expect(IMPERIAL_MONTHS.filter((m) => m.days === 32).map((m) => m.name)).toEqual(['Nachhexen', 'Nachgeheim']);
  });

  it('édition LIVE au Codex : éditer une table (setDataset) recalcule l’année à la volée', () => {
    const orig = calendarMonths.map((m) => ({ ...m }));
    const before = daysPerYear();
    setDataset('calendarMonths', [{ ...calendarMonths[0], days: calendarMonths[0].days + 5 }, ...calendarMonths.slice(1)]);
    expect(daysPerYear()).toBe(before + 5); // la dérivation (mémoïsée sur signature) se recalcule depuis la donnée éditée
    setDataset('calendarMonths', orig); // restaurer pour l’isolation des autres tests
    expect(daysPerYear()).toBe(before);
  });

  it('toDate/fromDate font un aller-retour (époque = Hexenstag 2512 00:00)', () => {
    for (const min of [0, 1440, 33 * 1440, 400 * 1440, 400 * 1440 + 17 * 60 + 30]) {
      expect(fromDate(toDate(min))).toBe(min);
    }
  });

  it('les jours intercalaires sont HORS du cycle hebdomadaire (weekday = null)', () => {
    expect(toDate(0).weekday).toBeNull(); // Hexenstag
    expect(toDate(66 * MINUTES_PER_DAY).weekday).toBeNull(); // Mitterfrühl
    expect(toDate(MINUTES_PER_DAY).weekday).toBe('Wellentag'); // 1 Nachhexen 2512 (ancre)
  });

  it('la semaine enjambe les intercalaires sans les compter (canon : « bridge uninterrupted »)', () => {
    // Hexenstag(0) Nachhexen(1..32) Jahrdrung(33..65) Mitterfrühl(66) Pflugzeit(67..)
    const lastJahrdrung = toDate(65 * MINUTES_PER_DAY); // 33 Jahrdrung
    const festival = toDate(66 * MINUTES_PER_DAY); // Mitterfrühl
    const firstPflugzeit = toDate(67 * MINUTES_PER_DAY); // 1 Pflugzeit
    expect(festival.weekday).toBeNull();
    // Les deux jours de mois de part et d'autre de la fête ont des jours de semaine CONSÉCUTIFS.
    const i = WEEKDAYS.findIndex((w) => w.name === lastJahrdrung.weekday);
    expect(WEEKDAYS[(i + 1) % WEEKDAYS.length].name).toBe(firstPflugzeit.weekday);
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

describe('clock — phases du jour & obscurité (#T1c)', () => {
  const at = (h: number, m = 0) => h * 60 + m;
  it('dayPhase : 7 phases aux frontières (la nuit enjambe minuit)', () => {
    expect(dayPhase(at(4, 59)).key).toBe('nuit');
    expect(dayPhase(at(5)).key).toBe('aube');
    expect(dayPhase(at(8)).key).toBe('matin');
    expect(dayPhase(at(11)).key).toBe('midi');
    expect(dayPhase(at(14)).key).toBe('apresmidi');
    expect(dayPhase(at(18)).key).toBe('crepuscule');
    expect(dayPhase(at(20)).key).toBe('soir');
    expect(dayPhase(at(22)).key).toBe('nuit');
    expect(dayPhase(at(0)).key).toBe('nuit');
  });
  it('isNight = obscurité 22:00–05:00 (enjambe minuit), découplé des phases', () => {
    expect(isNight(at(22))).toBe(true);
    expect(isNight(at(2))).toBe(true);
    expect(isNight(at(4, 59))).toBe(true);
    expect(isNight(at(5))).toBe(false);
    expect(isNight(at(12))).toBe(false);
    expect(isNight(at(21, 59))).toBe(false);
  });
  it('dayPhase expose label/icon et isNight', () => {
    expect(dayPhase(at(12))).toMatchObject({ key: 'midi', icon: 'time/noon', isNight: false });
    expect(dayPhase(at(23))).toMatchObject({ key: 'nuit', isNight: true });
  });
  it('minutesUntilNext : plus tard / déjà passé → demain / pile = 0', () => {
    expect(minutesUntilNext(at(14), at(22))).toBe(8 * 60); // 14:00 → 22:00
    expect(minutesUntilNext(at(23), at(22))).toBe(23 * 60); // 23:00 → prochaine 22:00
    expect(minutesUntilNext(at(22), at(22))).toBe(0);
  });
});
