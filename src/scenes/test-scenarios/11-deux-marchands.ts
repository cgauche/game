import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { itemFromTrapping, recomputeLoadout } from '../../engine/items';
import { Combatant } from '../../engine/types';
import { flowFromEffects } from '../../state/flow';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/** Duo : le capitaine porte une maille endommagée (à réparer) + une dague (à vendre) ; on visite
 *  l'armurier (interaction directe) ET l'herboriste (boutique ouverte DEPUIS un dialogue → Effet
 *  openMerchant). Deux archétypes de marchand côte à côte. */
function groupe(): Combatant[] {
  const cap = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'Capitaine (test)', motivation: 'Test', rng: makeRNG(3110), id: 'cap' });
  const maille = itemFromTrapping('Chemise de mailles')!;
  maille.damageTaken = 2; // endommagée → réparable chez l'armurier (10 %/PA, LDB 63)
  maille.equipped = true;
  const dague = itemFromTrapping('Dague')!; // un objet à vendre
  cap.items = [maille, dague];
  recomputeLoadout(cap);
  cap.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.55 };

  const ecl = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'Éclaireuse (test)', motivation: 'Test', rng: makeRNG(3111), id: 'ecl' });
  ecl.appearance = { species: 'Humains (Reiklander)', sex: 'F', build: 0.45 };
  return [cap, ecl];
}

const scene = arena({ id: 'test-deux-marchands', nom: 'Deux marchands — armurier & herboriste', w: 16, h: 9, heroStart: { x: 2, y: 4 } });
scene.startMessage = 'Deux échoppes : un armurier (parlez-lui directement) et une herboriste (engagez la conversation, puis demandez à voir ses marchandises).';
scene.entities.push(
  // Armurier : interaction directe → la boutique s'ouvre tout de suite (entité marchande « nue »).
  { id: 'armurier', kind: 'personnage', label: 'Armurier', pos: { x: 7, y: 2 }, merchant: { archetype: 'armurier' } },
  // Herboriste : DIALOGUE d'abord (dialogueId prioritaire), puis un choix ouvre sa boutique via openMerchant.
  // Village isolé → elle VEND PLUS CHER (buyMarkup 1.25 = +25 %) : prix paramétrable par entité (#2).
  { id: 'herboriste', kind: 'personnage', label: 'Herboriste', pos: { x: 12, y: 6 }, dialogueId: 'dlg-herbo', merchant: { archetype: 'herboriste', buyMarkup: 1.25 } },
);
scene.dialogues = [
  {
    id: 'dlg-herbo',
    start: 'accueil',
    nodes: [
      {
        id: 'accueil',
        speaker: 'Herboriste',
        text: 'Bonjour, voyageur. Cherchez-vous des remèdes… ou seulement à bavarder ?',
        choices: [
          // Effet openMerchant : ouvre la boutique de l'herboriste PUIS le dialogue se ferme (next absent).
          { text: 'Montrez-moi vos marchandises.', flow: flowFromEffects([{ type: 'openMerchant', entityId: 'herboriste' }]) },
          { text: 'Une autre fois. (Partir)' }, // next & effects absents → ferme le dialogue
        ],
      },
    ],
  },
];
scene.triggers = [
  // Bourse de départ (la nouvelle partie réinitialise l'argent à 0) — versée en s'avançant vers les échoppes.
  { id: 'bourse', rect: { x: 3, y: 3, w: 8, h: 4 }, once: true, flow: flowFromEffects([{ type: 'giveMoney', gold: 40 }, { type: 'journal', text: 'Vous disposez de 40 couronnes.' }]) },
];

export const scenario: TestScenario = {
  id: 'deux-marchands',
  order: 11,
  icon: '🛍️',
  title: 'Deux marchands',
  tests: 'Armurier (interaction directe) + Herboriste (boutique ouverte DEPUIS un dialogue, Effet openMerchant) ; deux archétypes, achat/vente/réparation.',
  partyNote: 'Duo (maille endommagée + dague à vendre, 40 CO)',
  makeParty: groupe,
  scene,
};
