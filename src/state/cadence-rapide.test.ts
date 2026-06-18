import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { startCascade, registerCascadeApplier } from './cascade';
import { tickCombatAuto } from './combatAuto';
import { setRule, resetRule } from '../engine/policy';
import type { CascadeStep } from './pendings';

/**
 * Cadence RAPIDE — le pilote `tickCombatAuto` auto-résout les cascades (jets de nuit/voyage → RÉSUMÉ)
 * sans jet manuel, et reste INERTE en mode « manuel ». (Les jets de COMBAT bespoke — attaque/défense —
 * sont vérifiés par la recette navigateur ; ici on couvre le chemin cascade générique du driver.)
 */
describe('Cadence Rapide — auto-résolution des cascades par le driver', () => {
  const applied: string[] = [];
  beforeEach(() => {
    applied.length = 0;
    useGame.setState({ battle: null, pendingCascade: null, journal: [], net: { ...useGame.getState().net, mode: 'local' } });
    registerCascadeApplier('tally', (_g, _s, step) => { applied.push(step.id); return { journal: [step.id] }; });
  });
  afterEach(() => resetRule('combat-cadence'));

  function hero() {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'Brawn', rng: makeRNG(1) });
    useGame.setState({ party: [h] });
    return h;
  }
  const step = (id: string, actorId: string): CascadeStep =>
    ({ id, kind: 'tally', actorId, label: id, target: 55, result: null, interactive: true });

  it('manuel (défaut) : le driver ne touche PAS la cascade', () => {
    const h = hero();
    startCascade(useGame.getState, useGame.setState, { title: 'Nuit', purpose: 'test', steps: [step('s1', h.id), step('s2', h.id)] });
    tickCombatAuto(useGame.getState, useGame.setState);
    expect(applied).toHaveLength(0); // rien auto-résolu
    expect(useGame.getState().pendingCascade!.cursor).toBe(0);
  });

  it('rapide : auto-résout toute la cascade jusqu’au bilan, sans jet manuel', () => {
    useGame.getState().seedRng(3);
    setRule('combat-cadence', 'rapide');
    const h = hero();
    startCascade(useGame.getState, useGame.setState, { title: 'Nuit', purpose: 'test', steps: [step('s1', h.id), step('s2', h.id)] });
    tickCombatAuto(useGame.getState, useGame.setState);
    expect(applied).toEqual(['s1', 's2']); // toutes les conséquences appliquées d'office
    // BILAN voyage/nuit : on s'arrête au RÉSUMÉ (curseur en fin), pas de fermeture auto (« on voit le résultat »).
    expect(useGame.getState().pendingCascade!.cursor).toBe(2);
  });
});
