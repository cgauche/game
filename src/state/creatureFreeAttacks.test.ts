import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { aiCreatureFreeAttacks, applyGaze, applyChillGrasp, applyWail } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';
import type { Combatant } from '../engine/types';

// Attaques GRATUITES de créature (Taille & traits) : Morsure / Attaque caudale / Piétinement,
// chacune 1 Avantage, OPPOSÉE (cible Surprise ici → résolution instantanée), gratuite (LDB 85).
describe('aiCreatureFreeAttacks — attaques gratuites de créature (RAW)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 10, y: 10 }; H.size = 'moyenne';
    H.wounds = { current: 50, max: 50, base: 50 } as Combatant['wounds'];
    H.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    H.conditions = [{ name: 'Surpris', value: 1 }]; // Surpris → ne se défend pas → résolution instantanée
    E.pos = { x: 11, y: 10 }; E.size = 'enorme';
    E.characteristics.CC = 85; E.characteristics.F = 45;
    useGame.setState({ battle: { ...b, acted: false } });
    return { H, E };
  }

  it('Morsure : touche, dégâts infligés, Action NON consommée (gratuite)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = ['Morsure +14']; E.advantage = 1;
    const before = H.wounds.current;
    const suspended = aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(suspended).toBe(false); // cible Surprise → instantané, pas de modale
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
    expect(st.battle!.acted).toBe(false); // attaque GRATUITE : l'Action n'est pas consommée
    // (sur une touche, le coût −1 Avantage est compensé par le +1 du vainqueur du Test opposé — RAW)
  });

  it('coût : une attaque gratuite RATÉE dépense bien 1 Avantage (CC=1 → échec)', () => {
    useGame.getState().seedRng(2);
    const { E } = setup();
    E.traits = ['Morsure +14']; E.advantage = 2; E.characteristics.CC = 1; // rate → pas de +1 du vainqueur
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.advantage).toBeLessThan(2);
  });

  it('Attaque caudale : cible de Taille INFÉRIEURE qui perd des PB → À Terre (LDB 85 l.338)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = ['Attaque caudale +14']; E.advantage = 1;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.conditions.some((c) => c.name === 'À Terre')).toBe(true);
  });

  it('file priorisée : Morsure (trait) PUIS Piétinement (Taille) résolus, file vidée', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = ['Morsure +14']; E.advantage = 5;
    const before = H.wounds.current;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.pendingFreeAttacks).toBeUndefined(); // file épuisée
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before); // ≥ 1 attaque a touché
  });

  it('sans Avantage : aucune attaque gratuite, file vidée', () => {
    const { H, E } = setup();
    E.traits = ['Morsure +14']; E.advantage = 0;
    const before = H.wounds.current;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(before);
  });

  it('Cornes : Attaque gratuite gagnée en CHARGEANT, sans coût d’Avantage (LDB 85)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = ['Cornes +14']; E.advantage = 0; E.chargedThisTurn = true; // a chargé avec 0 Avantage
    const before = H.wounds.current;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
  });

  it('Cornes : sans Charge, aucune Attaque de Cornes (0 Avantage → rien)', () => {
    const { H, E } = setup();
    E.traits = ['Cornes +14']; E.advantage = 0; E.chargedThisTurn = false;
    const before = H.wounds.current;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(before);
  });

  it('Souffle (Feu) : zone, Test opposé CT/Esquive → dégâts ignorant les PA + En flammes', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = ['Souffle +14 (Feu)']; E.advantage = 2; E.characteristics.CT = 85;
    H.characteristics.Ag = 1; H.skills = H.skills.filter((s) => !s.name.toLowerCase().includes('esquive'));
    H.armour = { tete: 5, brasG: 5, brasD: 5, corps: 5, jambeG: 5, jambeD: 5 }; // PA ignorés par le Feu
    const before = H.wounds.current;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.conditions.some((c) => c.name === 'En flammes')).toBe(true);
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0); // 2 − 2 (le Souffle ne gagne pas d'Avantage)
  });

  it('Vomissement : zone (3 Av), dégâts BE+4 + Sonné + corrosion de l’armure', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = ['Vomissement +0']; E.advantage = 3; E.characteristics.CT = 85;
    H.characteristics.Ag = 1; H.skills = H.skills.filter((s) => !s.name.toLowerCase().includes('esquive'));
    H.armour = { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 };
    const beforePA = H.armour.corps;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.conditions.some((c) => c.name === 'Sonné')).toBe(true);
    expect(h.armour.corps).toBe(beforePA - 1); // corrosion : Armure −1
  });

  it('Regard pétrifiant : dépense tout l’Avantage, marge ≥ 6 DR → cible Pétrifiée', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = ['Regard pétrifiant']; E.advantage = 6; E.characteristics.CT = 90; // +6 DR d'Avantage + CT élevée
    H.characteristics.I = 1; H.skills = H.skills.filter((s) => !s.name.toLowerCase().startsWith('initiative'));
    const acted = applyGaze(useGame.getState, useGame.setState, E);
    expect(acted).toBe(true);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.conditions.some((c) => c.name === 'Pétrifié') || h.wounds.current === 0).toBe(true);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0); // tout dépensé
  });

  it('Étreinte glaciale : 2 Avantages, succès → 1d10+DR Blessures ignorant BE et PA', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = ['Étreinte glaciale']; E.advantage = 2; E.characteristics.CC = 90;
    H.armour = { tete: 6, brasG: 6, brasD: 6, corps: 6, jambeG: 6, jambeD: 6 }; // PA ignorés
    const before = H.wounds.current;
    const acted = applyChillGrasp(useGame.getState, useGame.setState, E);
    expect(acted).toBe(true);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0); // 2 − 2
  });

  it('Constricteur : toute touche → Empêtré ; Vampirique : la Morsure soigne l’attaquant', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = ['Morsure +14', 'Constricteur', 'Vampirique']; E.advantage = 1;
    E.wounds = { current: 10, max: 40, base: 40 } as Combatant['wounds']; // blessé → peut se soigner
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.conditions.some((c) => c.name === 'Empêtré')).toBe(true);
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBeGreaterThan(10); // drainé (Vampirique)
  });

  it('Hurlement fantomatique : zone vivante, 1d10 ignore BE+PA + 3 Assourdi, dépense tous les Av', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = ['Hurlement fantomatique']; E.advantage = 4; E.characteristics.I = 40;
    H.armour = { tete: 6, brasG: 6, brasD: 6, corps: 6, jambeG: 6, jambeD: 6 }; // PA ignorés
    const before = H.wounds.current;
    const acted = applyWail(useGame.getState, useGame.setState, E);
    expect(acted).toBe(true);
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.conditions.filter((c) => c.name === 'Assourdi').length >= 1).toBe(true);
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0); // tous les Avantages dépensés
  });

  it('Venin : Morsure venimeuse sur PB → Test de Résistance raté → Empoisonné (LDB 85 l.326)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.traits = ['Morsure +14', 'Venin (Intermédiaire)']; E.advantage = 1;
    H.characteristics.E = 1; // Endurance minime → Résistance ratée quasi à coup sûr
    H.skills = H.skills.filter((s) => !s.name.toLowerCase().startsWith('résistance'));
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.conditions.some((c) => c.name === 'Empoisonné')).toBe(true);
  });
});
