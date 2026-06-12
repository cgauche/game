/**
 * Modale de REPOS (state/restFlow) : offre par lieu/zone, choix PAR HÉROS (couchage + pitance,
 * orthogonaux), coût RAW (LDB ch.66), Exposition d'un campement (LDB 18 l.408-415), bilan
 * globalisé (multi-jets). Le moteur de nuit `sleepParty` est testé par rest.test / upkeep-cascade.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { restPlacesHere } from './restFlow';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './scene';
import { toBrass } from '../engine/money';
import type { Combatant, ItemInstance } from '../engine/types';

const ration = (uid: string): ItemInstance => ({ uid, name: 'Ration', kind: 'misc', qualities: [], enc: 0, equipped: false });

const hero = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h1', name: 'Hilda', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 35, Soc: 30 },
    wounds: { current: 8, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4, ...p,
  } as Combatant);

beforeEach(() => {
  vi.useFakeTimers();
  seedBattleRng(1);
  useGame.setState({
    party: [hero(), hero({ id: 'h2', name: 'Bruno', items: [ration('r1')] })],
    battle: null, pendingRest: null, scene: emptyScene(10, 10), money: { gold: 2, silver: 0, brass: 0 },
  });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('openRest / choix par héros', () => {
  it('auberge : choix PERSONNELS et orthogonaux — un héros en chambre+repas, l’autre dort dehors avec sa ration', () => {
    useGame.getState().openRest({ places: { auberge: true, camp: true } });
    const p = useGame.getState().pendingRest!;
    expect(p.perHero['h1'].lodging).toBe('privee'); // défaut auberge
    useGame.getState().restSet('h2', { lodging: 'dehors' });
    useGame.getState().restSet('h2', { food: 'ration' }); // manger sa ration et dormir à la belle étoile
    const cfg = useGame.getState().pendingRest!.perHero;
    expect(cfg['h2']).toEqual({ lodging: 'dehors', food: 'ration' });
    // Coût : 1 chambre privée (couvre 2, ici 1 occupant) 10 pa + 1 repas 1 pa = 132 sc.
    useGame.getState().restSleep();
    expect(toBrass(useGame.getState().money)).toBe(480 - 120 - 12);
    expect(useGame.getState().pendingRest?.phase).toBe('bilan');
    expect(useGame.getState().pendingRest?.slept).toBeTruthy(); // le temps écoulé est AFFICHÉ
    useGame.getState().restContinue();
    expect(useGame.getState().pendingRest).toBeNull();
  });

  it('chambres regroupées par 2 (RAW : « convient à 2 invités ») : 2 héros en privée = 1 chambre (10 pa)', () => {
    useGame.getState().openRest({ places: { auberge: true } });
    useGame.getState().restSet('h2', { lodging: 'privee' });
    useGame.getState().restSet('h1', { food: 'rien' });
    useGame.getState().restSet('h2', { food: 'rien' });
    useGame.getState().restSleep();
    expect(toBrass(useGame.getState().money)).toBe(480 - 120); // 1 chambre, 0 repas
  });

  it('bourse insuffisante : Dormir refusé (on peut alors choisir la belle étoile, gratuite)', () => {
    useGame.setState({ money: { gold: 0, silver: 0, brass: 5 } });
    useGame.getState().openRest({ places: { auberge: true, camp: true } });
    useGame.getState().restSleep(); // refus (privée + repas impayables)
    expect(useGame.getState().pendingRest?.phase).toBe('setup');
    for (const id of ['h1', 'h2']) {
      useGame.getState().restSet(id, { lodging: 'dehors' });
      useGame.getState().restSet(id, { food: 'rien' });
    }
    useGame.getState().restSleep(); // gratuit → dort
    expect(useGame.getState().pendingRest?.phase).toBe('bilan');
    expect(toBrass(useGame.getState().money)).toBe(5);
  });

  it('campement sous la pluie SANS tente ni Survie : Tests d’Exposition au bilan', () => {
    const sc = emptyScene(10, 10);
    sc.weather = 'pluie'; // difficile → 2 Tests/nuit (1 par 4 h)
    useGame.setState({ scene: sc });
    useGame.getState().openRest({ places: { camp: true } });
    useGame.getState().restSleep();
    const entries = useGame.getState().pendingRest?.results ?? [];
    expect(entries.filter((e) => e.label.startsWith('Exposition') && e.d).length).toBe(2 * 2); // 2 héros × 2 Tests
  });

  it('avec une TENTE dans le paquetage : pas d’Exposition par nuit difficile', () => {
    const sc = emptyScene(10, 10);
    sc.weather = 'pluie';
    useGame.setState({ scene: sc });
    useGame.getState().party[1].items!.push({ uid: 't', name: 'Tente', kind: 'misc', qualities: [], enc: 2, equipped: false } as ItemInstance);
    useGame.getState().openRest({ places: { camp: true } });
    useGame.getState().restSleep();
    const entries = useGame.getState().pendingRest?.results ?? [];
    expect(entries.some((e) => e.label === 'Campement')).toBe(true); // tente montée
    expect(entries.some((e) => e.label.startsWith('Exposition'))).toBe(false);
  });
});

describe('restPlacesHere — offre paramétrable sur la ZONE', () => {
  it('zone de repos prioritaire sur la scène ; scène sans rien = camp ; tout à false = interdit', () => {
    const sc = emptyScene(10, 10);
    sc.rest = { camp: true };
    sc.restZones = [{ rect: { x: 0, y: 0, w: 3, h: 3 }, places: { auberge: true }, quality: 'pietre' }];
    // Dans la zone (0-2) : l'auberge piètre du quartier.
    let here = restPlacesHere({ scene: sc, partyPos: { x: 1, y: 1 } } as never);
    expect(here).toEqual({ places: { auberge: true }, quality: 'pietre' });
    // Hors zone : l'offre de la scène (camp).
    here = restPlacesHere({ scene: sc, partyPos: { x: 5, y: 5 } } as never);
    expect(here?.places).toEqual({ camp: true });
    // Repos interdit (tout à false).
    sc.rest = { camp: false };
    expect(restPlacesHere({ scene: sc, partyPos: { x: 5, y: 5 } } as never)).toBeNull();
  });
});

describe('effet `rest` (éditeur)', () => {
  it('LEGACY sans lodging : ouvre la modale en contexte maison (gratuit) — et la nuit dort vraiment', () => {
    const t0 = useGame.getState().gameTime ?? 0;
    applyEffects(useGame.getState, useGame.setState, [{ type: 'rest' }]);
    const p = useGame.getState().pendingRest!;
    expect(p.places.maison).toBe(true);
    useGame.getState().restSleep();
    expect((useGame.getState().gameTime ?? 0)).toBeGreaterThan(t0);
  });
});
