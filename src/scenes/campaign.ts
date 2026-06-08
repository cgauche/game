/** Index de la campagne. La campagne de LANCEMENT est l'Arène (projet de DONNÉES éditeur — cf.
 *  src/scenes/arene/arene-projet.json, créable/éditable dans l'éditeur) : `campaign[0]` est sa scène
 *  d'entrée, et toutes ses scènes (hub + zones) sont enregistrées → les transitions résolvent. Les
 *  scènes du Tome 1 restent enregistrées (sceneRegistry : éditeur/tests) mais ne sont plus le départ. */
import { Scene } from '../state/scene';
import { tome1Intro } from './tome1-intro';
import { tome1Auberge } from './tome1-auberge';
import { tome1Route } from './tome1-route';
import areneProjet from './arene/arene-projet.json';

export interface CampaignChapter {
  id: string;
  tome: number;
  title: string;
  scene: Scene;
}

const arene: CampaignChapter[] = (areneProjet as unknown as Scene[]).map((s) => ({ id: s.id, tome: 0, title: s.nom, scene: s }));

export const campaign: CampaignChapter[] = [
  ...arene, // campaign[0] = arene-zone1 (départ de « Nouvelle partie »)
  { id: 'tome1-intro', tome: 1, title: "Tome 1 — L'Ennemi dans l'Ombre : La Diligence", scene: tome1Intro },
  { id: 'tome1-auberge-interieur', tome: 1, title: 'Tome 1 — La Diligence : la Grande Salle', scene: tome1Auberge },
  { id: 'tome1-route', tome: 1, title: "Tome 1 — La route d'Altdorf", scene: tome1Route },
];
