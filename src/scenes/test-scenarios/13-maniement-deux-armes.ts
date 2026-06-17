import { makePregens } from '../../data/pregens';
import { itemFromTrapping, loadoutCreate, loadoutSetSlot, recomputeLoadout } from '../../engine/items';
import type { ItemInstance } from '../../engine/types';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

const scene = arena({ id: 'test-dual-wield', nom: 'Maniement de deux armes', w: 16, h: 10, heroStart: { x: 4, y: 5 } });
scene.startMessage =
  'Sigmund manie une arme dans chaque main (talent Maniement de deux armes). À son tour, coche « ⚔️ Des deux ' +
  'armes » dans la modale d’attaque : si la main directrice touche, choisis la cible de la 2ᵉ frappe (jet ' +
  'inversé) — l’Avantage n’est gagné que si LES DEUX touchent, et toutes ses défenses subissent −10 jusqu’à son prochain Tour.';
setEncounters(scene, [
  {
    id: 'enc-dual',
    enemies: [
      { ref: 'Gobelin', pos: { x: 5, y: 4 } },
      { ref: 'Gobelin', pos: { x: 5, y: 6 } },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'maniement-deux-armes',
  order: 13,
  icon: '⚔️',
  title: 'Maniement de deux armes',
  tests:
    'Mode « Des deux armes » (LDB 10 l.638) : 2ᵉ frappe de la main secondaire (d100 inversé + −20 main 2nde) sur ' +
    'une cible au choix après une 1ʳᵉ frappe réussie, nouvelle défense, exception Critique, −10 à toutes les ' +
    'défenses jusqu’au prochain Tour, Avantage seulement si les deux touchent.',
  partyNote: 'Sigmund (Arme simple + Dague, talent Maniement de deux armes) vs 2 Gobelins',
  makeParty: () => {
    const P = makePregens();
    const h = P.find((p) => p.name.startsWith('Sigmund'))!;
    if (!h.talents.some((t) => t.talentId === 'maniement-de-deux-armes')) {
      h.talents.push({ talentId: 'maniement-de-deux-armes', times: 1 });
    }
    // Deux armes de MÊLÉE à 1 main + un loadout « Deux armes » actif (main directrice + secondaire).
    const main = itemFromTrapping('Arme simple');
    const off = itemFromTrapping('Dague');
    h.items = [...(h.items ?? []), main, off].filter(Boolean) as ItemInstance[];
    if (main && off) {
      const id = loadoutCreate(h, 'Deux armes');
      loadoutSetSlot(h, id, 'main', main.uid);
      loadoutSetSlot(h, id, 'off', off.uid);
    }
    recomputeLoadout(h);
    return [h];
  },
  scene,
  autoCombat: 'enc-dual',
};
