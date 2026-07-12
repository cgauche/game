import { makeShowcaseParty, PREGEN } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import type { TestScenario } from './_shared';

// Équipage EXPOSÉ de la barge amie = 2 héros du groupe (comme la vitrine navale) : sur un Coup Critique de
// coque « Gréement » ou « Superstructure » (T2C ch.5), toute personne SUR LE PONT (`crewTarget:'deck'`)
// encaisse un Test d'Initiative sous peine de +5 Dégâts (échardes) — ces 2 héros y sont exposés.
const CREW = [`pregen-${PREGEN.soldat}`, `pregen-${PREGEN.chasseur}`] as const;

/**
 * Embuscade fluviale (Mort sur le Reik – Compagnon, ch.5 + ch.12-13) — vitrine JOUABLE de la chaîne de
 * combat de BATEAU FLUVIAL, distincte de la mer (MDG) par ses DONNÉES :
 *  - chaque bateau est une COQUE à PV (`barge-fluviale`/`barque-fluviale`, `hull.propulsion:'fluvial'` +
 *    `locationTable:'navire-fluvial'` + `criticalTable:'river-criticals'`) → un Coup Critique se résout sur
 *    les tables T2C ch.5 (Localisation Gréement/Rames/Gouvernail/Coque/Superstructure ; effets États
 *    **Dérive** / **Gouvernail brisé** / **Voie d'eau**, Éclats **+5**), et NON sur les tables navales MDG ;
 *  - des PIRATES fluviaux (ch.12) sont l'ÉQUIPAGE EXPOSÉ de leur barque (`crewIds`) : un Critique « Équipage »
 *    ou les Éclats leur reviennent, comme en mer ;
 *  - une **Anguille du Reik** (bestiaire ch.13 : F65, Morsure +8, Constricteur, Taille Grande) surgit de
 *    l'eau — elle peut mordre l'ÉQUIPAGE ou s'en prendre à une COQUE.
 * Tout est SÉLECTIONNÉ EN DONNÉE (les refs de coque portent leurs tables) : zéro branche « fluvial » codée.
 */
const scene = buildScene({
  id: 'test-embuscade-fluviale',
  nom: 'Embuscade fluviale',
  size: [18, 12],
  terrain: 'planches',
  heroStart: [3, 7],
  startMessage:
    'Le batelier hurle et pointe l’aval : « Pirates à bâbord — et quelque chose de gros remue sous l’eau ! » Une ' +
    'barque hérissée de rames fond sur la barge, son équipage prêt à l’abordage. Entre les deux coques, l’onde se ' +
    'creuse : une anguille du Reik, énorme, s’enroule déjà autour d’un espar. Un Coup Critique sur le bois de la ' +
    'barge peut briser le gréement, les rames ou le gouvernail, envoyer des éclats voler ou ouvrir une voie d’eau — ' +
    'gare à quiconque reste sur le pont. Repoussez l’abordage et abattez l’anguille !',
  encounters: [
    {
      id: 'enc-fluvial',
      enemies: [
        // index 0 = la BARQUE pirate (coque T2C) ; équipage exposé = les pirates (index 1-3).
        { ref: 'barque-fluviale', pos: { x: 14, y: 6 }, label: 'Barque des pirates',
          crewIds: ['enemy-enc-fluvial-1', 'enemy-enc-fluvial-2', 'enemy-enc-fluvial-3'] },
        { ref: 'pirate-fluvial', pos: { x: 12, y: 5 } },
        { ref: 'pirate-fluvial', pos: { x: 12, y: 7 } },
        { ref: 'chef-pirate', pos: { x: 15, y: 6 } },
        // index 4 = l'ANGUILLE DU REIK, dans l'eau entre les deux bateaux.
        { ref: 'anguille-du-reik', pos: { x: 8, y: 6 }, label: 'Anguille du Reik' },
        // index 5 = la BARGE des aventuriers (coque T2C), côté allié ; équipage exposé = 2 héros du pont.
        { ref: 'barge-fluviale', pos: { x: 3, y: 6 }, side: 'ally', label: 'Barge des aventuriers',
          crewIds: [...CREW] },
      ],
    },
  ],
});

export const scenario: TestScenario = {
  id: 'embuscade-fluviale',
  order: 16,
  category: 'naval',
  icon: 'scenario/naval',
  title: 'Embuscade fluviale',
  tests:
    'Combat de bateau FLUVIAL (T2C ch.5) distinct de la mer par ses DONNÉES : coques `barge-fluviale`/' +
    '`barque-fluviale` portant `locationTable:navire-fluvial` + `criticalTable:river-criticals` → un Coup ' +
    'Critique tire la Localisation T2C (Gréement/Rames/Gouvernail/Coque/Superstructure) et ses effets ' +
    '(États Dérive / Gouvernail brisé / Voie d’eau, Éclats +5, Test d’Initiative « sur le pont ») via le MÊME ' +
    'moteur naval MDG ; équipage exposé lié (crewIds) → Éclats/critique « Équipage » sur de vrais pirates ; ' +
    'bestiaire ch.13 : Anguille du Reik (Constricteur, Morsure +8, Taille Grande).',
  partyNote: 'Groupe d’arène ; 2 héros sont l’équipage exposé de la barge (Éclats / Test d’Initiative de pont)',
  makeParty: makeShowcaseParty,
  scene,
  autoCombat: 'enc-fluvial',
};
