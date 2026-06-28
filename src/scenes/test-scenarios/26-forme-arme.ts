import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { itemFromTrappingById, recomputeLoadout } from '../../engine/items';
import { Combatant } from '../../engine/types';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/** Héros porteur d'une « Arme simple » ÉQUIPÉE — éprouve le SÉLECTEUR DE FORME (fiche, onglet Sac) :
 *  l'« Arme simple » (LDB 62) est une arme ABSTRAITE dont la silhouette se choisit parmi épée / hache /
 *  masse / marteau de guerre / demi-lance (`TrappingData.formChoices`). Défaut = épée ; changer la forme
 *  d'une arme tenue change sa silhouette sur le token en jeu (Weapon.shape suit ItemInstance.shape). */
function porteurArmeSimple(): Combatant {
  const h = createHero({
    speciesId: 'humains-reiklander',
    careerId: 'soldat',
    name: 'Porteur (test)',
    motivation: 'Test',
    rng: makeRNG(2626),
    id: 'test-forme-arme',
  });
  const arme = itemFromTrappingById('arme-simple')!; // shape:'epee' + formChoices par défaut
  arme.equipped = true;
  h.items = [arme]; // sac réduit à l'Arme simple → c'est l'arme active (silhouette sur le token)
  h.loadouts = undefined;
  h.activeLoadoutId = undefined;
  recomputeLoadout(h);
  h.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.5 };
  return h;
}

const scene = arena({ id: 'test-forme-arme', nom: "Forme d'arme — Arme simple", w: 12, h: 8 });
scene.startMessage =
  "Ouvrez la fiche du héros (portrait), onglet Sac : l'Arme simple affiche un sélecteur de forme (défaut Épée). Choisissez Hache → la silhouette change dans le sac ET sur le token en jeu.";

export const scenario: TestScenario = {
  id: 'forme-arme',
  order: 26,
  icon: '🪓',
  title: "Forme d'arme",
  tests:
    "Sélecteur de forme d'une Arme simple (formChoices) : option par défaut Épée, choix posé sur ItemInstance.shape, silhouette de l'arme active mise à jour (token + icône).",
  partyNote: 'Soldat solo, Arme simple équipée (épée → hache/masse/marteau/demi-lance)',
  makeParty: () => [porteurArmeSimple()],
  scene,
};
