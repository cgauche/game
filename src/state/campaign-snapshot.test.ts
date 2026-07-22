/**
 * #766 LOT A — une SAVE de campagne est AUTO-SUFFISANTE et REJOUABLE.
 *
 * Contrat POSITIF du snapshot `campaignDoc` : après un reload (registre `sceneRegistry` en mémoire
 * module reparti de zéro — seules l'Arène + la scène courante y seraient sinon), le chargement d'une
 * save RÉ-ENREGISTRE toutes les scènes du paquet ET RE-DÉRIVE la couche narrative (`campaignNarratif`).
 * On simule le reload par `vi.resetModules()` + ré-import : le store frais n'a JAMAIS vu la scène B.
 * Sans le fix (campaignDoc absent), `transitionTo('scene-b')` échouerait (scène introuvable).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emptyScene, type Scene } from './scene';
import type { NarratifBlock } from './campaignNarratif';
import type { WorldMap } from './worldMap';
import { makePregens } from '../data/pregens';

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

/** Scène minimale (heroStart) chargeable par le chemin RÉEL (`loadProject`/`transitionTo`). */
function scene(id: string): Scene {
  const s = emptyScene(6, 6);
  s.id = id;
  s.nom = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

const OBJET_ID = 'snap-lame-maudite';
const narratif: NarratifBlock = {
  affaires: [{ id: 'snap-aff', titre: 'Le Corbeau noir' }],
  indices: [],
  presetsPnj: [{ id: 'snap-pnj', profil: {} }],
  objets: [{ id: OBJET_ID, label: 'Lame maudite', type: 'melee', subType: null } as NarratifBlock['objets'][number]],
};

const worldMap: WorldMap = {
  id: 'snap-carte', nom: 'Carte', places: [{ id: 'p', label: 'Bourg', pos: { x: 0, y: 0 }, scene: 'scene-a' }], routes: [],
};

describe('#766 — save de campagne auto-suffisante et rejouable', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    vi.resetModules();
  });

  it('reload (registre vidé) : campaignDoc re-registre la scène B → transitionTo réussit', async () => {
    // 1. Store frais : charge un projet MULTI-scènes par le chemin réel, puis sauve.
    const { useGame } = await import('./store');
    useGame.setState({ party: makePregens().slice(0, 1), battle: null });
    useGame.getState().loadProject([scene('scene-a'), scene('scene-b')], 'scene-a', worldMap, narratif);
    expect(useGame.getState().scene?.id).toBe('scene-a');
    expect(useGame.getState().campaignDoc?.scenes.map((s) => s.id)).toEqual(['scene-a', 'scene-b']);
    expect(useGame.getState().saveGame(1)).toBe(true);

    // 2. Reload : nouveau module → `sceneRegistry` reparti de zéro (Arène seule), scene-b INCONNUE.
    vi.resetModules();
    const fresh = await import('./store');
    const freshData = await import('./campaignData');
    // Registre frais : une transition vers scene-b échoue AVANT le chargement (scène jamais enregistrée).
    fresh.useGame.setState({ party: makePregens().slice(0, 1) });
    fresh.useGame.getState().loadProject([scene('scene-solo')], 'scene-solo');
    fresh.useGame.getState().transitionTo('scene-b');
    expect(fresh.useGame.getState().scene?.id).toBe('scene-solo'); // scene-b introuvable → transition ignorée

    // 3. Chargement de la save : re-registration des scènes du paquet + re-dérivation du narratif.
    expect(fresh.useGame.getState().loadGame(1)).toBe(true);
    expect(fresh.useGame.getState().scene?.id).toBe('scene-a');
    expect(fresh.useGame.getState().worldMap?.id).toBe('snap-carte'); // carte du paquet restaurée
    // La couche narrative est re-dérivée de campaignDoc.narratif (non persistée au snapshot).
    expect(freshData.presetPnjById('snap-pnj')?.id).toBe('snap-pnj');
    expect(freshData.trappingById(OBJET_ID)?.label).toBe('Lame maudite');
    // La preuve : scene-b, jamais enregistrée dans ce module, l'est de nouveau → la transition réussit.
    fresh.useGame.getState().transitionTo('scene-b');
    expect(fresh.useGame.getState().scene?.id).toBe('scene-b');
  });
});
