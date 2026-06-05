import { makePregens } from '../../data/pregens';
import { Combatant } from '../../engine/types';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/** Halfling Voleur (peu de Blessures), Destin/Résilience mis à 0 → la mort survient vraiment. */
function fragile(): Combatant {
  const h = JSON.parse(JSON.stringify(makePregens().find((p) => p.name.startsWith('Klein'))!)) as Combatant;
  h.fate = 0;
  h.fortune = 0;
  h.resilience = 0;
  h.resolve = 0;
  return h;
}

const scene = arena({ id: 'test-crit', nom: 'Critiques & Mort — fosse', w: 14, h: 9, heroStart: { x: 2, y: 4 } });
scene.startMessage = 'Un ours enragé. Le héros est fragile et sans Destin : 0 PB → À Terre → Inconscient → mort.';
scene.encounters = [{ id: 'enc-crit', enemies: [{ ref: 'Ours', pos: { x: 8, y: 4 } }] }];

export const scenario: TestScenario = {
  id: 'critiques-mort',
  order: 3,
  icon: '💀',
  title: 'Critiques & Mort',
  tests: 'Overkill/double → Critique ; 0 PB → À Terre → Inconscient → mort (tables 18-Traumatisme).',
  partyNote: 'Héros fragile (Destin 0) vs Ours',
  makeParty: () => [fragile()],
  scene,
  autoCombat: 'enc-crit',
};
