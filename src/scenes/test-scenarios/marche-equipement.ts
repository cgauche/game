import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { itemFromTrappingById, recomputeLoadout } from '../../engine/items';
import { trappings } from '../../data';
import { Combatant } from '../../engine/types';
import { flowFromEffects } from '../../state/flow';
import { buildScene } from '../../state/mapSpec';
import type { TestScenario } from './_shared';

/**
 * « Marché & équipement » : tout le cycle objets en une échoppe. Réunit le Marchand (Acheter/Vendre/
 * Marchander/Évaluer/Réparer), les Deux marchands (armurier en direct + herboriste ouvert DEPUIS un
 * dialogue, deux archétypes) et l'Équipement (écran d'EMPLACEMENTS : couches d'armure, sets d'armes, cape).
 * Le groupe = un Négociant (épée magique non identifiée + maille endommagée + dague à vendre) et un
 * Maître d'armes (sac garni à équiper).
 */

/** Négociant : épée magique NON identifiée (qualité cachée + skin), maille endommagée, dague à vendre. */
function negociant(): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'Négociant (test)', motivation: 'Test', rng: makeRNG(2510), id: 'test-negociant' });
  // Épée bâtarde « légendaire » : qualité MAGIQUE cachée (« De plaies atroces », ADE2) + skin bleuté ;
  // identified:false → masquée tant qu'une Évaluation ne l'a pas révélée (mais ACTIVE en combat).
  const epee = itemFromTrappingById('epee-batarde')!;
  epee.qualities = [...epee.qualities, { id: 'de-plaies-atroces' }];
  epee.identified = false;
  epee.skin = { metal: '#7faaff' };
  epee.equipped = true;
  const maille = itemFromTrappingById('chemise-de-mailles')!;
  maille.damageTaken = 2; // 2 PA perdus → réparable (10 %/PA, LDB 63)
  maille.equipped = true;
  const dague = itemFromTrappingById('dague')!; // un objet à vendre
  h.items = [epee, maille, dague];
  recomputeLoadout(h);
  h.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.5 };
  return h;
}

/** Maître d'armes : sac garni pour l'écran d'EMPLACEMENTS (couches d'armure LDB 63 + 2 sets d'armes + cape). */
function maitreArmes(): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: "Maître d'armes (test)", motivation: 'Test', rng: makeRNG(2606), id: 'test-equipement' });
  const take = (label: string, equipped = false) => {
    const id = trappings.find((t) => t.label === label)!.id; // libellé → id de catalogue
    const it = itemFromTrappingById(id)!;
    it.equipped = equipped;
    return it;
  };
  h.items = [
    take('Justaucorps de cuir', true), // la Veste (même couche) doit l'ÉCHANGER à l'équipement
    take('Veste de cuir'),
    take('Chemise de mailles'), // Flexible : se superpose au cuir souple ET à la plate
    take('Plastron'), // couche extérieure rigide
    take('Calotte de cuir'),
    take('Jambières en cuir'),
    take('Cape'), // emplacement cosmétique (visible dans le dos du rig)
    take('Rapière', true), // Set I mêlée
    take('Bouclier', true),
    take('Épée bâtarde'), // 2M au sac → grisage du slot secondaire
    take('Arc', true), // Set II distance
    take('Flèche'),
  ];
  h.loadouts = undefined; // inventaire de carrière REMPLACÉ → régénérer les sets par défaut
  h.activeLoadoutId = undefined;
  recomputeLoadout(h);
  h.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.5 };
  return h;
}

const scene = buildScene({
  id: 'test-marchand',
  nom: 'Marché & équipement',
  description: 'Arène de test.',
  size: [16, 9],
  terrain: 'herbe',
  heroStart: [2, 4],
  startMessage:
    'Deux échoppes : un armurier (parlez-lui directement) et une herboriste (engagez la conversation puis demandez ' +
    'à voir ses marchandises). Faites évaluer l’épée mystérieuse du Négociant, marchandez, réparez sa maille, vendez ' +
    'sa dague. Ouvrez la fiche du Maître d’armes (onglet Combat) pour l’écran d’emplacements (couches d’armure, ' +
    'cape, bascule Set I/Set II).',
  entities: [
    // Armurier : interaction directe → la boutique s'ouvre tout de suite.
    { id: 'armurier', kind: 'personnage', label: 'Armurier', pos: { x: 7, y: 2 }, merchant: { archetype: 'armurier' } },
    // Herboriste : DIALOGUE d'abord, puis un choix ouvre sa boutique via openMerchant (vend +25 % : village isolé).
    { id: 'herboriste', kind: 'personnage', label: 'Herboriste', pos: { x: 12, y: 6 }, dialogueId: 'dlg-herbo', merchant: { archetype: 'herboriste', buyMarkup: 1.25 } },
    // Aubergiste : DIALOGUE d'abord, puis un choix ouvre les jeux de taverne via l'Effet openTavernGames.
    { id: 'aubergiste', kind: 'personnage', label: 'Aubergiste', pos: { x: 3, y: 7 }, dialogueId: 'dlg-taverne' },
  ],
  dialogues: [
    {
      id: 'dlg-herbo',
      start: 'accueil',
      nodes: [
        {
          id: 'accueil',
          speaker: 'Herboriste',
          text: 'Bonjour, voyageur. Cherchez-vous des remèdes… ou seulement à bavarder ?',
          choices: [
            { text: 'Montrez-moi vos marchandises.', flow: flowFromEffects([{ type: 'openMerchant', entityId: 'herboriste' }]) },
            { text: 'Une autre fois. (Partir)' },
          ],
        },
      ],
    },
    {
      id: 'dlg-taverne',
      start: 'accueil',
      nodes: [
        {
          id: 'accueil',
          speaker: 'Aubergiste',
          text: 'La salle est chaude et les dés roulent. Une partie, l’ami ?',
          choices: [
            { text: 'Volontiers — proposez-nous une partie.', flow: flowFromEffects([{ type: 'openTavernGames' }]) },
            { text: 'Plus tard. (Partir)' },
          ],
        },
      ],
    },
  ],
  triggers: [
    // Bourse de départ (la nouvelle partie réinitialise l'argent à 0) — versée en s'avançant vers les échoppes.
    { id: 'bourse', rect: { x: 3, y: 3, w: 8, h: 4 }, once: true, flow: flowFromEffects([{ type: 'giveMoney', gold: 60 }, { type: 'journal', text: 'Vous disposez de 60 couronnes.' }]) },
  ],
});

export const scenario: TestScenario = {
  id: 'marche-equipement',
  order: 7,
  category: 'marche',
  icon: 'scenario/market',
  title: 'Marché & équipement',
  tests:
    'Acheter/Vendre + Marchander (Test opposé −10/−20 %) + Évaluer (révèle la qualité cachée) + Réparer (10 %/PA) ; ' +
    'deux archétypes (armurier direct + herboriste via dialogue, Effet openMerchant) ; écran d’EMPLACEMENTS (couches ' +
    'd’armure LDB 63 souple/Flexible/rigide avec échange auto, cape cosmétique, 2 sets d’armes) ; Troc (onglet du ' +
    'panneau marchand : ratio de Disponibilité, échange objet↔objet sans argent) ; Aubergiste → jeux de taverne ' +
    '(Effet openTavernGames, option `tavern-games` pré-activée, NADJ ch.16).',
  partyNote: 'Négociant (épée non identifiée + maille endommagée + dague) + Maître d’armes (sac garni)',
  makeParty: () => [negociant(), maitreArmes()],
  // Jeux de taverne pré-activés (NADJ ch.16) — modifiable au panneau Règles maison, comme le Voyage par Étapes.
  rules: { 'tavern-games': true },
  scene,
};
