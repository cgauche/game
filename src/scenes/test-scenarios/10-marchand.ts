import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { itemFromTrapping, recomputeLoadout } from '../../engine/items';
import { Combatant } from '../../engine/types';
import { flowFromEffects } from '../../state/flow';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/** Héros « négociant » : porte une épée magique NON identifiée (qualité cachée + skin légendaire) et une
 *  armure endommagée, pour tester Évaluer / Marchander / Réparer chez le marchand. */
function negociant(): Combatant {
  const h = createHero({
    speciesId: 'humains-reiklander',
    careerId: 'soldat',
    name: 'Négociant (test)',
    motivation: 'Test',
    rng: makeRNG(2510),
    id: 'test-negociant',
  });
  // Épée bâtarde « légendaire » : qualité MAGIQUE cachée (« De plaies atroces », ADE2 l.228 = Dévastatrice)
  // + skin bleuté ; identified:false → ses qualités sont MASQUÉES tant qu'une Évaluation ne l'a pas révélée
  // (elles restent ACTIVES en combat).
  const epee = itemFromTrapping('Épée bâtarde')!;
  epee.qualities = [...epee.qualities, 'De plaies atroces'];
  epee.identified = false;
  epee.skin = { metal: '#7faaff' };
  epee.equipped = true;
  // Armure endommagée (2 PA perdus) → réparable chez le marchand (10 %/PA, LDB 63).
  const maille = itemFromTrapping('Chemise de mailles')!;
  maille.damageTaken = 2;
  maille.equipped = true;
  h.items = [epee, maille];
  recomputeLoadout(h);
  h.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.5 };
  return h;
}

const scene = arena({ id: 'test-marchand', nom: 'Marchand — Évaluer / Marchander / Réparer', w: 14, h: 9, heroStart: { x: 2, y: 4 } });
scene.startMessage = 'Un armurier tient échoppe. Parlez-lui pour acheter, vendre, marchander, faire évaluer votre épée mystérieuse ou réparer votre armure.';
scene.entities.push({ id: 'armurier', kind: 'personnage', pos: { x: 10, y: 4 }, merchant: { archetype: 'armurier' } });
// Bourse de départ : un trigger sur le chemin verse 50 CO (la nouvelle partie réinitialise l'argent à 0).
scene.triggers = [
  { id: 'bourse', rect: { x: 3, y: 3, w: 6, h: 3 }, once: true, flow: flowFromEffects([{ type: 'giveMoney', gold: 50 }, { type: 'journal', text: 'Vous trouvez 50 couronnes dans votre bourse.' }]) },
];

export const scenario: TestScenario = {
  id: 'marchand',
  order: 10,
  icon: '🛒',
  title: 'Marchand',
  tests: 'Acheter/Vendre + Marchander (Test opposé −10/−20 %) + Évaluer (révèle la qualité cachée) + Réparer (10 %/PA).',
  partyNote: 'Négociant solo (épée magique non identifiée + maille endommagée)',
  makeParty: () => [negociant()],
  scene,
};
