import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameMenu } from './GameMenu';
import { CAMPAIGN_START } from '../engine/clock';

const money = { gold: 1, silver: 2, brass: 3 };

describe('GameMenu', () => {
  it('fermé par défaut : seulement le bouton ☰ (pas de tiroir)', () => {
    const html = renderToStaticMarkup(
      <GameMenu sceneName="La taverne" money={money} time={CAMPAIGN_START} onQuit={() => {}} />,
    );
    expect(html).toContain('☰');
    expect(html).not.toContain('Bourse');
    expect(html).not.toContain('menu-card-panel');
  });

  it('ouvert : titre « Menu », scène LABELLISÉE (méta, jamais un titre), méta bourse+date, sections', () => {
    const html = renderToStaticMarkup(
      <GameMenu
        sceneName="La taverne"
        money={money}
        time={CAMPAIGN_START}
        onQuit={() => {}}
        onSaveLoad={() => {}}
        onEndSession={() => {}}
        onHouseRules={() => {}}
        onOptions={() => {}}
        initialOpen
      />,
    );
    // Tiroir « vrai menu » composé de la primitive MenuCard.
    expect(html).toContain('menu-card-panel');
    expect(html).toContain('menu-card-title');
    // En-tête : titre + scène en méta labellisée (« Lieu — … »), plus jamais lue comme un titre.
    expect(html).toContain('Menu');
    expect(html).toContain('Lieu');
    expect(html).toContain('La taverne');
    // Méta unifiée date + bourse (ScreenMeta, comme ScreenShell).
    expect(html).toContain('Bourse');
    expect(html).toContain('coin-gold');
    expect(html).toContain('1 CO');
    expect(html).toContain('Jahrdrung 2512 CI');
    expect(html).toContain('game-date');
    // Sections nettes.
    expect(html).toContain('Partie');
    expect(html).toContain('Réglages');
    // Boutons (libellés sans emoji, icône via <Icon>).
    expect(html).toContain('Sauvegarder');
    expect(html).toContain('Fin de séance');
    expect(html).toContain('Options');
    expect(html).toContain('Règles maison');
    expect(html).toContain('Quitter');
    // Purge emoji : aucun glyphe emoji d'affordance dans le rendu.
    expect(html).not.toMatch(/[\u{1F000}-\u{1FAFF}]/u);
  });
});
