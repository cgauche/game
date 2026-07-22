import { describe, it, expect, beforeEach } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { useGame } from '../../store';
import { readSlot, deleteSlot, SAVE_VERSION } from '../../saves';
import { makePregens } from '../../../data/pregens';
import { buildSeaPlan } from '../../seaVoyageFlow';
import { seedBattleRng } from '../../battleRng';
import type { WorldMap } from '../../worldMap';

/**
 * GÉNÉRATEUR de fixtures golden (#301) — jamais exécuté en CI (nom `_generate`, hors pattern
 * `*-flow.test.ts`/suite normale ; lancé À LA MAIN). Écrit sur disque via le VRAI chemin de
 * sérialisation (`saveGame` → `readSlot`), jamais une save composée à la main.
 *
 * Procédure pour ajouter/régénérer une fixture :
 * 1. Construire un état de jeu réaliste via `useGame.setState` (mêmes helpers que les autres
 *    suites de `src/state/*.test.ts` — `makePregens`, `buildSeaPlan`, `startCombat`…).
 * 2. Appeler `useGame.getState().saveGame(slot)` (jamais construire un `SaveGame` à la main).
 * 3. Relire avec `readSlot(slot)` et écrire le JSON tel quel (`JSON.stringify(save, null, 2)`)
 *    sous `v${SAVE_VERSION}-<nom>.json`.
 * 4. Lancer `npx vitest run src/state/__fixtures__/saves/_generate.test.ts` puis vérifier le
 *    fichier écrit avec `git diff` avant de le committer.
 * 5. Le cliquet de `saves-flow.test.ts` (« CLIQUET ») exige au moins une fixture `v${N}-*.json`
 *    par version passée — un bump de `SAVE_VERSION` réclame une NOUVELLE fixture à la version
 *    courante en plus de son migrateur.
 */
const DIR = new URL('./', import.meta.url);

/** Fake Storage minimal — même patron que `saves-flow.test.ts` (environnement `node`, pas de localStorage). */
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

function write(name: string, slot: 1 | 2 | 3) {
  const save = readSlot(slot)!;
  expect(save.version).toBe(SAVE_VERSION);
  mkdirSync(DIR, { recursive: true });
  writeFileSync(new URL(`v${SAVE_VERSION}-${name}.json`, DIR), JSON.stringify(save, null, 2) + '\n', 'utf-8');
}

describe.skip('génération des fixtures golden (à lancer À LA MAIN, jamais en CI)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });

  it('voyage maritime : navire de campagne + équipage (le groupe) + plan de traversée actif', () => {
    seedBattleRng(1);
    const seaMap: WorldMap = {
      id: 'campagne-carte', nom: 'Carte du monde',
      places: [
        { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
        { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
      ],
      routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
    };
    useGame.setState({
      party: makePregens().slice(0, 4),
      scene: { id: 'port-a', nom: 'Port de Salzenmund', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never,
      battle: null,
      worldMap: seaMap,
      travelPlan: null, travelRecap: null,
      pendingCrewTest: null, pendingRest: null,
      gameTime: 8 * 60, lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 68, lastMoraleWeek: 0, factors: [] }, wounds: { current: 42, max: 50 } },
      journal: ['Appareillage de Salzenmund vers Erengrad.'],
    } as never);
    const get = useGame.getState.bind(useGame);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    useGame.setState({ travelPlan: plan });
    deleteSlot(1);
    expect(useGame.getState().saveGame(1)).toBe(true);
    write('voyage-maritime', 1);
  });

  it('post-combat : roster complet (4), blessures/xp d’un affrontement tout juste résolu', () => {
    const heroes = makePregens();
    expect(heroes.length).toBeGreaterThanOrEqual(4);
    const party = heroes.slice(0, 4).map((h, i) => ({
      ...h,
      wounds: { ...h.wounds, current: Math.max(1, h.wounds.max - (i + 1) * 2) },
      xp: (h.xp ?? 0) + 40,
      advantage: 0,
    }));
    useGame.setState({
      party,
      battle: null,
      pendingVictory: null,
      screen: 'campaign',
      scene: {
        id: 'test-fixture', nom: 'Clairière des Mutants', description: 'Scène de test.',
        dimensions: { w: 8, h: 8 }, ambiance: 'exterieur',
        layers: [{ z: 0, tiles: Array(64).fill('herbe') }],
        entities: [{ id: 'start', kind: 'heroStart', pos: { x: 4, y: 4 } }],
        dialogues: [], triggers: [], encounters: [], flags: {},
      } as never,
      journal: [
        'Combat engagé contre 3 mutants.',
        'Victoire ! Le groupe est vainqueur.',
        '120 PX et 15 PO récupérés sur les dépouilles.',
      ],
      gameTime: 15 * 60 + 30,
      lastUpkeepDay: 2,
      money: { gold: 15, silver: 3, brass: 0 },
      flags: { 'clairiere-nettoyee': true },
    } as never);
    deleteSlot(2);
    expect(useGame.getState().saveGame(2)).toBe(true);
    write('post-combat-roster', 2);
  });

  it('objectif courant sans échéance (#668, cas v13 réel, pré-deadline)', () => {
    useGame.setState({
      party: makePregens().slice(0, 1),
      battle: null,
      scene: {
        id: 'test-fixture', nom: 'Clairière des Mutants', description: 'Scène de test.',
        dimensions: { w: 8, h: 8 }, ambiance: 'exterieur',
        layers: [{ z: 0, tiles: Array(64).fill('herbe') }],
        entities: [{ id: 'start', kind: 'heroStart', pos: { x: 4, y: 4 } }],
        dialogues: [], triggers: [], encounters: [], flags: {},
      } as never,
      gameTime: 10 * 60,
      objectives: [{ id: 'obj-quete', text: 'Retrouver le Grimm' }],
    } as never);
    deleteSlot(3);
    expect(useGame.getState().saveGame(3)).toBe(true);
    write('objectif-sans-echeance', 3);
  });
});
