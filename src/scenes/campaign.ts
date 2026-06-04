/** Index de la campagne « L'Ennemi Intérieur ». PR1 : ouverture du Tome 1. */
import { Scene } from '../state/scene';
import { tome1Intro } from './tome1-intro';
import { tome1Auberge } from './tome1-auberge';
import { tome1Route } from './tome1-route';

export interface CampaignChapter {
  id: string;
  tome: number;
  title: string;
  scene: Scene;
}

export const campaign: CampaignChapter[] = [
  {
    id: 'tome1-intro',
    tome: 1,
    title: "Tome 1 — L'Ennemi dans l'Ombre : La Diligence",
    scene: tome1Intro,
  },
  {
    id: 'tome1-auberge-interieur',
    tome: 1,
    title: 'Tome 1 — La Diligence : la Grande Salle',
    scene: tome1Auberge,
  },
  {
    id: 'tome1-route',
    tome: 1,
    title: "Tome 1 — La route d'Altdorf",
    scene: tome1Route,
  },
  // Les chapitres suivants (Tomes 1-3) seront ajoutés comme documents de scène.
];
