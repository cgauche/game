import { makePregens } from '../../data/pregens';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

const scene = arena({ id: 'test-guerison', nom: 'Guérison (soin / hémorragie)', w: 16, h: 10, heroStart: { x: 2, y: 5 } });
scene.startMessage =
  "Frère Anselm sait soigner (Compétence Guérison). Sigmund est blessé et saigne, à ses côtés : " +
  'à son tour, ouvrez « 🩹 Soigner » pour lui rendre des PB ou « 🩸 stopper » son hémorragie. Un gobelin approche.';
setEncounters(scene, [
  {
    id: 'enc-guerison',
    enemies: [{ ref: 'gobelin', pos: { x: 10, y: 5 } }],
  },
]);

export const scenario: TestScenario = {
  id: 'guerison',
  order: 8,
  icon: '🩹',
  title: 'Guérison (soin / hémorragie)',
  tests:
    'Action Soigner (Compétence Guérison) : sous-panneau de cibles soi/allié adjacent, modale de jet (+0), ' +
    'soin BI+DR (1/rencontre) et arrêt d’Hémorragie (1+DR) ; soigner un allié à terre/inconscient le relève.',
  partyNote: 'Frère Anselm (soigneur) + Sigmund (blessé + Hémorragique)',
  makeParty: () => {
    const P = makePregens();
    const healer = P.find((p) => p.name.startsWith('Frère Anselm'))!;
    // Garantit la Compétence Guérison sur le soigneur (sinon le slot Soigner n'apparaît pas).
    if (!healer.skills.some((s) => s.skillId === 'guerison')) {
      healer.skills.push({ skillId: 'guerison', characteristic: 'Int', advances: 25 });
    }
    const ally = P.find((p) => p.name.startsWith('Sigmund'))!;
    ally.wounds = { ...ally.wounds, current: 3 }; // blessé → mode « Soigner les Blessures »
    ally.conditions = [{ name: 'Hémorragique', value: 2 }]; // saigne → mode « Arrêter l'Hémorragie »
    return [healer, ally];
  },
  scene,
  autoCombat: 'enc-guerison',
};
