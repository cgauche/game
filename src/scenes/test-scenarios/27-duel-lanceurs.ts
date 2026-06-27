import { pregenParty, PREGEN } from '../../data/pregens';
import { arena, setEncounters } from './_shared';
import { makeSorceress, makePriest } from './_casters';
import type { TestScenario } from './_shared';
import type { Combatant } from '../../engine/types';

const scene = arena({ id: 'test-duel-lanceurs', nom: 'Duel de lanceurs & dissipation', w: 26, h: 20, heroStart: { x: 3, y: 10 } });
scene.startMessage =
  'Duel de lanceurs : 3 casters héros (Sorcière + Prêtres) contre 3 casters ennemis (Eusapia, Envoûteuse, ' +
  'Sorcière) protégés par des minions. Observez l’IA ADVERSE jouer son arsenal — ZdE, focus, débuffs, ' +
  'invocations — et le Contre-sort / dissipation des deux camps. ⚠ L’Envoûteuse cause Peur 2 + Terreur 2 à l’ouverture.';
// Casteurs ennemis au FOND (12/12/6 sorts), minions de mêlée DEVANT (boucliers de chair) — l'IA caster
// reste en retrait et lance, les minions verrouillent les héros. Réfs par ID stable (findCreatureById).
setEncounters(scene, [
  {
    id: 'enc-duel',
    enemies: [
      // Minions de mêlée — première ligne.
      { ref: 'orc', pos: { x: 17, y: 9 } },
      { ref: 'gobelin', pos: { x: 17, y: 11 } },
      { ref: 'orc', pos: { x: 17, y: 13 } },
      // Casteurs ennemis — arrière.
      { ref: 'eusapia-balacanon', pos: { x: 22, y: 8 } },
      { ref: 'envouteuse', pos: { x: 23, y: 11 } },
      { ref: 'sorciere', pos: { x: 22, y: 13 } },
    ],
  },
]);

/**
 * « Duel de lanceurs & dissipation » : trois casters héros (Lysandra la Sorcière multi-domaine, un Prêtre
 * de Sigmar guerrier-soutien, une Prêtresse de Verena — déesse du savoir, à l'aise sur la magie adverse)
 * affrontent un trio de casters ennemis. But : éprouver l'IA ennemie qui joue tout son arsenal (variété,
 * ZdE, focus, débuff, invocation) et le Contre-sort / dissipation des deux côtés.
 */
function makeParty(): Combatant[] {
  const ans = pregenParty(PREGEN.pretre)[0];
  const sorc = makeSorceress('h-sorc', 'Lysandra, Sorcière', { x: 3, y: 9 });
  const sigmar = makePriest(ans, 'h-sigmar', 'Frère Otto, Prêtre de Sigmar', 'Sigmar', { Soc: 66, FM: 60, F: 46, E: 46 });
  sigmar.pos = { x: 2, y: 11 };
  const verena = makePriest(ans, 'h-verena', 'Sœur Adelind, Prêtresse de Verena', 'Verena', { Soc: 66, FM: 62, F: 40, E: 42 });
  verena.pos = { x: 3, y: 13 };
  return [sorc, sigmar, verena];
}

export const scenario: TestScenario = {
  id: 'duel-lanceurs',
  order: 27,
  icon: '🔮',
  title: 'Duel de lanceurs',
  tests: 'IA caster des DEUX camps : arsenal varié (ZdE / focus / débuff / invocation), Contre-sort & dissipation, casteurs en retrait derrière des minions, Psychologie (Peur/Terreur de l’Envoûteuse).',
  partyNote: 'Sorcière + Prêtres (Sigmar, Verena) vs Eusapia + Envoûteuse + Sorcière + 3 minions',
  makeParty,
  scene,
  autoCombat: 'enc-duel',
};
