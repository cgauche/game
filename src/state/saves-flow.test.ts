/**
 * Jalon 5 — Sauvegarde/chargement de partie : snapshot zéro-maintenance (clés de données de
 * getInitialState), localStorage 3 slots, export/import JSON, refus en combat.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { useGame } from './store';
import { readSlot, deleteSlot, exportSave, importSave, listSaves, saveToSlot, migrateSave, MIGRATIONS, SAVE_VERSION, type SaveGame } from './saves';
import { migrateDoc } from './migrateDoc';
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
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'Sauvé', rng: makeRNG(4) });
    useGame.setState({ party: [hero], battle: null });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); deleteSlot(1); deleteSlot(2); deleteSlot(3); loadRuleOverrides({}); });

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

  it('MIGRATION v1→v2 : une save d’AVANT la carte de campagne (worldMap vide) ne l’écrase pas au chargement', () => {
    // Recette « la map n’apparaît pas » : l’ancienne campagne sauvait worldMap {places: []} ;
    // au chargement, cette carte vide écrasait celle du projet courant → plus de bouton 🗺️.
    // Écrit une save v1 BRUTE (avant migration) dans le slot — simule une vraie relecture localStorage.
    expect(useGame.getState().saveGame(2)).toBe(true);
    const v2 = readSlot(2)!;
    const v1 = { ...v2, version: 1, data: { ...v2.data, worldMap: { id: 'campagne-carte', nom: 'Carte du monde', places: [], routes: [] } } };
    saveToSlot(2, v1 as unknown as SaveGame); // save v1 BRUTE (avant migration), telle qu'écrite en localStorage
    expect(useGame.getState().loadGame(2)).toBe(true);
    const wm = useGame.getState().worldMap!;
    expect(wm.places.length).toBeGreaterThan(0); // la carte de CAMPAGNE est conservée
    // … et une save v1 SANS worldMap du tout (clé absente) garde aussi la carte de base.
    const v1NoMap = { ...v1, data: { ...v1.data } };
    delete (v1NoMap.data as Record<string, unknown>).worldMap;
    saveToSlot(2, v1NoMap as unknown as SaveGame);
    expect(useGame.getState().loadGame(2)).toBe(true);
    expect(useGame.getState().worldMap?.places.length).toBeGreaterThan(0);
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
    // importGame applique la save importée à l'état.
    useGame.setState({ flags: {}, scene: null, screen: 'menu' });
    expect(useGame.getState().importGame(json)).toBe(true);
    expect(useGame.getState().scene?.id).toBe(testScene.id);
  });
});

describe('migrateSave — point d’upgrade unique (un bump de version ne jette plus les saves)', () => {
  const cur = { version: SAVE_VERSION, savedAt: '2026', sceneLabel: 's', gameTime: 0, data: {} };
  it('save à la version courante : passe telle quelle (aucune migration à appliquer)', () => {
    expect(migrateSave(cur)).toEqual(cur);
  });
  it('version FUTURE (plus récente que l’app) → null : on ne devine pas une structure inconnue', () => {
    expect(migrateSave({ ...cur, version: SAVE_VERSION + 1 })).toBeNull();
  });
  it('version antérieure sans migrateur → null (refus net plutôt que corruption silencieuse)', () => {
    expect(migrateSave({ ...cur, version: 0 })).toBeNull();
  });
  it('objet malformé / version absente → null', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave('pas un objet')).toBeNull();
    expect(migrateSave({ savedAt: 'x', data: {} })).toBeNull(); // version absente
  });
});

describe('Golden saves — fixtures réelles (__fixtures__/saves/) + cliquet de migration', () => {
  const FIXTURES_DIR = new URL('./__fixtures__/saves/', import.meta.url);
  const fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));

  it('au moins une fixture existe (le cliquet ne peut pas passer trivialement)', () => {
    expect(fixtureFiles.length).toBeGreaterThan(0);
  });

  for (const file of fixtureFiles) {
    it(`fixture ${file} : migre via migrateDoc puis charge (applyLoadedSave) sans erreur`, () => {
      const raw = JSON.parse(readFileSync(new URL(file, FIXTURES_DIR), 'utf-8')) as unknown;
      const migrated = migrateSave(raw);
      expect(migrated).not.toBeNull();
      expect(migrated!.version).toBe(SAVE_VERSION);
      useGame.setState({ party: [], flags: {}, gameTime: 0, journal: [], scene: null, screen: 'menu' });
      expect(useGame.getState().loadGame instanceof Function).toBe(true);
      // Charge la save déjà migrée directement dans le slot (contourne l'écriture disque, exerce
      // le MÊME chemin `readSlot` → `migrateSave` → `applyLoadedSave` que loadGame(slot)).
      expect(saveToSlot(1, migrated!)).toBe(true);
      expect(useGame.getState().loadGame(1)).toBe(true);
      // La preuve motivant la migration v1→v2 : le worldMap vide de la fixture v1 (format pré-migration,
      // conservée pour le cliquet) ne subsiste pas — la carte de campagne (non vide) de la base est restaurée.
      expect(useGame.getState().worldMap?.places.length).toBeGreaterThan(0);
    });
  }

  it('CLIQUET : chaque version 1..SAVE_VERSION-1 a AU MOINS une fixture ET une entrée MIGRATIONS — bump sans les deux = suite rouge', () => {
    for (let v = 1; v < SAVE_VERSION; v++) {
      expect(MIGRATIONS[v], `MIGRATIONS[${v}] manquante — un bump de SAVE_VERSION exige son migrateur`).toBeTypeOf('function');
      const hasFixture = fixtureFiles.some((f) => f.startsWith(`v${v}-`));
      expect(hasFixture, `aucune fixture v${v}-*.json — un bump de SAVE_VERSION exige sa fixture golden`).toBe(true);
    }
  });

  it('migrateDoc (primitive générique) réexpose EXACTEMENT la sémantique de migrateSave sur une fixture', () => {
    const raw = JSON.parse(readFileSync(new URL(fixtureFiles[0], FIXTURES_DIR), 'utf-8')) as unknown;
    const viaPrimitive = migrateDoc(raw, SAVE_VERSION, MIGRATIONS);
    const viaSaves = migrateSave(raw);
    expect(viaPrimitive).toEqual(viaSaves);
  });

  // Le filet de #311 (migration CharKey→slugs) : les 2 fixtures ci-dessous sont générées par le
  // VRAI chemin de sérialisation (`saveGame`, cf. `_generate.test.ts`) — un futur renommage de champ
  // sans migrateur les casse ici, avant de casser une vraie save de joueur.
  function loadFixture(name: string): SaveGame {
    const raw = JSON.parse(readFileSync(new URL(name, FIXTURES_DIR), 'utf-8')) as unknown;
    const migrated = migrateSave(raw);
    expect(migrated, `${name} : migration/validation refusée`).not.toBeNull();
    useGame.setState({ party: [], flags: {}, gameTime: 0, journal: [], scene: null, screen: 'menu' });
    expect(saveToSlot(1, migrated!)).toBe(true);
    expect(useGame.getState().loadGame(1)).toBe(true);
    return migrated!;
  }

  it('fixture voyage maritime : party jouable + vessel/plan cohérents + scène présente', () => {
    loadFixture('v2-voyage-maritime.json');
    const s = useGame.getState();
    expect(s.party.length).toBeGreaterThan(0);
    for (const hero of s.party) expect(hero.wounds.current).toBeGreaterThanOrEqual(0);
    expect(s.vessel).not.toBeNull();
    expect(s.vessel!.wounds!.current).toBeGreaterThan(0);
    expect(s.travelPlan).not.toBeNull();
    expect(s.travelPlan!.vehicle!.wounds.current).toBe(s.vessel!.wounds!.current); // #296 non-divergence
    expect(s.scene).not.toBeNull();
    expect(s.worldMap?.places.length).toBeGreaterThan(0);
  });

  it('fixture post-combat : roster complet jouable + scène/campagne présentes', () => {
    loadFixture('v2-post-combat-roster.json');
    const s = useGame.getState();
    expect(s.party.length).toBe(4);
    for (const hero of s.party) {
      expect(hero.wounds.current).toBeGreaterThan(0); // jouable, pas Hors combat
      expect(hero.wounds.current).toBeLessThanOrEqual(hero.wounds.max);
    }
    expect(s.battle).toBeNull(); // post-combat : plus de bataille suspendue
    expect(s.scene).not.toBeNull();
    expect(s.scene?.id).toBe('test-fixture');
  });

  // #275 Ronde 2 cran 3 — MIGRATIONS[3] (v3→v4) : voyage maritime EN VOL sous l'ancien mécanisme
  // (`sea.step` FSM + `pendingCrewTest.voyage`) — arbitrage SIMPLE accepté (décision e) : la migration
  // DROPPE l'état en vol (jamais ne le corrompt/duplique) plutôt que de reconstruire le point de reprise
  // exact — la journée reprend PROPREMENT au prochain `runSeaDay` (Test de Progression du jour).
  it('fixture v3 EN VOL (Test d’équipage de voyage ouvert, jour mi-parcours) : pendingCrewTest droppé, jour remis à son état de départ', () => {
    const migrated = loadFixture('v3-voyage-maritime-en-vol.json');
    const s = useGame.getState();
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(s.pendingCrewTest).toBeNull(); // ancien Test de voyage — jamais réinjecté en combat
    const sea = s.travelPlan!.sea! as unknown as Record<string, unknown>;
    expect(sea.step).toBeUndefined(); // FSM mort — aucune trace du point de reprise périmé
    expect(sea.milesToday).toBe(0);
    expect(sea.sailsDown).toBe(false);
    expect(sea.lighthouseDR).toBe(0);
    expect(sea.entries).toEqual([]);
    // La traversée reste JOUABLE : un nouveau jour peut démarrer proprement depuis cet état.
    expect(s.travelPlan!.vehicle).toBeTruthy();
    expect(s.vessel).not.toBeNull();
  });

  // #327 lot C — MIGRATIONS[4] (v4→v5) : le convoi abstrait `caravanCargo` est MATÉRIALISÉ sur un porteur
  // réel (ici la bête de bât du groupe) et la clé disparaît — plus de vrac de groupe hors porteur.
  it('fixture v4 convoi terrestre : caravanCargo rehébergé sur la bête de bât, clé supprimée', () => {
    loadFixture('v4-convoi-terrestre.json');
    const s = useGame.getState();
    expect((s as unknown as Record<string, unknown>).caravanCargo).toBeUndefined(); // champ retiré du modèle
    const mule = s.party[0].items!.find((i) => i.uid === 'mule-1')!;
    expect(mule.cargo).toEqual([{ cargoId: 'vin', enc: 20, basePriceGold: 5 }]); // rehébergé sur ItemInstance.cargo
  });
});
