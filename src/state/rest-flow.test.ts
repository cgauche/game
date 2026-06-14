/**
 * Modale de REPOS (state/restFlow) : offre par lieu/zone, choix PAR HÉROS (couchage + pitance,
 * orthogonaux), coût RAW (LDB ch.66), Exposition d'un campement (LDB 18 l.408-415). Une NUIT UNIQUE
 * passe désormais par la CASCADE séquentielle influençable (chaque jet = une étape, verrouillée à
 * « Valider » avant le suivant) ; le moteur de nuit `sleepParty` (multi-jours/eager) reste testé par
 * rest.test / upkeep-cascade.
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

/** Déroule la cascade de nuit (lance + valide chaque étape) jusqu'à la fin ; renvoie les `kind` vus
 *  (les étapes INSÉRÉES en cours de route — Exposition après l'abri — y figurent). */
function walkCascade(): string[] {
  const kinds: string[] = [];
  let guard = 0;
  while (useGame.getState().pendingCascade && guard++ < 60) {
    const p = useGame.getState().pendingCascade!;
    const cur = p.participants[p.cursor];
    kinds.push(cur.kind);
    if (cur.target != null && !cur.result) useGame.getState().cascadeRoll(cur.id);
    useGame.getState().cascadeNext();
  }
  return kinds;
}

/** Force l'abri de fortune à ÉCHOUER (pour exercer l'Exposition) : verrouille un échec sur l'étape
 *  courante avant de la valider. Renvoie les `kind` de la suite. */
function walkCascadeAbriFails(): string[] {
  const kinds: string[] = [];
  let guard = 0;
  while (useGame.getState().pendingCascade && guard++ < 60) {
    const p = useGame.getState().pendingCascade!;
    const cur = p.participants[p.cursor];
    kinds.push(cur.kind);
    if (cur.target != null && !cur.result) {
      // Échec garanti : dé 100 (raté), DR négatif — l'abri ne protège pas.
      const parts = p.participants.map((s) => (s.id === cur.id ? { ...s, result: { roll: 100, target: cur.target!, sl: -5, success: false } } : s));
      useGame.setState({ pendingCascade: { ...p, participants: parts } });
    }
    useGame.getState().cascadeNext();
  }
  return kinds;
}

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
    // Nuit UNIQUE → CASCADE (plus de bilan) : météo clémente → seulement les jets de récupération.
    expect(useGame.getState().pendingRest).toBeNull();
    const cas = useGame.getState().pendingCascade!;
    expect(cas.participants.length).toBe(2); // 2 héros à soigner (8/12 PB)
    expect(cas.participants.every((s) => s.kind === 'recovery')).toBe(true);
    walkCascade();
    expect(useGame.getState().pendingCascade).toBeNull(); // cascade terminée
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
    useGame.getState().restSleep(); // gratuit → dort (cascade, plus de bilan)
    expect(useGame.getState().pendingRest).toBeNull();
    expect(useGame.getState().pendingCascade).toBeTruthy();
    expect(toBrass(useGame.getState().money)).toBe(5);
  });

  it('campement sous la pluie sans tente : ABRI raté → l’Exposition est INSÉRÉE (2 Tests/campeur)', () => {
    const sc = emptyScene(10, 10);
    sc.weather = 'pluie'; // difficile → 2 Tests/nuit si pas d'abri
    useGame.setState({ scene: sc });
    useGame.getState().openRest({ places: { camp: true } });
    useGame.getState().restSleep();
    const cas = useGame.getState().pendingCascade!;
    expect(cas.participants[0].kind).toBe('shelter'); // l'abri de fortune ouvre la séquence
    // L'Exposition n'existe PAS encore : elle est INSÉRÉE quand l'abri est validé (dépendance).
    expect(cas.participants.some((s) => s.kind === 'exposure')).toBe(false);
    const kinds = walkCascadeAbriFails(); // abri raté → campement exposé
    expect(kinds.filter((k) => k === 'exposure').length).toBe(2 * 2); // 2 héros × 2 Tests
  });

  it('avec une TENTE dans le paquetage : pas d’Exposition par nuit difficile (note de campement au journal)', () => {
    const sc = emptyScene(10, 10);
    sc.weather = 'pluie';
    useGame.setState({ scene: sc });
    useGame.getState().party[1].items!.push({ uid: 't', name: 'Tente', kind: 'misc', qualities: [], enc: 2, equipped: false } as ItemInstance);
    useGame.getState().openRest({ places: { camp: true } });
    useGame.getState().restSleep();
    const cas = useGame.getState().pendingCascade!;
    expect(cas.participants.some((s) => s.kind === 'exposure')).toBe(false); // tente → 0 Test difficile
    expect(cas.log.some((l) => /tente/i.test(l))).toBe(true); // « La tente est montée… »
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
