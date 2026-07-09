import { describe, it, expect } from 'vitest';
import { builtinCampaigns } from './campaign';

/**
 * Registre des campagnes BUILT-IN (#211) : « Nouvelle partie → Changer » les liste toutes via
 * `CampaignSelect` (`ui/PartyScreen.tsx`), au MÊME mécanisme que les projets publiés de l'éditeur
 * (`pendingCampaign` + `loadProject`) — jamais un chemin parallèle.
 */
describe('builtinCampaigns — registre des campagnes exposées au picker', () => {
  it('« Le Loup et la Saumure » y est enregistrée, projet valide', () => {
    const loup = builtinCampaigns.find((c) => c.id === 'loup-et-saumure');
    expect(loup).toBeTruthy();
    expect(loup!.scenes.length).toBeGreaterThan(0);
    expect(loup!.startSceneId).toBe(loup!.scenes[0].id);
    expect(loup!.worldMap).toBeTruthy();
  });

  it('chaque campagne BUILT-IN a un id/nom uniques et une scène de départ RÉELLE', () => {
    const ids = builtinCampaigns.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of builtinCampaigns) {
      expect(c.scenes.some((s) => s.id === c.startSceneId), `${c.id} : startSceneId résout une scène`).toBe(true);
    }
  });
});
