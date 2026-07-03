import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameMenu } from './GameMenu';
import { CAMPAIGN_START } from '../engine/clock';

const money = { gold: 1, silver: 2, brass: 3 };

describe('GameMenu', () => {
  it('fermé par défaut : seulement le bouton ☰', () => {
    const html = renderToStaticMarkup(
      <GameMenu sceneName="La taverne" money={money} time={CAMPAIGN_START} onQuit={() => {}} />,
    );
    expect(html).toContain('☰');
    expect(html).not.toContain('Bourse');
  });

  it('ouvert : scène, bourse (<Coins>), date complète (<GameDate>), Quitter', () => {
    const html = renderToStaticMarkup(
      <GameMenu sceneName="La taverne" money={money} time={CAMPAIGN_START} onQuit={() => {}} onSaveLoad={() => {}} onHouseRules={() => {}} initialOpen />,
    );
    expect(html).toContain('La taverne');
    expect(html).toContain('Bourse');
    expect(html).toContain('coin-gold'); // montant rendu par la primitive <Coins> (or/argent/cuivre)
    expect(html).toContain('1 CO');
    expect(html).toContain('Jahrdrung 2512 CI'); // date impériale rendue par <GameDate>
    expect(html).toContain('game-date');
    expect(html).toContain('Quitter');
    expect(html).toContain('Sauvegarder');
    expect(html).toContain('Règles maison');
  });
});
