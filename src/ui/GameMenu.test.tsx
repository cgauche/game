import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameMenu } from './GameMenu';
import { formatMoney } from '../engine/money';

const money = { gold: 1, silver: 2, brass: 3 };

describe('GameMenu', () => {
  it('fermé par défaut : seulement le bouton ☰', () => {
    const html = renderToStaticMarkup(
      <GameMenu sceneName="La taverne" money={money} dateLine="🌄 Matin — Marktag · 33 Jahrdrung 2512 CI · 08:00" onQuit={() => {}} />,
    );
    expect(html).toContain('☰');
    expect(html).not.toContain('Bourse');
  });

  it('ouvert : scène, bourse, date complète, Quitter', () => {
    const html = renderToStaticMarkup(
      <GameMenu sceneName="La taverne" money={money} dateLine="🌄 Matin — Marktag · 33 Jahrdrung 2512 CI · 08:00" onQuit={() => {}} initialOpen />,
    );
    expect(html).toContain('La taverne');
    expect(html).toContain('Bourse');
    expect(html).toContain(formatMoney(money));
    expect(html).toContain('Marktag');
    expect(html).toContain('Quitter');
  });
});
