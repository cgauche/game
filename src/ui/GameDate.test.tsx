import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameDate } from './GameDate';
import { CAMPAIGN_START, fromDate, WEEKDAYS } from '../engine/clock';

describe('GameDate — instant de jeu unifié', () => {
  it('icône de phase + jour de semaine + date impériale complète', () => {
    const html = renderToStaticMarkup(<GameDate time={CAMPAIGN_START} />);
    expect(html).toContain('<svg'); // icône time/* de la phase (dayPhase().icon)
    expect(html).toContain('Jahrdrung 2512 CI');
    expect(html).toContain('08:00');
    expect(html).toContain(WEEKDAYS[0].label); // le jour de semaine précède la date
  });

  it('jour intercalaire : pas de jour de semaine (hors cycle, canon)', () => {
    // Hexenstag = 1er slot de l'année (intercalaire avant Nachhexen) → minute 0 de 2512.
    const html = renderToStaticMarkup(<GameDate time={12 * 60} />);
    expect(html).toContain('Hexenstag 2512 CI');
    expect(html).not.toContain('·  '); // pas de séparateur orphelin sans weekday
  });

  it('la nuit porte l’icône et le libellé de phase en tooltip', () => {
    const night = fromDate({ year: 2512, month: 1, monthName: 'Jahrdrung', day: 3, intercalary: null, weekday: null, hour: 23, minute: 0 });
    const html = renderToStaticMarkup(<GameDate time={night} />);
    expect(html).toContain('23:00');
    expect(html).toMatch(/title="[^"]+"/); // tooltip = libellé de phase
  });
});
