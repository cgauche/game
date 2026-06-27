/**
 * Attaque GRATUITE de Frénésie d'un HÉROS en Auto-combat (retour playtest 2026-06-27 : « un héros en
 * frénésie n'utilise pas son attaque gratuite »). `aiFrenzyAttack` était gardé `kind==='enemy'` → un héros
 * AUTO-piloté (sans UI) ne la jouait jamais. Gate corrigé en `!aiDriven` : enemy + héros auto la jouent ;
 * un héros MANUEL la déclenche lui-même via l'affordance UI (donc `aiFrenzyAttack` reste un no-op pour lui).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { makeShowcaseParty } from '../data/pregens';
import { ambushTest } from '../scenes/ambush-test';
import { aiFrenzyAttack } from './combatFlow';
import { hasFreeWeaponAttack } from './combatManeuvers';
import { setRule } from '../engine/policy';

describe('Frénésie — attaque gratuite d’un héros (Auto-combat)', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.getState().seedRng(7); setRule('combat-cadence', 'manuel'); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); setRule('combat-cadence', 'manuel'); });

  function frenziedHeroAdjacentToFoe() {
    useGame.setState({ party: makeShowcaseParty() });
    useGame.getState().startScene(ambushTest);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    const hero = b.combatants.find((c) => c.kind === 'hero' && (c.weapons ?? []).some((w) => w.type === 'melee'))!;
    const foe = b.combatants.find((c) => c.kind === 'enemy' && !c.dead)!;
    hero.psychState = [{ type: 'frenesie' } as never];   // frénétique → attaque libre d'Arme (LDB 21 l.34)
    foe.pos = { x: hero.pos!.x + 1, y: hero.pos!.y };      // ennemi AU CONTACT (cible de l'attaque gratuite)
    foe.wounds = { ...foe.wounds, current: 99, max: 99 };  // survit pour qu'on mesure l'attaque, pas la mort
    useGame.setState({ battle: { ...b } });
    return { heroId: hero.id, foeId: foe.id };
  }

  it('hasFreeWeaponAttack vrai pour un héros frénétique au contact', () => {
    const { heroId } = frenziedHeroAdjacentToFoe();
    const hero = useGame.getState().battle!.combatants.find((c) => c.id === heroId)!;
    expect(hasFreeWeaponAttack(hero)).toBe(true);
  });

  it('AUTO : aiFrenzyAttack FRAPPE (le journal s’enrichit) ; MANUEL : no-op (l’UI gère)', () => {
    const { heroId } = frenziedHeroAdjacentToFoe();
    const hero = () => useGame.getState().battle!.combatants.find((c) => c.id === heroId)!;

    // MANUEL : aiDriven faux → aiFrenzyAttack ne fait RIEN (le héros la jouera via l'affordance UI)
    setRule('combat-cadence', 'manuel');
    const logManuel = useGame.getState().battle!.log.length;
    aiFrenzyAttack(useGame.getState, useGame.setState, hero());
    expect(useGame.getState().battle!.log.length).toBe(logManuel); // no-op

    // AUTO : aiDriven vrai → l'attaque gratuite est résolue (jet d'attaque journalisé)
    setRule('combat-cadence', 'auto');
    const logAuto = useGame.getState().battle!.log.length;
    aiFrenzyAttack(useGame.getState, useGame.setState, hero());
    expect(useGame.getState().battle!.log.length).toBeGreaterThan(logAuto); // a frappé
  });
});
