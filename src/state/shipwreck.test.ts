import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { beginShipwreck } from './shipwreck';
import { runSeaDays, buildSeaPlan } from './seaVoyageFlow';
import { checkBattleOver } from './combatFlow';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';
import { seedBattleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import { addCondition } from '../engine/conditions';
import type { WorldMap } from './worldMap';
import type { Combatant } from '../engine/types';

/**
 * NAUFRAGE (#244, cascade #269) — séquence de survie unique branchée aux deux sites de coulée (avarie de
 * voyage, combat naval). Chaque héros conscient à bord tente un Test de Natation (LDB 09 l.372) — une
 * ÉTAPE de cascade INFLUENÇABLE (Chance/Pacte/Résilience) par héros piloté par un humain (défaut des tests :
 * `combat-cadence` = 'manuel', héros non `aiControlled` → `humanControlled` vrai) ; un groupe SANS pilote
 * humain se résout inline. Les rescapés s'échouent, les noyés meurent (LDB 18 l.344), le navire + la
 * cargaison sombrent (`vessel` → null, IMMÉDIAT). Tous noyés → défaite.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const seaMap: WorldMap = {
  id: 'm', nom: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

/** Fixe la valeur de Natation d'un héros par sa Force (Natation non possédée → carac F, cf. `testValue`). */
function swim(h: Combatant, f: number): Combatant {
  return { ...h, characteristics: { ...(h.characteristics ?? {}), force: f } as never };
}

/** Héros Inconscient : ne peut PAS nager → noyade DÉTERMINISTE (chemin sans jet dans `beginShipwreck`). */
function knockedOut(h: Combatant): Combatant {
  const c = { ...h, conditions: [...(h.conditions ?? [])] };
  addCondition(c as never, 'inconscient');
  return c;
}

/** Pilote la cascade de naufrage jusqu'à sa clôture (« Lancer » puis « Continuer » étape par étape) —
 *  sert à driver les scénarios PILOTÉS PAR UN HUMAIN (défaut des tests) jusqu'au dénouement. */
function drainSwimCascade(): void {
  for (let guard = 0; guard < 20 && get().pendingCascade; guard++) {
    const casc = get().pendingCascade!;
    const cur = casc.participants[casc.cursor];
    if (cur && !cur.result) get().cascadeRoll(cur.id);
    get().cascadeNext();
  }
}

function freshState() {
  seedBattleRng(1);
  useGame.setState({
    party: makePregens().slice(0, 3),
    scene: { id: 'port-a', nom: 'Port', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] } as never,
    battle: null,
    worldMap: seaMap,
    travelPlan: null,
    partyWiped: false,
    document: null,
    gameTime: 8 * 60,
    lastUpkeepDay: 0,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [{ cargoId: 'bois', enc: 100, basePriceGold: 1 }] },
    journal: [],
    pendingCascade: null,
  } as never);
  // Bandes auto désactivées : les Tests de Natation sont pilotés par la seule valeur (déterminisme).
  setRule('test-auto-bands', 'off');
}

afterEach(() => { resetRule('test-auto-bands'); resetRule('sea-shipwreck-swim'); resetRule('combat-cadence'); });

describe('beginShipwreck — cascade de survie (héros pilotés par un humain, défaut des tests)', () => {
  beforeEach(freshState);

  it('mélange rescapés / noyés : navire + cargaison perdus, dénouement à l’écran, morts morts', () => {
    setRule('sea-shipwreck-swim', 'intermediaire'); // cible = valeur (Natation)
    // party[0]/[2] bons nageurs (F 200) → rescapés ; party[1] Inconscient → noyade déterministe (pas de jet).
    set({ party: [swim(get().party[0], 200), knockedOut(get().party[1]), swim(get().party[2], 200)] } as never);
    set({ travelPlan: { routeId: 'r1', fromPlaceId: 'A', toPlaceId: 'B', mode: 'mer', km: 550, kmDone: 500, hoursPerDay: 24, interrupted: false } as never });

    beginShipwreck(get, set);

    // Vessel/travelPlan purgés IMMÉDIATEMENT (indépendant de l'issue des jets, à l'ouverture de la cascade).
    expect(get().vessel).toBeNull();
    expect(get().travelPlan).toBeNull();
    // Une étape de Natation par nageur CONSCIENT — l'Inconscient n'en porte aucune (déjà noyé).
    const casc = get().pendingCascade!;
    expect(casc).toBeTruthy();
    expect(casc.participants).toHaveLength(2);
    expect(casc.participants.every((s) => s.kind === 'shipwreckSwim' && s.interactive)).toBe(true);
    expect(get().party[1].dead).toBe(true); // Inconscient → noyé d'office, avant même la cascade

    drainSwimCascade();

    expect(get().pendingCascade).toBeNull();
    expect(get().party[0].dead).toBeFalsy();          // F 200 → rejoint la côte
    expect(get().party[2].dead).toBeFalsy();
    expect(get().document?.title).toBe('Naufrage');   // dénouement à l’écran (modale document)
    expect(get().journal.join('\n')).toContain('— NAUFRAGE —');
    expect(get().partyWiped).toBeFalsy();             // au moins un rescapé
  });

  it('la Chance est dépensable sur un échec de Natation et TRANSFORME le résultat (survie)', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    const h = swim(get().party[0], 200);
    h.fortune = 1;
    h.resilience = 1;
    set({ party: [h] } as never);

    beginShipwreck(get, set);
    const casc = get().pendingCascade!;
    expect(casc.participants).toHaveLength(1);
    const stepId = casc.participants[0].id;
    // Force un ÉCHEC sur l'étape courante (comme `cascade.test.ts`) puis dépense la Chance : succès forcé.
    set({ pendingCascade: { ...casc, participants: [{ ...casc.participants[0], result: { roll: 88, target: casc.participants[0].target!, sl: -5, success: false } }] } });
    get().cascadeReroll(stepId); // 1 Point de Chance dépensé (relance simple)
    expect(get().party[0].fortune).toBe(0);
    get().cascadeForceSuccess(stepId); // Résilience — ici on force directement le succès pour clore le test
    expect(get().pendingCascade!.participants[0].result!.success).toBe(true);
    get().cascadeNext();

    expect(get().pendingCascade).toBeNull();
    expect(get().party[0].dead).toBeFalsy(); // la Chance a transformé la noyade en survie
  });

  it('tous noyés → défaite hors combat (checkPartyWiped) — aucun nageur conscient, pas de cascade', () => {
    // Tout le groupe Inconscient : nul ne peut nager → noyade totale déterministe → défaite, SANS cascade
    // (aucun nageur conscient à mettre en étape).
    set({ party: get().party.map((h) => knockedOut(h)) } as never);
    beginShipwreck(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().party.every((h) => h.dead)).toBe(true);
    expect(get().vessel).toBeNull();
    expect(get().partyWiped).toBe(true);
  });

  it('n’intervient que sur l’équipage désigné (aboardIds) — aucun nageur conscient, pas de cascade', () => {
    set({ party: get().party.map((h) => knockedOut(h)) } as never);
    beginShipwreck(get, set, { aboardIds: [get().party[0].id] });
    expect(get().pendingCascade).toBeNull();
    expect(get().party[0].dead).toBe(true);   // à bord, noyé
    expect(get().party[1].dead).toBeFalsy();  // hors de l'équipage désigné → non testé
    expect(get().party[2].dead).toBeFalsy();
  });
});

describe('beginShipwreck — repli IA/rafale (aucun pilote humain à bord) : inline VISIBLE', () => {
  beforeEach(freshState);

  it('cadence auto (rafale) → résolution inline, aucune modale de cascade', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    setRule('combat-cadence', 'auto'); // héros non remontés en modale (cf. state/netOwnership.humanControlled)
    set({ party: [swim(get().party[0], 200)] } as never);

    beginShipwreck(get, set);

    expect(get().pendingCascade).toBeNull(); // pas de cascade : résolu inline, comme aujourd'hui
    expect(get().party[0].dead).toBeFalsy();
    expect(get().document?.title).toBe('Naufrage');
    expect(get().journal.join('\n')).toContain('— NAUFRAGE —');
  });
});

describe('détection au voyage — coque à 0 → naufrage', () => {
  beforeEach(freshState);

  it('runSeaDays intercepte une coque coulée avant de dérouler la journée', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    set({ party: get().party.map((h) => swim(h, 200)) } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    plan.vehicle!.wounds.current = 0; // avarie (Tourbillon/Collision/usure) → coque coulée
    set({ travelPlan: plan });
    runSeaDays(get, set);
    drainSwimCascade();
    expect(get().vessel).toBeNull();               // séquence de naufrage jouée
    expect(get().document?.title).toBe('Naufrage');
    expect(get().party.every((h) => !h.dead)).toBe(true); // tous bons nageurs → rescapés
  });
});

describe('détection en combat — coque de campagne coulée → naufrage (pas défaite)', () => {
  beforeEach(freshState);

  it('checkBattleOver route l’équipage par-dessus bord vers la survie', () => {
    setRule('sea-shipwreck-swim', 'intermediaire');
    const heroes = get().party.slice(0, 2).map((h) => swim(h, 200)); // bons nageurs → rescapés
    const hull = vehicleCombatant(findVehicleById('cogue')!)!;
    hull.id = 'hull-campagne'; hull.kind = 'enemy';
    hull.crewIds = heroes.map((h) => h.id);
    hull.wounds = { current: 0, max: hull.wounds.max }; // coque coulée (0 PB)
    const battle = {
      combatants: [hull, ...heroes], order: [], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    set({ party: heroes, battle } as never);

    const over = checkBattleOver(get, set);
    drainSwimCascade();

    expect(over).toBe(true);
    expect(get().battle).toBeNull();               // combat clos par le naufrage, pas par la défaite
    expect(get().vessel).toBeNull();               // navire de campagne perdu
    expect(get().document?.title).toBe('Naufrage'); // dénouement à l’écran
    expect(get().party.every((h) => !h.dead)).toBe(true); // rescapés (F 200)
  });
});
