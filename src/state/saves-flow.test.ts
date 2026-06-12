/**
 * Jalon 5 — Sauvegarde/chargement de partie : snapshot zéro-maintenance (clés de données de
 * getInitialState), localStorage 3 slots, export/import JSON, refus en combat.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGame } from './store';
import { readSlot, deleteSlot, exportSave, importSave, listSaves, saveToSlot, SAVE_VERSION } from './saves';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

describe('Sauvegarde / chargement (Jalon 5)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    vi.useFakeTimers();
    vi.clearAllTimers();
    deleteSlot(1); deleteSlot(2); deleteSlot(3);
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Sauvé', rng: makeRNG(4) });
    useGame.setState({ party: [hero], battle: null });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); deleteSlot(1); deleteSlot(2); deleteSlot(3); });

  it('saveGame → slot rempli avec métadonnées (scène, horloge) ; listSaves le voit', () => {
    useGame.setState({ flags: { ...useGame.getState().flags, 'drapeau-test': true } });
    expect(useGame.getState().saveGame(1)).toBe(true);
    const s = readSlot(1)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.sceneLabel).toBe(testScene.nom); // le NOM de la scène, pas son id
    expect(s.sceneLabel.length).toBeGreaterThan(0);
    expect((s.data.flags as Record<string, unknown>)['drapeau-test']).toBe(true);
    const metas = listSaves();
    expect(metas[0]?.slot).toBe(1);
    expect(metas[1]).toBeNull();
  });

  it('round-trip : muter → sauver → réinitialiser → charger restaure données + actions vivantes', () => {
    useGame.setState({ flags: { ...useGame.getState().flags, 'quete-x': true }, gameTime: 12345, journal: ['ligne de test'] });
    useGame.getState().party[0].wounds.current = 3;
    expect(useGame.getState().saveGame(2)).toBe(true);
    // « Nouvelle partie » : tout est réinitialisé.
    useGame.setState({ party: [], flags: {}, gameTime: 0, journal: [], scene: null, screen: 'menu' });
    expect(useGame.getState().loadGame(2)).toBe(true);
    const after = useGame.getState();
    expect(after.flags['quete-x']).toBe(true);
    expect(after.gameTime).toBe(12345);
    expect(after.party[0]?.name).toBe('Sauvé');
    expect(after.party[0]?.wounds.current).toBe(3);
    expect(after.scene?.id).toBe(testScene.id);
    expect(after.screen).toBe('campaign');
    after.log('le store répond'); // les actions n'ont pas été écrasées par le merge
    const j = useGame.getState().journal;
    expect(j[j.length - 1]).toBe('le store répond');
  });

  it('MIGRATION : une save d’AVANT la carte de campagne (worldMap vide) ne l’écrase pas au chargement', () => {
    // Recette « la map n’apparaît pas » : l’ancienne campagne sauvait worldMap {places: []} ;
    // au chargement, cette carte vide écrasait celle du projet courant → plus de bouton 🗺️.
    expect(useGame.getState().saveGame(2)).toBe(true);
    const slot = readSlot(2)!;
    slot.data.worldMap = { id: 'campagne-carte', nom: 'Carte du monde', places: [], routes: [] }; // save legacy
    saveToSlot(2, slot);
    expect(useGame.getState().loadGame(2)).toBe(true);
    const wm = useGame.getState().worldMap!;
    expect(wm.places.length).toBeGreaterThan(0); // la carte de CAMPAGNE est conservée
    // … et une save SANS worldMap du tout (clé absente) garde aussi la carte de base.
    delete slot.data.worldMap;
    saveToSlot(2, slot);
    expect(useGame.getState().loadGame(2)).toBe(true);
    expect(useGame.getState().worldMap?.places.length).toBeGreaterThan(0);
  });

  it('en combat : sauvegarde refusée, le slot reste vide', () => {
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    expect(useGame.getState().saveGame(1)).toBe(false);
    expect(readSlot(1)).toBeNull();
  });

  it('export / import : round-trip JSON validé ; version inconnue rejetée', () => {
    expect(useGame.getState().saveGame(3)).toBe(true);
    const json = exportSave(readSlot(3)!);
    const re = importSave(json);
    expect(re?.sceneLabel).toBe(readSlot(3)!.sceneLabel);
    expect(importSave('{pas du json')).toBeNull();
    expect(importSave(JSON.stringify({ version: 999, savedAt: 'x', data: {} }))).toBeNull();
    // importGame applique la save importée à l'état.
    useGame.setState({ flags: {}, scene: null, screen: 'menu' });
    expect(useGame.getState().importGame(json)).toBe(true);
    expect(useGame.getState().scene?.id).toBe(testScene.id);
  });
});
