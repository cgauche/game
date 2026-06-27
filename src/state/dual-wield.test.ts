import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { initialFields } from './stateFields';
import { resolveDualSecond, applyAttackResult } from './combatFlow';
import { reverseRoll, rollMeleeDefender, type AttackResult } from '../engine/combat';
import { makeRNG } from '../engine/dice';
import type { Combatant, Weapon } from '../engine/types';

const W = (uid: string, hand: 'main' | 'off'): Weapon =>
  ({ uid, name: hand === 'main' ? 'Épée' : 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand, hands: 1 });

const CHARS = (cc: number) => ({ CC: cc, CT: 30, F: 35, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 });
const ARM = () => ({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });

const mkHero = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'h', name: 'H', kind: 'hero', pos: { x: 0, y: 0 }, size: 'moyenne',
  characteristics: CHARS(50), skills: [], talents: [], advantage: 0, conditions: [],
  wounds: { base: 12, max: 12, current: 12 },
  weapons: [W('m', 'main'), W('o', 'off')], armour: ARM(), ...over,
} as unknown as Combatant);

const mkFoe = (id: string, x: number): Combatant => ({
  id, name: id, kind: 'enemy', pos: { x, y: 0 }, size: 'moyenne',
  characteristics: CHARS(30), skills: [], talents: [], advantage: 0, conditions: [],
  wounds: { base: 10, max: 10, current: 10 },
  weapons: [{ name: 'Griffe', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }], armour: ARM(),
} as unknown as Combatant);

function setupBattle(heroOver: Partial<Combatant> = {}) {
  const h = mkHero(heroOver); const f1 = mkFoe('f1', 1); const f2 = mkFoe('f2', 1);
  useGame.setState({
    scene: { ambiance: 'exterieur', weather: 'clair' } as any,
    gameTime: 0,
    battle: { combatants: [h, f1, f2], order: ['h', 'f1', 'f2'], turn: 0, round: 1, log: [],
      acted: false, movementUsed: 0, movedPreAction: false, loadoutSwapped: false, reachable: new Map() } as any,
    pendingReveals: [],
  });
  const b = useGame.getState().battle!;
  return {
    h: b.combatants.find((c) => c.id === 'h')!,
    f1: b.combatants.find((c) => c.id === 'f1')!,
    f2: b.combatants.find((c) => c.id === 'f2')!,
  };
}

// ISOLATION — `useGame` est un singleton de MODULE partagé entre tests (et entre fichiers d'un même
// worker Vitest). Sans reset, un `pending*` laissé par un test/fichier précédent fuit selon l'ordre
// d'exécution (le RNG, lui, est seedé → déterministe : le flake venait de CET état partagé, pas du hasard).
// On remet à zéro TOUS les champs transitoires (`initialFields`, copies fraîches) + le combat AVANT
// chaque test ; ce hook de TÊTE DE FICHIER s'exécute avant les `beforeEach` de describe (setupBattle / timers).
beforeEach(() => useGame.setState({ ...initialFields(), battle: null, scene: null, gameTime: 0, party: [] }));

describe('resolveDualSecond : 2ᵉ attaque du Maniement de deux armes (LDB 10 l.638)', () => {
  beforeEach(() => setupBattle());

  it('utilise le jet INVERSÉ de la main directrice comme jet de la 2ᵉ attaque (34 → 43)', () => {
    const { h, f2 } = setupBattle();
    const off = h.weapons.find((w) => w.hand === 'off')!;
    const res = resolveDualSecond(useGame.getState, h, f2, off, 34);
    expect(res.attackerRoll).toBe(reverseRoll(34)); // 43
  });

  it('exception Critique : utilise la valeur du tableau des Critiques, pas l’inversion', () => {
    const { h, f2 } = setupBattle();
    const off = h.weapons.find((w) => w.hand === 'off')!;
    const res = resolveDualSecond(useGame.getState, h, f2, off, 11, { critValue: 56 });
    expect(res.attackerRoll).toBe(56);
  });

  // Règles d'arme contextuelles de Groupe (LDB 62 l.146-147) AUSSI pour la 2ᵉ frappe : `resolveDualSecond`
  // replie `effectiveWeapon(off, weaponContextOf(attacker, off))` AVANT touche/Dégâts (le `res` est ensuite
  // appliqué tel quel). Cible Surprise → pas de jet de défense → DR déterministe (jet d'attaque forcé = 23).
  const flail = (): Weapon =>
    ({ uid: 'o', name: 'Fléau', type: 'melee', subType: 'fleau', hand: 'off', hands: 1, damage: { plusBF: true, flat: 5 }, qualities: [{ id: 'percutante' }] });

  it('Fléau en main secondaire SANS la Spé → Atouts retirés (Percutante perdue) vs AVEC la Spé', () => {
    const { h, f2 } = setupBattle();
    const off = flail();
    h.weapons = [W('m', 'main'), off];
    f2.conditions = [{ name: 'surpris' } as any]; // ne se défend pas → résolution déterministe
    h.skills = [];
    const rSans = resolveDualSecond(useGame.getState, h, f2, off, 32); // jet forcé = reverseRoll(32) = 23 (3 unités) → touche
    h.skills = [{ skillId: 'corps-a-corps', spec: 'Fléau', advances: 0 } as any];
    const rAvec = resolveDualSecond(useGame.getState, h, f2, off, 32);
    expect([rSans.hit, rAvec.hit]).toEqual([true, true]);
    expect(rAvec.damage! - rSans.damage!).toBe(3); // Percutante (3 unités) conservée AVEC la Spé, retirée SANS
  });
});

describe('applyAttackResult : defer de l’Avantage de l’attaquant', () => {
  it('deferAttackerAdvantage=true → n’incrémente PAS l’Avantage de l’attaquant', () => {
    const { h, f1 } = setupBattle();
    h.advantage = 0;
    const res = { hit: true, attackerRoll: 10, netSL: 2, critical: false, advantageTo: 'attacker',
      defenderDefeated: false, woundsLost: 0, location: 'corps', log: 'x' } as unknown as AttackResult;
    applyAttackResult(useGame.getState, useGame.setState, h, f1, h.weapons[0], res, undefined, undefined, true);
    expect(h.advantage).toBe(0);
  });
  it('sans defer → incrémente normalement', () => {
    const { h, f1 } = setupBattle();
    h.advantage = 0;
    const res = { hit: true, attackerRoll: 10, netSL: 2, critical: false, advantageTo: 'attacker',
      defenderDefeated: false, woundsLost: 0, location: 'corps', log: 'x' } as unknown as AttackResult;
    applyAttackResult(useGame.getState, useGame.setState, h, f1, h.weapons[0], res);
    expect(h.advantage).toBe(1);
  });
});

describe('−10 à toutes les défenses du dual-wield (LDB 10 l.638)', () => {
  it('un défenseur avec le flag pare 10 plus bas (cible) qu’un défenseur sans', () => {
    const { f1 } = setupBattle();
    const withPen = { ...f1, dualStrikeDefensePenalty: true } as Combatant;
    const a = rollMeleeDefender(f1, 'parade', makeRNG(1));
    const c = rollMeleeDefender(withPen, 'parade', makeRNG(1));
    expect(a.target - c.target).toBe(10);
  });
  it('s’applique aussi à l’Esquive (« tous vos lancers défensifs »)', () => {
    const { f1 } = setupBattle();
    const withPen = { ...f1, dualStrikeDefensePenalty: true } as Combatant;
    const a = rollMeleeDefender(f1, 'esquive', makeRNG(2));
    const c = rollMeleeDefender(withPen, 'esquive', makeRNG(2));
    expect(a.target - c.target).toBe(10);
  });
});

const hitRes = (over: Partial<AttackResult> = {}): AttackResult => ({
  hit: true, attackerRoll: 30, netSL: 2, critical: false, advantageTo: 'attacker', defenderDefeated: false,
  woundsLost: 0, location: 'corps', attackerDetail: { roll: 30, target: 50, success: true, sl: 2 }, log: 'touche', ...over,
} as unknown as AttackResult);

describe('chaînage de l’Action « des deux armes »', () => {
  it('main touche → pendingDualStrike ouvert + −10 défense posé ; dualStrikeAttack → 2ᵉ frappe pré-résolue ; confirm → fermé', () => {
    setupBattle();
    useGame.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes(), dualMode: true } as any });
    useGame.getState().attackConfirm();
    const ds = useGame.getState().pendingDualStrike;
    expect(ds).not.toBeNull();
    expect(ds!.offWeaponUid).toBe('o');
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(true);

    useGame.getState().dualStrikeAttack('f2');
    const pa = useGame.getState().pendingAttack;
    expect(pa?.dualSecond).toBe(true);
    expect(pa?.result).not.toBeNull();

    useGame.getState().attackConfirm();
    expect(useGame.getState().pendingDualStrike).toBeNull();
  });

  it('main MANQUE → pas de 2ᵉ frappe (pendingDualStrike reste null), mais −10 défense quand même posé', () => {
    setupBattle();
    useGame.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes({ hit: false, advantageTo: 'defender' }), dualMode: true } as any });
    useGame.getState().attackConfirm();
    expect(useGame.getState().pendingDualStrike).toBeNull();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(true);
  });
});

describe('Avantage : +1 UNIQUE et seulement si les DEUX frappes touchent (LDB 10 l.638)', () => {
  it('les deux touchent → +1 Avantage (pas +1 par frappe)', () => {
    const { h } = setupBattle();
    h.advantage = 0;
    useGame.setState({
      pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', mainRoll: 30 } as any,
      pendingAttack: { attackerId: 'h', targetId: 'f2', location: 'corps', result: hitRes(), dualSecond: true, weaponUid: 'o' } as any,
    });
    useGame.getState().attackConfirm();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'h')!.advantage).toBe(1);
    expect(useGame.getState().pendingDualStrike).toBeNull();
  });

  it('la 2ᵉ manque → 0 Avantage (pas « les deux »)', () => {
    const { h } = setupBattle();
    h.advantage = 0;
    useGame.setState({
      pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', mainRoll: 30 } as any,
      pendingAttack: { attackerId: 'h', targetId: 'f2', location: 'corps', result: hitRes({ hit: false, advantageTo: 'defender' }), dualSecond: true, weaponUid: 'o' } as any,
    });
    useGame.getState().attackConfirm();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'h')!.advantage).toBe(0);
    expect(useGame.getState().pendingDualStrike).toBeNull();
  });
});

describe('bornage : jamais sur une attaque gratuite / enchaînée (LDB 10 l.638 « pour votre Action »)', () => {
  it('attaque d’enchaînement (cleave) avec le talent : pas de pendingDualStrike', () => {
    setupBattle({ talents: [{ talentId: 'maniement-de-deux-armes', times: 1 }] as any });
    // Une attaque de balayage (cleave) n'a JAMAIS dualMode (le toggle est masqué si pa.cleave).
    useGame.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes(), cleave: true } as any });
    useGame.getState().attackConfirm();
    expect(useGame.getState().pendingDualStrike).toBeNull();
  });
  it('attaque normale (sans dualMode) avec le talent : pas de pendingDualStrike', () => {
    setupBattle({ talents: [{ talentId: 'maniement-de-deux-armes', times: 1 }] as any });
    useGame.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes() } as any });
    useGame.getState().attackConfirm();
    expect(useGame.getState().pendingDualStrike).toBeNull();
  });
});

describe('purge du −10 au début du prochain Tour du porteur', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('survit aux Tours adverses puis est purgé quand le porteur (order[0]) rejoue', () => {
    const { h } = setupBattle();
    h.dualStrikeDefensePenalty = true;
    useGame.setState({ battle: { ...useGame.getState().battle!, turn: 0 } });
    useGame.getState().battleEndTurn(); vi.clearAllTimers(); // → f1 : flag de h conservé
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(true);
    useGame.getState().battleEndTurn(); vi.clearAllTimers(); // → f2 : conservé
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(true);
    useGame.getState().battleEndTurn(); vi.clearAllTimers(); // franchissement de Round → h (order[0]) : purgé
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(false);
  });
});
