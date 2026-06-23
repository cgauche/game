/**
 * #T2 Voyage — flux store : trajets sur la carte du monde (temps, rations, paiement, péripéties
 * d'auteur, interruption/reprise). RAW : section « Voyage » du LDB (`51 - Magie du Chaos.md`).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { emptyScene, Scene } from './scene';
import { buildEncounter } from './encounterAuthoring';
import { WorldMap } from './worldMap';
import { CAMPAIGN_START } from '../engine/clock';
import { toBrass } from '../engine/money';
import { rationCount } from '../engine/provisions';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, ItemInstance } from '../engine/types';

const ration = (uid: string): ItemInstance => ({ uid, name: 'Ration', isRations: true, kind: 'misc', qualities: [], enc: 0, equipped: false });

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

/** Dort à une halte de nuit : « Dormir » puis déroule la CASCADE séquentielle (lance + valide chaque
 *  jet) s'il y en a une — sinon (rien à influencer) la route a déjà repris. La fin de cascade reprend
 *  le voyage (purpose 'travel'). Remplace l'ancien restSleep→bilan→restContinue. */
function sleepThroughHalt(): void {
  useGame.getState().restSleep();
  let guard = 0;
  while (useGame.getState().pendingCascade && guard++ < 60) {
    const p = useGame.getState().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur.target != null && !cur.result) useGame.getState().cascadeRoll(cur.id);
    useGame.getState().cascadeNext();
  }
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
    sleepThroughHalt(); // « Dormir » → cascade (ou reprise directe) → la route repart au matin
    st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene');
    // Jour 1 : 6 h de marche (24 km) + nuit jusqu'à l'aube ; jour 2 : 1 h 30 (6 km) → > 17 h au total.
    expect(st.gameTime - t0).toBeGreaterThan(17 * 60);
    expect(st.journal.some((l) => /dort jusqu|aube/i.test(l))).toBe(true);
    // L'entretien quotidien a consommé une ration au franchissement de jour.
    expect(rationCount(st.party[0])).toBe(2);
  });

  it('marche forcée (allure > 6 h/jour) : les jets ouvrent la cascade INFLUENÇABLE de la halte de nuit', () => {
    setup(map({ km: 60 })); // assez long pour une halte de nuit après le 1er jour
    useGame.getState().startTravel('r1', 'pied', { hoursPerDay: 8 }); // > 6 h → marche forcée (l.224)
    const p = useGame.getState().pendingRest!;
    expect(p.phase).toBe('setup');
    expect((p.travelMarch ?? []).length).toBeGreaterThan(0); // héros à tester en marche forcée
    useGame.getState().restSleep();
    const cas = useGame.getState().pendingCascade!;
    // Le jet de marche forcée du jour est une ÉTAPE influençable de la cascade de nuit.
    expect(cas.participants[0].kind).toBe('forcedMarch');
    expect(cas.participants.filter((s) => s.kind === 'forcedMarch').length).toBe(1); // 1 héros
  });

  it('route à RELAIS (inns) : la halte de nuit propose l’auberge — chambre privée débitée, puis arrivée', () => {
    setup(map({ km: 30, inns: true }));
    useGame.setState({ money: { gold: 2, silver: 0, brass: 0 } });
    useGame.getState().startTravel('r1', 'pied');
    const p = useGame.getState().pendingRest!;
    expect(p.places.auberge).toBe(true);
    expect(p.perHero[useGame.getState().party[0].id].lodging).toBe('privee'); // défaut auberge
    const before = toBrass(useGame.getState().money);
    sleepThroughHalt();
    expect(toBrass(useGame.getState().money)).toBe(before - 120 - 12); // chambre 10 pa + repas 1 pa
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
    // Chaque nuit : halte (modale de Repos) → dormir (cascade) → reprendre la route au matin.
    for (let n = 0; n < 6 && useGame.getState().pendingRest; n++) {
      sleepThroughHalt();
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

/**
 * Sous-système OPTIONNEL « Voyage par Étapes » (EDOC ch.5). Défaut OFF = voyage jour-par-jour
 * INCHANGÉ (aucune ligne de Météo/Étape) ; ON = jet de Météo par jour, Approvisionnement et
 * Exposition de fin d'Étape optionnels.
 */
describe('Voyage par Étapes (EDOC ch.5, règle optionnelle)', () => {
  afterEach(() => {
    resetRule('travel-etapes');
    resetRule('travel-etapes-count-bonus');
    resetRule('travel-attraper-froid');
  });

  it('OFF (défaut) : voyage INCHANGÉ — aucune ligne de Météo/Étape, arrivée identique au chemin de base', () => {
    setup(map({ km: 12, perilDie: 0 }));
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'pied');
    const st = useGame.getState();
    // Comportement de base : arrive le jour même (12 km à M4 = 3 h), comme le test de référence.
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(st.gameTime - t0).toBe(180);
    expect(st.journal.some((l) => l.includes('Arrivée à Bourg B'))).toBe(true);
    // Aucune trace du sous-système d'Étapes (la règle est éteinte → chemin court-circuité).
    expect(st.journal.some((l) => l.includes("Météo de l'Étape"))).toBe(false);
    expect(st.journal.some((l) => l.includes('Approvisionnement'))).toBe(false);
    expect(st.journal.some((l) => l.includes("Exposition de fin d'Étape"))).toBe(false);
  });

  it('ON : un jet de Météo est journalisé pour la journée de route', () => {
    setRule('travel-etapes', true);
    setup(map({ km: 12, perilDie: 0 }));
    useGame.getState().startTravel('r1', 'pied');
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene'); // arrive toujours (l'enrichissement ne bloque pas la route)
    expect(st.journal.some((l) => l.includes("Météo de l'Étape"))).toBe(true);
  });

  it('ON, sans « Attraper froid » : les POSTES se résolvent, mais aucun Test d’Exposition de fin d’Étape', () => {
    setRule('travel-etapes', true);
    // Héros au poste Récupérer (sans Test, n'ouvre PAS la porte « Plein air ») → l'Exposition resterait
    // possible si le flag était mis, mais il ne l'est pas ici.
    const h = hero({ travelRole: 'recuperer', items: [ration('r1')] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    useGame.getState().startTravel('r1', 'pied');
    const st = useGame.getState();
    expect(st.journal.some((l) => l.includes("Exposition de fin d'Étape"))).toBe(false);
    // Le poste assigné (Récupérer) a bien été résolu pour l'Étape (EDOC l.131 : un héros = une Activité).
    expect(st.journal.some((l) => l.includes('Récupérer'))).toBe(true);
  });

  it('ON : un héros au poste Approvisionnement fourrage (Test de Survie en extérieur, EDOC l.108)', () => {
    setRule('travel-etapes', true);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ skillId: 'survie-en-exterieur', advances: 20 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    useGame.getState().startTravel('r1', 'pied');
    const st = useGame.getState();
    expect(st.journal.some((l) => l.includes('Approvisionnement'))).toBe(true);
  });

  it('ON + travel-attraper-froid : un Test d’Exposition de fin d’Étape est tenté (héros sans manteau)', () => {
    setRule('travel-etapes', true);
    setRule('travel-attraper-froid', true);
    // Hiver garantit pluie/neige/blizzard fréquents ; on balaie quelques graines pour en obtenir un
    // (la météo est seedée — au moins une graine produit des intempéries imposant un Test).
    let exposed = false;
    for (let seed = 1; seed <= 20 && !exposed; seed++) {
      seedBattleRng(seed);
      const winter = CAMPAIGN_START + 0; // la date par défaut (fin Jahrdrung) suffit : printemps a aussi pluie/neige
      // Poste Récupérer : pas de « Plein air » → la porte `suppressExposure` reste fermée, l'Exposition se joue.
      setup(map({ km: 12, perilDie: 0 }), [hero({ travelRole: 'recuperer' })]);
      useGame.setState({ gameTime: winter });
      useGame.getState().startTravel('r1', 'pied');
      if (useGame.getState().journal.some((l) => l.includes("Exposition de fin d'Étape"))) exposed = true;
    }
    expect(exposed).toBe(true);
  });

  it('porte « Plein air » : un héros réussit Plein air → le groupe SAUTE le Test d’Exposition (EDOC l.141)', () => {
    setRule('travel-etapes', true);
    setRule('travel-attraper-froid', true);
    // Héros expert en Survie au poste Plein air : sa réussite dispense tout le groupe de l'Exposition.
    let suppressed = false;
    for (let seed = 1; seed <= 20 && !suppressed; seed++) {
      seedBattleRng(seed);
      const h = hero({ travelRole: 'plein-air', skills: [{ skillId: 'survie-en-exterieur', advances: 60 } as any] });
      setup(map({ km: 12, perilDie: 0 }), [h]);
      useGame.setState({ gameTime: CAMPAIGN_START });
      useGame.getState().startTravel('r1', 'pied');
      const j = useGame.getState().journal;
      // Plein air joué et réussi, et aucune Exposition cette Étape.
      if (j.some((l) => l.includes('Plein air') && l.includes('réussi')) && !j.some((l) => l.includes("Exposition de fin d'Étape"))) suppressed = true;
    }
    expect(suppressed).toBe(true);
  });

  it('poste Établir des cartes : Test ÉTENDU de cartographie cumulé via extendedTestStep (EDOC l.161)', () => {
    setRule('travel-etapes', true);
    const h = hero({ travelRole: 'etablir-cartes', skills: [{ skillId: 'metier', spec: 'Cartographe', advances: 80 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    useGame.getState().startTravel('r1', 'pied');
    const j = useGame.getState().journal;
    expect(j.some((l) => l.includes('Cartographie') || l.includes("carte de l'itinéraire est ACHEVÉE"))).toBe(true);
  });

  it('véhicule à coque : `plan.vehicle` est bâti depuis la facette hull (Diligence E45/B50)', () => {
    setRule('travel-etapes', true);
    // Trajet > 36 km/jour (M6 × 6 h) → halte de nuit, `travelPlan` persiste (vehicle inspectable).
    // Extérieur 1 sou/km × 50 km = 50 PA ≤ 60 PA de bourse de départ.
    setup(map({ km: 50, modes: ['diligence'], perilDie: 0 }));
    useGame.getState().startTravel('r1', 'diligence', { classKey: 'exterieur' });
    const plan = useGame.getState().travelPlan;
    expect(plan?.vehicle?.bodyShape).toBe('vehicule');
    expect(plan?.vehicle?.wounds.max).toBe(50);
    expect(plan?.vehicle?.characteristics.E).toBe(45);
  });

  it('à pied : aucun `plan.vehicle` (pas de coque pour un trajet à pied)', () => {
    setRule('travel-etapes', true);
    setup(map({ km: 12, perilDie: 0 }));
    useGame.getState().startTravel('r1', 'pied');
    // Trajet bouclé le jour même → plan purgé ; le départ n'aura de toute façon créé aucune coque.
    expect(useGame.getState().travelPlan).toBeNull();
  });

  it('Rencontre : un échec d’Activité déclenche une Rencontre EDOC (texte verbatim au journal)', () => {
    setRule('travel-etapes', true);
    // Héros nul en Survie au poste Approvisionnement → échec quasi certain → Rencontre (dangereuse/fortuite).
    let met = false;
    for (let seed = 1; seed <= 20 && !met; seed++) {
      seedBattleRng(seed);
      const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ skillId: 'survie-en-exterieur', advances: 0 } as any] });
      setup(map({ km: 12, perilDie: 0 }), [h]);
      useGame.getState().startTravel('r1', 'pied');
      if (useGame.getState().journal.some((l) => l.includes('Rencontre'))) met = true;
    }
    expect(met).toBe(true);
  });

  it('setTravelRole épingle puis détache le rôle de marche PERSISTANT', () => {
    setup(map(), [hero({ id: 'h1' })]);
    useGame.getState().setTravelRole('h1', 'plein-air');
    expect(useGame.getState().party[0].travelRole).toBe('plein-air');
    useGame.getState().setTravelRole('h1', null);
    expect(useGame.getState().party[0].travelRole).toBeUndefined();
  });
});
