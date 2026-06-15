import { makePregens } from '../../data/pregens';
import { buildOperaFloorplan } from '../opera/floorplan';
import type { Scene } from '../../state/scene';
import type { TestScenario } from './_shared';

/**
 * Le Théâtre Staatsoper RECONSTRUIT FIDÈLEMENT du plan officiel (NADJ p.40 rez / p.41 étage) — géométrie
 * SEULE (parterre en éventail à pans obliques, scène surélevée + fosse d'orchestre en contrebas, foyer
 * courbe, puits central bordé de loges + loge royale, escaliers). Document éditable dans l'éditeur de
 * niveau (les outils Murs/Élévation/Escalier y opèrent). La LOGIQUE de la soirée (bombe, Glimbrin,
 * Comtesse…) vit dans le scénario jouable « Opéra — Théâtre » (21) ; ici, c'est le PLAN brut, à visiter
 * et à éditer. Le contenu de campagne reste de la DONNÉE — aucune scène codée en dur.
 */
const scene: Scene = {
  ...buildOperaFloorplan(),
  entities: [{ id: 'start', kind: 'heroStart', pos: { x: 11, y: 23 } }], // dans le foyer, face au parterre
  startMessage:
    'Le Théâtre Staatsoper, reconstitué d’après les plans : du foyer, le parterre en éventail s’élève vers la scène ; au-dessus, les loges cernent le vide central, dominées par la loge royale.',
};

export const scenario: TestScenario = {
  id: 'opera-plan',
  order: 22,
  icon: '🏛',
  title: 'Opéra — Plan fidèle',
  tests:
    'Théâtre Staatsoper reconstruit du plan officiel (p.40/41) : parterre en ÉVENTAIL (murs diagonaux), SCÈNE surélevée + FOSSE d’orchestre (élévation), foyer courbe ; puits central + loges + loge royale (multi-niveaux), escaliers jumeaux. Géométrie seule — éditable dans l’éditeur (outils Murs/Élévation).',
  partyNote: 'Pré-tirés',
  makeParty: () => makePregens(),
  scene,
};
