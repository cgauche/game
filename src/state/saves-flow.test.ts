/**
 * Jalon 5 — Sauvegarde/chargement de partie : snapshot zéro-maintenance (clés de données de
 * getInitialState), localStorage 3 slots, export/import JSON, refus en combat.
 *
 * Plus la POLITIQUE DE VERSION (arbitrage utilisateur 2026-08-17) : une save dont la version diffère
 * de `SAVE_VERSION` est REJETÉE et RETIRÉE du stockage, avec un témoin de message pour le joueur.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGame } from './store';
import { readSlot, deleteSlot, exportSave, importSave, listSaves, saveToSlot, parseSave, takeObsoleteNotice, SAVE_VERSION, type SaveGame } from './saves';
import { rule, setRule, loadRuleOverrides } from '../engine/policy';
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
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sauvé', rng: makeRNG(4) });
    useGame.setState({ party: [hero], battle: null });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); deleteSlot(1); deleteSlot(2); deleteSlot(3); loadRuleOverrides({}); takeObsoleteNotice(); });

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
    expect(after.party[0]?.label).toBe('Sauvé');
    expect(after.party[0]?.wounds.current).toBe(3);
    expect(after.scene?.id).toBe(testScene.id);
    expect(after.screen).toBe('campaign');
    after.log('le store répond'); // les actions n'ont pas été écrasées par le merge
    const j = useGame.getState().journal;
    expect(j[j.length - 1]).toBe('le store répond');
  });

  it('règles maison : la save porte les surcharges et les restaure au chargement (portabilité)', () => {
    const id = 'test-critiques-doubles'; // un flag optionnel quelconque
    loadRuleOverrides({}); // baseline propre
    const def = rule(id) as boolean; // défaut RAW du registre
    setRule(id, !def); // l'utilisateur active la règle maison
    expect(useGame.getState().saveGame(1)).toBe(true);
    expect(readSlot(1)!.rules?.[id]).toBe(!def); // la surcharge voyage DANS la save
    loadRuleOverrides({}); // « autre machine » : aucune règle maison locale → défaut
    expect(rule(id)).toBe(def);
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(rule(id)).toBe(!def); // … restaurée par le chargement
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
    expect(importSave(JSON.stringify({ version: SAVE_VERSION - 1, savedAt: 'x', data: {} }))).toBeNull();
    // importGame applique la save importée à l'état.
    useGame.setState({ flags: {}, scene: null, screen: 'menu' });
    expect(useGame.getState().importGame(json)).toBe(true);
    expect(useGame.getState().scene?.id).toBe(testScene.id);
  });
});

describe('parseSave — la version DOIT être la courante', () => {
  const cur = { version: SAVE_VERSION, savedAt: '2026', sceneLabel: 's', gameTime: 0, data: {} };
  it('save à la version courante : acceptée telle quelle', () => {
    expect(parseSave(cur)).toEqual(cur);
  });
  it('version FUTURE (plus récente que l’app) → null', () => {
    expect(parseSave({ ...cur, version: SAVE_VERSION + 1 })).toBeNull();
  });
  it('version ANTÉRIEURE → null (aucune migration : la save se jette)', () => {
    expect(parseSave({ ...cur, version: SAVE_VERSION - 1 })).toBeNull();
    expect(parseSave({ ...cur, version: 1 })).toBeNull();
  });
  it('objet malformé / version absente → null', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('pas un objet')).toBeNull();
    expect(parseSave({ savedAt: 'x', data: {} })).toBeNull(); // version absente
  });
});

// Arbitrage utilisateur 2026-08-17 : un changement de forme persistée bump `SAVE_VERSION` et RIEN
// d'autre. Une save d'une autre version ne se migre pas — elle se JETTE, message au joueur.
describe('POLITIQUE DE VERSION — une save d’une autre version est jetée, jamais migrée', () => {
  const legacyKey = (v: number, slot: number) => `wfrp4.save.v${v}.${slot}`;
  const futureKey = (slot: number) => `wfrp4.save.future.${slot}`;
  const stableKey = (slot: number) => `wfrp4.save.${slot}`;
  const save = (version: number, sceneLabel = 'Ancienne') => ({ version, savedAt: '2026-08-17', sceneLabel, gameTime: 3, data: { flags: { 'drapeau-x': true } } });
  const ls = () => (globalThis as { localStorage: Storage }).localStorage;

  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    takeObsoleteNotice(); // témoin remis à zéro entre les cas
  });

  it('save v26 (version antérieure) : REJETÉE, RETIRÉE du stockage, témoin « anterieure » posé', () => {
    ls().setItem(stableKey(1), JSON.stringify(save(SAVE_VERSION - 1)));
    expect(readSlot(1)).toBeNull();
    expect(ls().getItem(stableKey(1))).toBeNull(); // la donnée est SUPPRIMÉE, pas laissée à pourrir
    expect(takeObsoleteNotice()).toBe('anterieure');
    expect(takeObsoleteNotice()).toBeNull(); // témoin à usage unique
  });

  it('save v27 (version courante) : chargée normalement, rien de jeté, aucun message', () => {
    ls().setItem(stableKey(2), JSON.stringify(save(SAVE_VERSION, 'Courante')));
    expect(readSlot(2)?.sceneLabel).toBe('Courante');
    expect(ls().getItem(stableKey(2))).not.toBeNull();
    expect(takeObsoleteNotice()).toBeNull();
  });

  it('loadGame sur une save v26 : refusé, l’état courant INTACT, l’emplacement vidé', () => {
    useGame.setState({ flags: { 'drapeau-vivant': true } });
    ls().setItem(stableKey(1), JSON.stringify(save(SAVE_VERSION - 1)));
    expect(useGame.getState().loadGame(1)).toBe(false);
    expect(useGame.getState().flags['drapeau-vivant']).toBe(true);
    expect(useGame.getState().flags['drapeau-x']).toBeUndefined();
    expect(listSaves()[0]).toBeNull();
    expect(takeObsoleteNotice()).toBe('anterieure');
  });

  it('clé VERSIONNÉE historique (#898) : jetée elle aussi — aucune n’a jamais porté la version courante', () => {
    ls().setItem(legacyKey(14, 1), JSON.stringify(save(14)));
    expect(readSlot(1)).toBeNull();
    expect(ls().getItem(legacyKey(14, 1))).toBeNull();
    expect(takeObsoleteNotice()).toBe('anterieure');
  });

  // La clé de QUARANTAINE `wfrp4.save.future.N` était écrite par le code d'AVANT l'arbitrage (une save
  // plus récente y était mise de côté avant écrasement). Personne ne l'écrit plus : elle se JETTE
  // comme le reste, sans quoi la donnée que l'arbitrage ordonne de supprimer survivrait indéfiniment.
  it('clé de QUARANTAINE historique : purgée à la lecture, témoin « future »', () => {
    ls().setItem(futureKey(1), JSON.stringify(save(SAVE_VERSION + 1, 'Futur')));
    expect(readSlot(1)).toBeNull();
    expect(ls().getItem(futureKey(1))).toBeNull();
    expect(takeObsoleteNotice()).toBe('future');
  });

  it('clé de QUARANTAINE à côté d’une save COURANTE : la save se charge, la clé résiduelle est nettoyée', () => {
    ls().setItem(stableKey(1), JSON.stringify(save(SAVE_VERSION, 'Courante')));
    ls().setItem(futureKey(1), JSON.stringify(save(SAVE_VERSION + 1, 'Futur')));
    expect(readSlot(1)?.sceneLabel).toBe('Courante');
    expect(ls().getItem(futureKey(1))).toBeNull();
  });

  it('save FUTURE (plus récente que le code) : jetée aussi, témoin « future » (le message ne ment pas)', () => {
    ls().setItem(stableKey(3), JSON.stringify(save(SAVE_VERSION + 1, 'Futur')));
    expect(readSlot(3)).toBeNull();
    expect(ls().getItem(stableKey(3))).toBeNull();
    expect(takeObsoleteNotice()).toBe('future');
  });

  it('contenu illisible / forme sans version : jeté, témoin « illisible » — jamais un crash', () => {
    ls().setItem(stableKey(1), 'pas du json');
    expect(readSlot(1)).toBeNull();
    expect(ls().getItem(stableKey(1))).toBeNull();
    expect(takeObsoleteNotice()).toBe('illisible');

    ls().setItem(stableKey(1), JSON.stringify({ foo: 'bar' }));
    expect(readSlot(1)).toBeNull();
    expect(ls().getItem(stableKey(1))).toBeNull();
    expect(takeObsoleteNotice()).toBe('illisible');
  });

  it('emplacement VIDE : ni message ni bruit', () => {
    expect(readSlot(1)).toBeNull();
    expect(listSaves()).toEqual([null, null, null]);
    expect(takeObsoleteNotice()).toBeNull();
  });

  it('saveToSlot écrase une save d’une autre version, sans quarantaine', () => {
    ls().setItem(stableKey(1), JSON.stringify(save(SAVE_VERSION + 1, 'Futur')));
    const neuve = { version: SAVE_VERSION, savedAt: '2026-08-17', sceneLabel: 'Nouveau', gameTime: 0, data: {} } as SaveGame;
    expect(saveToSlot(1, neuve)).toBe(true);
    expect(readSlot(1)?.sceneLabel).toBe('Nouveau');
    expect(ls().getItem(futureKey(1))).toBeNull(); // rien n'est mis de côté : la save future est perdue, comme ordonné
  });

  it('deleteSlot nettoie la clé stable, la clé de quarantaine ET les clés versionnées historiques', () => {
    ls().setItem(stableKey(1), JSON.stringify(save(SAVE_VERSION)));
    ls().setItem(legacyKey(14, 1), JSON.stringify(save(14)));
    ls().setItem(futureKey(1), JSON.stringify(save(SAVE_VERSION + 1)));
    deleteSlot(1);
    expect(ls().getItem(stableKey(1))).toBeNull();
    expect(ls().getItem(legacyKey(14, 1))).toBeNull();
    expect(ls().getItem(futureKey(1))).toBeNull();
  });
});
