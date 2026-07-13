import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';

/**
 * BUG #73 — un clic de référence Codex EN JEU ouvre une MODALE par-dessus la partie (sans changer
 * d'écran → musique et fiche perso intactes), tandis que le parcours complet depuis le menu reste
 * un écran plein. Les 4 sémantiques d'`openCodex` + la fermeture.
 */
describe('openCodex — drill-in modale vs parcours plein écran', () => {
  beforeEach(() => {
    useGame.setState({ screen: 'campaign', codexOverlay: null, compendiumFocus: null, compendiumReturn: 'menu' });
  });

  it('réf cliquée en jeu (focus + écran de jeu) → modale, sans changer d’écran', () => {
    useGame.getState().openCodex({ category: 'talents', id: 'sixieme-sens', label: 'Sixième sens' });
    expect(useGame.getState().screen).toBe('campaign');
    expect(useGame.getState().codexOverlay).toEqual({ category: 'talents', id: 'sixieme-sens', label: 'Sixième sens' });
  });

  it('parcours depuis le menu (sans focus) → écran plein, retour mémorisé', () => {
    useGame.setState({ screen: 'menu', codexOverlay: null });
    useGame.getState().openCodex();
    expect(useGame.getState().screen).toBe('compendium');
    expect(useGame.getState().codexOverlay).toBeNull();
    expect(useGame.getState().compendiumReturn).toBe('menu');
  });

  it('déjà sur l’écran Codex → déplacement en place (compendiumFocus), pas de modale', () => {
    useGame.setState({ screen: 'compendium', codexOverlay: null });
    useGame.getState().openCodex({ category: 'skills', id: 'savoir', label: 'Savoir' });
    expect(useGame.getState().screen).toBe('compendium');
    expect(useGame.getState().compendiumFocus).toEqual({ category: 'skills', id: 'savoir', label: 'Savoir' });
    expect(useGame.getState().codexOverlay).toBeNull();
  });

  it('cross-réf DANS la modale → plonge dans la modale (codexOverlay mis à jour)', () => {
    useGame.setState({ screen: 'campaign', codexOverlay: { category: 'talents', id: 'a', label: 'A' } });
    useGame.getState().openCodex({ category: 'spells', id: 'b', label: 'B' });
    expect(useGame.getState().screen).toBe('campaign');
    expect(useGame.getState().codexOverlay).toEqual({ category: 'spells', id: 'b', label: 'B' });
  });

  it('closeCodexOverlay ferme la modale', () => {
    useGame.setState({ codexOverlay: { category: 'talents', id: 'a', label: 'A' } });
    useGame.getState().closeCodexOverlay();
    expect(useGame.getState().codexOverlay).toBeNull();
  });
});
