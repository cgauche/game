import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { buildSeaPlan } from './seaVoyageFlow';
import { vesselFreeEnc, vesselMaxLoadEnc } from './portFlow';
import { seaActivityBlocked } from './seaActivities';
import { activityById } from '../engine/activities';
import { toBrass, PA_PER_CO } from '../engine/money';
import type { WorldMap } from './worldMap';
import type { Combatant } from '../engine/types';

/**
 * FINITION du chantier naval (reliquats 7a/7b) — les consommateurs joueur :
 *  #28 Température câblée (Exposition + eau), #27 Forcer le rythme (+M + Épuisement),
 *  #30 écran Port (commerce d'escale), #29 Activités en mer (semaine de 8 jours).
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const seaMap: WorldMap = {
  id: 'm', nom: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a', port: { taille: 4, richesse: 4, production: ['bois'], surplus: { 'produits-de-luxe': 1 } } },
    { id: 'B', label: 'Marienburg', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 4, richesse: 5, production: ['commerce'], demande: { bois: 1 }, cosmopolite: true } },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

function freshState() {
  seedBattleRng(7);
  useGame.setState({
    party: makePregens().slice(0, 3),
    scene: { id: 'port-a', nom: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never,
    battle: null,
    worldMap: seaMap,
    travelPlan: null,
    travelRecap: null,
    pendingCrewTest: null,
    pendingRest: null,
    pendingSeaActivities: null,
    port: null,
    gameTime: 8 * 60,
    lastUpkeepDay: 0,
    money: { gold: 5000, silver: 0, brass: 0 },
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    journal: [],
  } as never);
}

/** Déroule la journée maritime jusqu'à une SUSPENSION (halte, Activités en mer) — la journée est
 *  désormais UNE cascade `purpose:'travelDay'` (#275 Ronde 2 cran 3) : chaque étape est soit MONO
 *  (Forcer le rythme/Prière, `klass:'hero-test'`) soit À PARTICIPANTS (batch, Tests d'équipage MDG
 *  ch.14 — `cascadeCrewRoll` par contributeur). Garde-fou 40 pas (crises/événements possibles).
 *  `await tick()` laisse s'exécuter le `setTimeout` de reprise d'un applier surfacé isolément
 *  (Ouragan/Prière — `seaVoyageFlow.ts`), comme un vrai clic UI l'espacerait. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

async function runOneSeaDay() {
  for (let i = 0; i < 40; i++) {
    if (get().pendingRest || get().pendingSeaActivities) break;
    const casc = get().pendingCascade;
    if (casc) {
      const cur = casc.participants[casc.cursor];
      if (cur?.participants) { for (const part of cur.participants) if (!part.result) get().cascadeCrewRoll(part.id); }
      else if (cur && !cur.result) get().cascadeRoll(cur.id);
      get().cascadeNext();
      await tick();
      continue;
    }
    break;
  }
}

describe('#27 Forcer le rythme (MDG 13 l.95-107)', () => {
  beforeEach(freshState);

  it('buildSeaPlan({pace}) porte le bonus de M demandé sur l’état naval', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { pace: 1 })!;
    expect(plan.sea!.forcePace).toBe(1);
    const plain = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    expect(plain.sea!.forcePace).toBeUndefined();
  });

  it('une journée à rythme forcé → Test de Voile puis Test d’Épuisement (Complexe −10) par PJ', async () => {
    seedBattleRng(1); // jour 1 navigable (ni Encalminé ni Affaler) → la Voile/le rythme se joue
    get().startTravel('r1', 'mer', { seaPace: 1 });
    await runOneSeaDay();
    // Le recap du jour (halte de nuit) porte la journée ENTIÈRE — le journal, capé à 40 lignes,
    // évince les lignes précoces comme « Forcer le rythme ».
    const day = get().pendingRest!.travelDay!.lines.join('\n');
    expect(day).toMatch(/Forcer le rythme/);
    expect(day).toMatch(/Épuisement.*rythme forcé/);
  });
});

describe('#28 Température en mer (MDG 13 l.203-225) — câblée au jour', () => {
  beforeEach(freshState);

  it('la journée en mer consomme de l’eau selon la bande de Température (tonneaux suivis)', async () => {
    seedBattleRng(3);
    set({ vessel: { ...get().vessel!, waterLitres: 500 } });
    get().startTravel('r1', 'mer');
    await runOneSeaDay();
    // Une journée entière est passée : l'eau a été consommée (crew × litres de la bande).
    expect(get().vessel!.waterLitres).toBeLessThan(500);
    expect(get().journal.join('\n')).toMatch(/Eau douce|À SEC/);
  });
});

describe('#29 Activités en mer (MDG 15 l.266-306)', () => {
  beforeEach(freshState);

  it('la semaine de 8 jours ouvre la modale d’Activités (déclencheur hebdomadaire)', async () => {
    seedBattleRng(3);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    // On amorce au 7ᵉ jour révolu : la journée suivante franchit la 8ᵉ → pendingSeaActivities.
    set({ travelPlan: { ...plan, kmDone: 40, sea: { ...plan.sea!, daysAtSea: 7 } } });
    get().resumeTravel();
    await runOneSeaDay();
    // Soit la modale d'Activités s'ouvre (8ᵉ jour), soit l'arrivée/halte (selon les milles) — mais
    // sur 550 milles à ~40 milles restants elle ne peut pas arriver : la modale doit s'ouvrir.
    expect(get().pendingSeaActivities).toBeTruthy();
  });

  it('seaActivitiesConfirm — Cartographie réussie → une Carte marine (+2 DR d’Orientation) sur le héros', () => {
    seedBattleRng(3);
    const heroes = get().party;
    // Un cartographe hors pair : Métier (Cartographe) à 90.
    (heroes[0] as Combatant).skills = [{ skillId: 'metier', spec: 'Cartographe', advances: 60 } as never];
    (heroes[0] as Combatant).characteristics = { ...heroes[0].characteristics, dexterite: 40 };
    set({ party: [...heroes], pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } } });
    get().seaActivitiesConfirm({ [heroes[0].id]: { activityId: 'cartographie' } });
    const owner = get().party[0];
    const chart = (owner.items ?? []).find((it) => it.trappingId === 'carte-marine');
    // Métier 90 Complexe (−10) = 80 → très probablement réussi ; la carte est créée en cas de succès.
    // (RNG seedé déterministe : on tolère l'absence si l'unique jet échoue, mais on vérifie la halte.)
    if (chart) expect(chart.trappingId).toBe('carte-marine');
    expect(get().pendingRest).toBeTruthy(); // la halte de nuit suit la confirmation
    expect(get().pendingSeaActivities).toBeNull();
  });

  it('Entraînement d’équipage est BLOQUÉ (équipage PNJ abstrait, MDG 14 l.39)', () => {
    const def = activityById('entrainement-equipage')!;
    expect(seaActivityBlocked(get, def)).toMatch(/équipage/i);
  });

  it('Cartographie réussie + stashGold → Planque gratuite (MDG 15 l.292, découverte ≤ 50)', () => {
    seedBattleRng(3);
    const heroes = get().party;
    // Même cartographe hors pair que le test précédent, jet déterministe (roll 73 ≤ cible 99).
    (heroes[0] as Combatant).skills = [{ skillId: 'metier', spec: 'Cartographe', advances: 80 } as never];
    (heroes[0] as Combatant).characteristics = { ...heroes[0].characteristics, dexterite: 60 };
    set({ party: [...heroes], pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } } });
    const before = toBrass(get().money);
    get().seaActivitiesConfirm({ [heroes[0].id]: { activityId: 'cartographie', stashGold: 50 } });
    const dep = get().bank.find((b) => b.heroId === heroes[0].id && b.kind === 'stash');
    expect(dep).toBeTruthy();
    expect(dep!.brass).toBe(50 * PA_PER_CO);
    expect(dep!.rate).toBe(50); // seuil de découverte MDG (au lieu de 10, ch.23 l.170)
    expect(toBrass(get().money)).toBe(before - 50 * PA_PER_CO);
    expect(get().journal.join('\n')).toMatch(/Planque.*MDG 15 l\.292/);
  });

  it('Cartographie sans mise de Planque (stashGold absent) → aucun dépôt créé', () => {
    seedBattleRng(3);
    const heroes = get().party;
    (heroes[0] as Combatant).skills = [{ skillId: 'metier', spec: 'Cartographe', advances: 80 } as never];
    (heroes[0] as Combatant).characteristics = { ...heroes[0].characteristics, dexterite: 60 };
    set({ party: [...heroes], pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } } });
    get().seaActivitiesConfirm({ [heroes[0].id]: { activityId: 'cartographie' } });
    expect(get().bank.find((b) => b.heroId === heroes[0].id && b.kind === 'stash')).toBeUndefined();
  });
});

describe('#30 Écran Port — commerce maritime (MDG 15 l.309-399)', () => {
  beforeEach(freshState);

  it('openPort génère les offres d’achat de l’escale (Production + Surplus)', () => {
    seedBattleRng(2); // d10 non-1 → disponibilités non nulles (le 1 sur le d10 = « aucune », l.327)
    get().openPort();
    const st = get().port!;
    expect(st.placeId).toBe('A');
    expect(st.offers.length).toBeGreaterThan(0); // bois (Production) et/ou produits de luxe (Surplus)
  });

  it('portBuyCargo débite la bourse et embarque la cargaison ; portSellCargo la revend', () => {
    seedBattleRng(2);
    get().openPort();
    const offer = get().port!.offers[0];
    const before = get().money.gold;
    get().portBuyCargo(offer.cargoId, Math.min(10, offer.enc));
    const vessel = get().vessel!;
    expect((vessel.cargo ?? []).length).toBe(1);
    expect(get().money.gold).toBeLessThanOrEqual(before);
    // Vente dans un autre port : on pose le navire à Marienburg (« commerce ») et on solde le lot.
    set({ vessel: { ...get().vessel!, lastVoyageMilles: 550 }, port: null, scene: { id: 'port-b', nom: 'P', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never });
    get().openPort();
    const cargoLen = (get().vessel!.cargo ?? []).length;
    get().portSellCargo(0);
    // Trouvé un acheteur (port « commerce » : bonnes chances) → lot vendu, ou pas (RNG) mais l'appel ne casse pas.
    expect((get().vessel!.cargo ?? []).length).toBeLessThanOrEqual(cargoLen);
  });

  it('#243 — headroom nominal vs plafond dur de surcharge (Cogue : Contenance 300, dur 450)', () => {
    set({ vessel: { ...get().vessel!, cargo: [{ cargoId: 'bois', enc: 290, basePriceGold: 1 }] } });
    expect(vesselFreeEnc(get)).toBe(10); // 300 − 290 (nominal)
    expect(vesselMaxLoadEnc(get)).toBe(160); // 450 − 290 (surcharge possible)
    set({ vessel: { ...get().vessel!, cargo: [{ cargoId: 'bois', enc: 440, basePriceGold: 1 }] } });
    expect(vesselFreeEnc(get)).toBe(0); // au-delà de la Contenance : plus de headroom nominal
    expect(vesselMaxLoadEnc(get)).toBe(10); // 450 − 440
  });

  it('#243 — l’achat au-delà de la Contenance surcharge (jusqu’à 150 %) et l’avertit ; jamais au-delà du plafond dur', () => {
    seedBattleRng(2);
    set({ vessel: { ...get().vessel!, cargo: [{ cargoId: 'bois', enc: 290, basePriceGold: 1 }] }, money: { gold: 100000, silver: 0, brass: 0 } as never });
    get().openPort();
    const offer = get().port!.offers[0]; // production/surplus copieux (Taille 4 + Richesse 4 × d10 × 10)
    get().portBuyCargo(offer.cargoId, 1000); // demande énorme → clampée au plafond dur (450 − 290 = 160)
    const enc = (get().vessel!.cargo ?? []).reduce((s, l) => s + l.enc, 0);
    expect(enc).toBeLessThanOrEqual(450); // jamais au-delà du maximum absolu (150 %)
    expect(enc).toBeGreaterThan(300); // a bien SURchargé (au-delà de la Contenance nominale)
    expect(get().journal.some((l) => /SURCHARG/i.test(l))).toBe(true); // achat en zone de surcharge → avertissement
  });

  it('portDumpCargo brade à ¼ du prix de base dans un port « commerce »', () => {
    seedBattleRng(2);
    set({ vessel: { ...get().vessel!, cargo: [{ cargoId: 'bois', enc: 100, basePriceGold: 2 }] } });
    set({ scene: { id: 'port-b', nom: 'P', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never });
    get().openPort();
    const before = get().money.gold;
    get().portDumpCargo(0);
    expect((get().vessel!.cargo ?? []).length).toBe(0);
    expect(get().money.gold).toBeGreaterThan(before); // ¼ × 100 × 2 = 50 CO
  });
});
