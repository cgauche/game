import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { itemFromTrapping, recomputeLoadout } from '../../engine/items';
import { Combatant } from '../../engine/types';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/** Héros « maître d'armes » : sac garni pour éprouver l'écran d'EMPLACEMENTS (fiche, onglet Combat) —
 *  couches d'armure LDB 63 (2 cuirs souples en CONFLIT sur le Corps, maille Flexible + plate
 *  superposables), cape cosmétique, et 2 sets d'armes (mêlée + arc avec munitions). */
function maitreArmes(): Combatant {
  const h = createHero({
    speciesLabel: 'Humains (Reiklander)',
    careerLabel: 'Soldat',
    name: "Maître d'armes (test)",
    motivation: 'Test',
    rng: makeRNG(2606),
    id: 'test-equipement',
  });
  const take = (label: string, equipped = false) => {
    const it = itemFromTrapping(label)!;
    it.equipped = equipped;
    return it;
  };
  h.items = [
    // Armures : Justaucorps PORTÉ ; la Veste (cuir souple aussi, Bras+Corps) doit l'ÉCHANGER à l'équipement.
    take('Justaucorps de cuir', true),
    take('Veste de cuir'),
    take('Chemise de mailles'), // Flexible : se superpose au cuir souple ET à la plate (PA cumulés)
    take('Plastron'), // couche extérieure rigide
    take('Calotte de cuir'),
    take('Jambières en cuir'),
    // Cape (emplacement cosmétique — visible dans le dos du rig une fois portée).
    take('Cape'),
    // Armes : Set I mêlée (rapière + bouclier — 1 main chacune), Set II distance (arc + flèches) ;
    // l'Épée bâtarde (2M) au sac permet d'éprouver le grisage du slot secondaire.
    take('Rapière', true),
    take('Bouclier', true),
    take('Épée bâtarde'),
    take('Arc', true),
    take('Flèche'),
  ];
  // L'inventaire de carrière est REMPLACÉ : on régénère les sets par défaut (sinon les slots
  // pointeraient les uids des anciens trappings, élagués au recompute → sets vides).
  h.loadouts = undefined;
  h.activeLoadoutId = undefined;
  recomputeLoadout(h);
  h.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.5 };
  return h;
}

const scene = arena({ id: 'test-equipement', nom: "Équipement — emplacements & couches d'armure", w: 12, h: 8 });
scene.startMessage =
  "Ouvrez la fiche du héros (portrait), onglet Combat : équipez les couches (la Veste doit remplacer le Justaucorps — même couche), superposez maille + plate, portez la cape, basculez Set I/Set II.";

export const scenario: TestScenario = {
  id: 'equipement',
  order: 20,
  icon: '🛡️',
  title: 'Équipement',
  tests:
    "Écran d'emplacements : couches LDB 63 (souple/Flexible/rigide, échange auto en cas de conflit), affichage de la couche du dessus sur le rig, cape cosmétique, 2 sets d'armes fixes.",
  partyNote: 'Soldat solo, sac garni (cuirs en conflit, maille, plate, cape, épée/bouclier + arc)',
  makeParty: () => [maitreArmes()],
  scene,
};
