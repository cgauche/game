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
 * NAUFRAGE (#244) — séquence de survie unique branchée aux deux sites de coulée (avarie de voyage,
 * combat naval). Chaque héros à bord tente un Test de Natation (LDB 09 l.372) ; les rescapés s'échouent,
 * les noyés meurent (LDB 18 l.344), le navire + la cargaison sombrent (`vessel` → null). Tous noyés → défaite.
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
  return { ...h, characteristics: { ...(h.characteristics ?? {}), F: f } as never };
}

/** Héros Inconscient : ne peut PAS nager → noyade DÉTERMINISTE (chemin sans jet dans `beginShipwreck`). */
function knockedOut(h: Combatant): Combatant {
  const c = { ...h, conditions: [...(h.conditions ?? [])] };
  addCondition(c as never, 'inconscient');
  return c;
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
  } as never);
  // Bandes auto désactivées : les Tests de Natation sont pilotés par la seule valeur (déterminisme).
  setRule('test-auto-bands', 'off');
}

afterEach(() => { resetRule('test-auto-bands'); resetRule('sea-shipwreck-swim'); });

describe('beginShipwreck — cascade de survie', () => {
  beforeEach(freshState);

  it('mélange rescapés / noyés : navire + cargaison perdus, dénouement à l’écran, morts morts', () => {
    setRule('sea-shipwreck-swim', 'intermediaire'); // cible = valeur (Natation)
    // party[0]/[2] bons nageurs (F 200) → rescapés ; party[1] Inconscient → noyade déterministe.
    set({ party: [swim(get().party[0], 200), knockedOut(get().party[1]), swim(get().party[2], 200)] } as never);
    set({ travelPlan: { routeId: 'r1', fromPlaceId: 'A', toPlaceId: 'B', mode: 'mer', km: 550, kmDone: 500, hoursPerDay: 24, interrupted: false } as never });

    beginShipwreck(get, set);

    expect(get().vessel).toBeNull();                 // navire + cargaison sombrent
    expect(get().travelPlan).toBeNull();
    expect(get().party[0].dead).toBeFalsy();          // F 200 → rejoint la côte
    expect(get().party[2].dead).toBeFalsy();
    expect(get().party[1].dead).toBe(true);           // Inconscient → noyé
    expect(get().document?.title).toBe('Naufrage');   // dénouement à l’écran (modale document)
    expect(get().journal.join('\n')).toContain('— NAUFRAGE —');
    expect(get().partyWiped).toBeFalsy();             // au moins un rescapé
  });

  it('tous noyés → défaite hors combat (checkPartyWiped)', () => {
    // Tout le groupe Inconscient : nul ne peut nager → noyade totale déterministe → défaite.
    set({ party: get().party.map((h) => knockedOut(h)) } as never);
    beginShipwreck(get, set);
    expect(get().party.every((h) => h.dead)).toBe(true);
    expect(get().vessel).toBeNull();
    expect(get().partyWiped).toBe(true);
  });

  it('n’intervient que sur l’équipage désigné (aboardIds)', () => {
    set({ party: get().party.map((h) => knockedOut(h)) } as never);
    beginShipwreck(get, set, { aboardIds: [get().party[0].id] });
    expect(get().party[0].dead).toBe(true);   // à bord, noyé
    expect(get().party[1].dead).toBeFalsy();  // hors de l'équipage désigné → non testé
    expect(get().party[2].dead).toBeFalsy();
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

    expect(over).toBe(true);
    expect(get().battle).toBeNull();               // combat clos par le naufrage, pas par la défaite
    expect(get().vessel).toBeNull();               // navire de campagne perdu
    expect(get().document?.title).toBe('Naufrage'); // dénouement à l’écran
    expect(get().party.every((h) => !h.dead)).toBe(true); // rescapés (F 200)
  });
});
