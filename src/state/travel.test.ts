/**
 * #T2 Voyage — flux store : trajets sur la carte du monde (temps, rations, paiement, péripéties
 * d'auteur, interruption/reprise). RAW : section « Voyage » du LDB (`51 - Magie du Chaos.md`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { emptyScene, Scene } from './scene';
import { buildEncounter } from './encounterAuthoring';
import { WorldMap } from './worldMap';
import { CAMPAIGN_START } from '../engine/clock';
import { toBrass } from '../engine/money';
import { rationCount } from '../engine/provisions';
import type { Combatant, ItemInstance } from '../engine/types';

const ration = (uid: string): ItemInstance => ({ uid, name: 'Ration', kind: 'misc', qualities: [], enc: 0, equipped: false });

const hero = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h', name: 'Hilda', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 35, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4,
    ...p,
  } as Combatant);

function sceneA(): Scene {
  const s = emptyScene(10, 10);
  s.id = 'lieu-a-scene';
  s.nom = 'Village A';
  // Rencontre pour la péripétie d'auteur « brigands » (statblock → pas de dépendance bestiaire).
  const enc = buildEncounter({
    id: 'enc-test',
    enemies: [{ statblock: { name: 'Brigand', char: { CC: 30, F: 30, E: 30, I: 30, Ag: 30, B: 8 } }, pos: { x: 5, y: 5 } }],
  });
  s.entities.push(...enc.entities);
  s.encounters = [enc.encounter];
  return s;
}
function sceneB(): Scene {
  const s = emptyScene(10, 10);
  s.id = 'lieu-b-scene';
  s.nom = 'Bourg B';
  return s;
}

function map(routePatch: Partial<WorldMap['routes'][0]> = {}): WorldMap {
  return {
    id: 'carte-test', nom: 'Carte de test',
    places: [
      { id: 'pa', label: 'Village A', pos: { x: 20, y: 50 }, scene: 'lieu-a-scene' },
      { id: 'pb', label: 'Bourg B', pos: { x: 70, y: 40 }, scene: 'lieu-b-scene' },
    ],
    routes: [{ id: 'r1', a: 'pa', b: 'pb', km: 12, modes: ['pied'], perilDie: 0, ...routePatch }],
  };
}

/** Charge le projet de test (2 scènes + carte) et pose le groupe. */
function setup(worldMap: WorldMap, party: Combatant[] = [hero({ items: [ration('r1'), ration('r2'), ration('r3')] })]) {
  useGame.setState({ party });
  useGame.getState().loadProject([sceneA(), sceneB()], 'lieu-a-scene', worldMap);
}

beforeEach(() => {
  seedBattleRng(1);
});

describe('startTravel — à pied', () => {
  it('court trajet (12 km à M4, 3 h) : arrive le jour même, horloge avancée, transition vers la scène du lieu', () => {
    setup(map());
    const t0 = useGame.getState().gameTime;
    expect(t0).toBe(CAMPAIGN_START);
    useGame.getState().startTravel('r1', 'pied');
    const st = useGame.getState();
    expect(st.travelPlan).toBeNull();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(st.gameTime - t0).toBe(180); // 12 km ÷ 4 km/h = 3 h (l.222)
    expect(st.journal.some((l) => l.includes('Arrivée à Bourg B'))).toBe(true);
  });

  it('trajet multi-jours (30 km à M4) : 6 h/jour (l.224), HALTE de nuit (modale de Repos), rations consommées', () => {
    setup(map({ km: 30 }));
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'pied');
    // Nuit 1 : le voyage se SUSPEND sur la modale de Repos (campement — pas d'auberge sur la route).
    let st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-a-scene'); // toujours en route
    expect(st.pendingRest?.phase).toBe('setup');
    expect(st.pendingRest?.places.auberge).toBeFalsy();
    useGame.getState().restSleep();
    expect(useGame.getState().pendingRest?.phase).toBe('bilan');
    useGame.getState().restContinue(); // « Reprendre la route » au matin
    st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene');
    // Jour 1 : 6 h de marche (24 km) + nuit jusqu'à l'aube ; jour 2 : 1 h 30 (6 km) → > 17 h au total.
    expect(st.gameTime - t0).toBeGreaterThan(17 * 60);
    expect(st.journal.some((l) => /dort jusqu|aube/i.test(l))).toBe(true);
    // L'entretien quotidien a consommé une ration au franchissement de jour.
    expect(rationCount(st.party[0])).toBe(2);
  });

  it('route à RELAIS (inns) : la halte de nuit propose l’auberge — chambre privée débitée, puis arrivée', () => {
    setup(map({ km: 30, inns: true }));
    useGame.setState({ money: { gold: 2, silver: 0, brass: 0 } });
    useGame.getState().startTravel('r1', 'pied');
    const p = useGame.getState().pendingRest!;
    expect(p.places.auberge).toBe(true);
    expect(p.perHero[useGame.getState().party[0].id].lodging).toBe('privee'); // défaut auberge
    const before = toBrass(useGame.getState().money);
    useGame.getState().restSleep();
    expect(toBrass(useGame.getState().money)).toBe(before - 120 - 12); // chambre 10 pa + repas 1 pa
    useGame.getState().restContinue();
    expect(useGame.getState().scene?.id).toBe('lieu-b-scene');
  });

  it('la vitesse est celle du PLUS LENT (l.222) : M3 dans le groupe → 4 h pour 12 km', () => {
    setup(map(), [hero(), hero({ id: 'h2', name: 'Nain', movement: 3 })]);
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'pied');
    expect(useGame.getState().gameTime - t0).toBe(240);
  });

  it('marche forcée : une allure de 10 h/jour évite la nuit de camp sur 30 km', () => {
    setup(map({ km: 30 }));
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'pied', { hoursPerDay: 10 });
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(st.gameTime - t0).toBe(450); // 30 km ÷ 4 km/h = 7 h 30, d'une traite
    // Marche forcée (l.224) : Tests de Résistance journalisés.
    expect(st.journal.some((l) => l.includes('marche forcée'))).toBe(true);
  });
});

describe('startTravel — transports payants (l.207-219)', () => {
  it('diligence : débite prix/km × km × passagers et voyage à M6', () => {
    setup(map({ modes: ['pied', 'diligence'] })); // 12 km — bourse de départ : 5 SC = 60 PA
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'diligence', { classKey: 'exterieur' }); // 1 sou/km × 12 × 1 passager
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(toBrass(st.money)).toBe(48); // 60 − 12
    expect(st.gameTime - t0).toBe(120); // 12 km ÷ 6 km/h = 2 h
  });

  it('bourse insuffisante → voyage refusé', () => {
    setup(map({ modes: ['diligence'], prices: { diligence: 100 } })); // 1200 PA ≫ 60 PA
    useGame.getState().startTravel('r1', 'diligence', { classKey: 'interieur' });
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-a-scene'); // pas parti
    expect(st.travelPlan).toBeNull();
    expect(toBrass(st.money)).toBe(60); // rien débité
    expect(st.journal.some((l) => l.includes('dépasse les moyens'))).toBe(true);
  });

  it('vitesse d’auteur sur la route (EiS ch.1 : diligence à 3 km/h) respectée', () => {
    setup(map({ modes: ['diligence'], speed: { diligence: 3 } }));
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'diligence', { classKey: 'exterieur' });
    expect(useGame.getState().gameTime - t0).toBe(240); // 12 km ÷ 3 km/h = 4 h
  });
});

describe('péripéties d’auteur — interruption et reprise', () => {
  it('péripétie à 100 % qui démarre un combat : le RÉCIT s’affiche AVANT — le combat part à l’acquittement', () => {
    setup(map({
      km: 30,
      perils: [{ label: 'Brigands sur la route !', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-test' }] }],
    }));
    useGame.getState().startTravel('r1', 'pied');
    let st = useGame.getState();
    // DIFFÉRÉ derrière le récit : pas de combat tant que le recap n'est pas acquitté
    // (sinon on se retrouve en combat sans comprendre ce qui arrive).
    expect(st.battle).toBeNull();
    expect(st.travelRecap?.then?.kind).toBe('effects');
    expect(st.travelPlan?.interrupted).toBe(true);
    expect(st.travelPlan!.kmDone).toBeGreaterThan(0);
    expect(st.journal.some((l) => l.includes('Brigands sur la route'))).toBe(true);
    // Pas d'esquive : la reprise est REFUSÉE tant que l'embuscade attend son acquittement.
    useGame.getState().resumeTravel();
    expect(useGame.getState().travelRecap?.then).toBeTruthy();
    expect(useGame.getState().travelPlan?.interrupted).toBe(true);
    // « Faire face » : l'acquittement déclenche le combat.
    useGame.getState().dismissTravelRecap();
    st = useGame.getState();
    expect(st.battle).toBeTruthy();
    expect(st.travelRecap).toBeNull();
    // Victoire simulée → reprise (la péripétie est neutralisée pour ne pas re-déclencher).
    useGame.setState({ battle: null, mode: 'exploration' });
    const wm = useGame.getState().worldMap!;
    useGame.setState({ worldMap: { ...wm, routes: wm.routes.map((r) => ({ ...r, perils: [] })) } });
    useGame.getState().resumeTravel();
    st = useGame.getState();
    expect(st.travelPlan).toBeNull();
    expect(st.scene?.id).toBe('lieu-b-scene');
  });

  it('interrompu sur le DERNIER kilomètre (kmDone = km) : la reprise arrive sans rejouer la journée', () => {
    // 12 km à M4 = 3 h → la péripétie tombe le jour de l'arrivée ; la reprise ne doit PAS re-tirer
    // la péripétie (sinon une péripétie à 100 % boucle indéfiniment).
    setup(map({ perils: [{ label: 'Toujours là !', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-test' }] }] }));
    useGame.getState().startTravel('r1', 'pied');
    expect(useGame.getState().travelPlan?.interrupted).toBe(true);
    expect(useGame.getState().travelPlan?.kmDone).toBeCloseTo(12);
    useGame.getState().dismissTravelRecap(); // « Faire face » → le combat démarre
    expect(useGame.getState().battle).toBeTruthy();
    useGame.setState({ battle: null, mode: 'exploration' });
    useGame.getState().resumeTravel(); // péripétie TOUJOURS à 100 % — ne doit plus se déclencher
    const st = useGame.getState();
    expect(st.travelPlan).toBeNull();
    expect(st.scene?.id).toBe('lieu-b-scene');
  });

  it('« Attaqués ! » (table d10) configuré : l’acquittement transitionne et lance la rencontre (noSurprise)', () => {
    setup(map());
    useGame.setState({
      travelRecap: {
        fromLabel: 'Village A', toLabel: 'Bourg B', mode: 'pied', status: 'interrupted', km: 12, kmDone: 6, days: [],
        then: { kind: 'ambush', scene: 'lieu-a-scene', encounter: 'enc-test', noSurprise: true },
      },
    });
    useGame.getState().dismissTravelRecap();
    const st = useGame.getState();
    expect(st.battle).toBeTruthy();
    expect(st.travelRecap).toBeNull();
  });

  it('péripétie purement narrative (journal) : le voyage continue', () => {
    setup(map({ perils: [{ label: 'Un colporteur partage la route.', chancePct: 100, effects: [{ type: 'journal', text: 'Il vend des amulettes.' }] }] }));
    useGame.getState().startTravel('r1', 'pied');
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene'); // arrivé malgré la péripétie
    expect(st.journal.some((l) => l.includes('colporteur'))).toBe(true);
  });
});

describe('nourriture en voyage (LDB 18 l.417-422)', () => {
  it('sans rations, un long voyage affame le groupe (compteur de faim) et bloque la récup nocturne', () => {
    setup(map({ km: 72 }), [hero({ items: [], wounds: { current: 5, max: 12 } })]); // 3 jours pleins à M4
    useGame.getState().startTravel('r1', 'pied');
    // Chaque nuit : halte (modale de Repos) → dormir → reprendre la route au matin.
    for (let n = 0; n < 4 && useGame.getState().pendingRest; n++) {
      useGame.getState().restSleep();
      useGame.getState().restContinue();
    }
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene');
    const h = st.party[0];
    expect(h.hunger?.days).toBeGreaterThanOrEqual(2); // plusieurs jours sans manger
    expect(st.journal.some((l) => l.includes('affamé'))).toBe(true); // récup bloquée journalisée (rest.ts)
  });

  it('openWorldMap/closeWorldMap : overlay piloté par le store (pas en combat)', () => {
    setup(map());
    useGame.getState().openWorldMap();
    expect(useGame.getState().worldMapOpen).toBe(true);
    useGame.getState().closeWorldMap();
    expect(useGame.getState().worldMapOpen).toBe(false);
  });
});

describe('récapitulatif de voyage (audit M4) — modale à l’arrivée/interruption', () => {
  it('arrivée : recap « arrived » avec ses journées et les lignes de péripétie', () => {
    setup(map({ perils: [{ label: 'Un colporteur partage la route.', chancePct: 100, effects: [{ type: 'journal', text: 'Il vend des amulettes.' }] }] }));
    useGame.getState().startTravel('r1', 'pied');
    const r = useGame.getState().travelRecap!;
    expect(r.status).toBe('arrived');
    expect(r.fromLabel).toBe('Village A');
    expect(r.toLabel).toBe('Bourg B');
    expect(r.kmDone).toBeCloseTo(12);
    expect(r.days.length).toBe(1); // 12 km à M4 = 3 h
    expect(r.days[0].lines.some((l) => l.includes('colporteur'))).toBe(true);
    useGame.getState().dismissTravelRecap();
    expect(useGame.getState().travelRecap).toBeNull();
  });

  it('interruption par péripétie de combat : recap « interrupted » avec km restants ; la reprise produit SON recap', () => {
    setup(map({
      km: 30,
      perils: [{ label: 'Brigands sur la route !', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-test' }] }],
    }));
    useGame.getState().startTravel('r1', 'pied');
    let r = useGame.getState().travelRecap!;
    expect(r.status).toBe('interrupted');
    expect(r.kmDone).toBeLessThan(30);
    expect(r.days[0].lines.some((l) => l.includes('Brigands'))).toBe(true);
    // « Faire face » : le combat différé démarre à l'acquittement du recap.
    useGame.getState().dismissTravelRecap();
    expect(useGame.getState().battle).toBeTruthy();
    // victoire simulée → reprise : nouveau segment, nouveau recap
    useGame.setState({ battle: null, mode: 'exploration' });
    const wm = useGame.getState().worldMap!;
    useGame.setState({ worldMap: { ...wm, routes: wm.routes.map((x) => ({ ...x, perils: [] })) } });
    useGame.getState().resumeTravel();
    r = useGame.getState().travelRecap!;
    expect(r.status).toBe('arrived');
    expect(useGame.getState().scene?.id).toBe('lieu-b-scene');
  });

  it('surcharge (vitesse 0) : recap « stalled »', () => {
    // Force la vitesse à pied à 0 via le Déplacement d'auteur de la route.
    setup(map({ speed: { pied: 0 } }));
    useGame.getState().startTravel('r1', 'pied');
    expect(useGame.getState().travelRecap?.status).toBe('stalled');
    expect(useGame.getState().travelPlan?.interrupted).toBe(true);
  });
});
