import { describe, it, expect, beforeEach } from 'vitest';
import { evalCondition, flowHasTest, flowEffects } from '../../state/flow';
import { validateScene } from '../../state/validateScene';
import { useGame } from '../../state/store';
import { runFlow } from '../../state/combatEffects';
import { scenario } from './22-piege-caveau';

/**
 * « Le Caveau piégé » est du CONTENU pur (données éditeur). Ce gate prouve que la VITRINE Flow+Condition
 * est cohérente et tourne sur le vrai moteur : la condition composée de la herse (clé OU levier, ET NON
 * alarme) évalue correctement, et la dalle piégée est bien un Test à branches.
 */
describe('Scénario « Le Caveau piégé » : vitrine Flow + Condition', () => {
  const scene = scenario.scene;
  const herse = scene.triggers.find((t) => t.id === 'herse')!;
  const dalle = scene.triggers.find((t) => t.id === 'dalle-piegee')!;
  const withKey = [{ items: [{ name: 'Clé en fer' }] }];
  const at = (flags: Record<string, boolean>, party: { items: { name: string }[] }[] = []) =>
    evalCondition(herse.when!, { flags, gameTime: 0, party });

  it('passe validateScene sans erreur', () => {
    expect(validateScene([scene]).filter((w) => w.level === 'error')).toEqual([]);
  });

  it('la herse : (TIENT la clé OU levier) ET NON alarme — toutes les combinaisons', () => {
    expect(at({})).toBe(false); // rien, pas la clé
    expect(at({}, withKey)).toBe(true); // tenir la clé suffit (hasItem)
    expect(at({ levier_tire: true })).toBe(true); // le levier suffit
    expect(at({ levier_tire: true }, withKey)).toBe(true); // les deux
    expect(at({ alarme: true }, withKey)).toBe(false); // l’alarme verrouille (NON alarme), clé en main ou non
    expect(at({ levier_tire: true, alarme: true })).toBe(false);
    expect(at({ alarme: true })).toBe(false);
  });

  it('la dalle piégée est un Test à branches (réussite / échec)', () => {
    expect(flowHasTest(dalle.flow)).toBe(true);
  });

  it('le levier pose son flag (runtime) ; la clé donne « Clé en fer » lu par la herse (hasItem)', () => {
    const levier = scene.entities.find((e) => e.id === 'levier')!;
    const cle = scene.entities.find((e) => e.id === 'cle')!;
    useGame.setState({ battle: null, flags: {}, party: scenario.makeParty(), scene });
    runFlow(useGame.getState, useGame.setState, levier.interact!.flow);
    expect(useGame.getState().flags.levier_tire).toBe(true);
    // la fouille de la clé donne l'objet « Clé en fer » — c'est lui que la condition hasItem de la herse lit.
    expect(flowEffects(cle.interact!.flow).some((e) => e.type === 'giveTrapping' && e.trapping === 'Clé en fer')).toBe(true);
  });

  beforeEach(() => useGame.setState({ battle: null, flags: {}, pendingTest: null }));
});
