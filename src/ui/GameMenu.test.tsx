import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameMenu } from './GameMenu';
import { CAMPAIGN_START } from '../engine/clock';
import { useGame } from '../state/store';
import { KEYBINDINGS } from '../state/keybindings';
import type { GameState } from '../state/store';

describe('GameMenu — menu système plein écran (pause)', () => {
  // Rendu SSR (renderToStaticMarkup) : zustand v5 lit l'état INITIAL, d'où `initialOpen`/`initialView`
  // (aides de test) plutôt que le flag de store `gameMenuOpen` (lu en direct côté navigateur seulement).
  it('fermé par défaut : seulement le bouton ☰ (pas d’overlay)', () => {
    const html = renderToStaticMarkup(
      <GameMenu sceneName="La taverne" time={CAMPAIGN_START} onQuit={() => {}} />,
    );
    expect(html).toContain('☰');
    expect(html).not.toContain('game-menu-overlay');
  });

  it('ouvert : voile plein écran (role=dialog), six entrées STRICTES, lieu + date, JAMAIS la bourse', () => {
    const html = renderToStaticMarkup(
      <GameMenu
        sceneName="La taverne"
        time={CAMPAIGN_START}
        onQuit={() => {}}
        onSaveLoad={() => {}}
        onEndSession={() => {}}
        initialOpen
      />,
    );
    // Menu système plein écran (voile + dialogue), même carte que le menu principal.
    expect(html).toContain('game-menu-overlay');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('menu-card');
    // En-tête discret : titre + lieu labellisé + date — la bourse reste au commerce/HUD.
    expect(html).toContain('Menu');
    expect(html).toContain('Lieu');
    expect(html).toContain('La taverne');
    expect(html).toContain('Jahrdrung 2512 CI');
    expect(html).not.toContain('Bourse');
    expect(html).not.toContain('coin-gold');
    // Six entrées STRICTES, dans l'ordre validé.
    expect(html).toContain('Reprendre');
    expect(html).toContain('Sauvegarder / Charger');
    expect(html).toContain('Coopération');
    expect(html).toContain('Options');
    expect(html).toContain('Fin de séance');
    expect(html).toContain('Quitter la partie');
    // Purge emoji : aucun glyphe emoji d'affordance dans les libellés.
    expect(html).not.toMatch(/[\u{1F000}-\u{1FAFF}]/u);
  });

  it('Sauvegarder/Fin de séance désactivés quand le contexte les refuse (combat/invité)', () => {
    const html = renderToStaticMarkup(
      <GameMenu sceneName="La taverne" time={CAMPAIGN_START} onQuit={() => {}} initialOpen />,
    );
    // Les six entrées restent affichées (menu STABLE) mais les deux indisponibles sont disabled.
    expect(html).toContain('Sauvegarder / Charger');
    expect(html).toContain('Fin de séance');
    expect(html).toMatch(/disabled/);
  });

  it('sous-écran Options : onglets Clavier / Audio / Règles maison (même coquille)', () => {
    const html = renderToStaticMarkup(
      <GameMenu sceneName="La taverne" time={CAMPAIGN_START} onQuit={() => {}} initialOpen initialView="options" />,
    );
    expect(html).toContain('tablist'); // primitive Tabs (le rôle tablist reste réservé à Tabs.tsx, cf. tab-systems guard)
    expect(html).toContain('Clavier');
    expect(html).toContain('Audio');
    expect(html).toContain('Règles maison');
    expect(html).toContain('Retour'); // retour au menu
    // Onglet Clavier actif : le remap des raccourcis est bien rendu (registre keybindings).
    expect(html).toContain('Réinitialiser les touches');
  });

  it('sous-écran Coopération : en-tête Retour + briques coop (plus aucun widget coop inline au menu)', () => {
    const html = renderToStaticMarkup(
      <GameMenu sceneName="La taverne" time={CAMPAIGN_START} onQuit={() => {}} initialOpen initialView="coop" />,
    );
    expect(html).toContain('Coopération');
    expect(html).toContain('Retour');
  });
});

describe('GameMenu — ouverture par Échap (binding toggle-menu)', () => {
  const binding = KEYBINDINGS.find((b) => b.id === 'toggle-menu')!;
  const state = (over: Partial<GameState>): GameState => ({ screen: 'campaign', gameMenuOpen: false, ...over } as GameState);

  beforeEach(() => useGame.setState({ gameMenuOpen: false, screen: 'campaign' }));

  it('existe, sur Échap, section Système', () => {
    expect(binding).toBeTruthy();
    expect(binding.codes).toContain('Escape');
    expect(binding.section).toBe('systeme');
  });

  it('when : vrai en campagne sans modale ; faux si le menu est déjà ouvert', () => {
    expect(binding.when(state({}))).toBe(true);
    expect(binding.when(state({ gameMenuOpen: true }))).toBe(false);
    expect(binding.when(state({ screen: 'menu' }))).toBe(false);
  });

  it('when : faux quand une modale de combat est active (Échap garde son rôle de fermeture)', () => {
    expect(binding.when(state({ pendingFateSave: { heroId: 'h1' } as GameState['pendingFateSave'] }))).toBe(false);
  });

  it('run : ouvre le menu (gameMenuOpen = true)', () => {
    binding.run(useGame.getState);
    expect(useGame.getState().gameMenuOpen).toBe(true);
  });
});
