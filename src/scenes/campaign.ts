/** Index de la campagne. La campagne de LANCEMENT est l'Arène (projet de DONNÉES éditeur — cf.
 *  src/scenes/arene/arene-projet.json, créable/éditable dans l'éditeur) : `campaign[0]` est sa scène
 *  d'entrée, et toutes ses scènes (hub + zones) sont enregistrées → les transitions résolvent. */
import { Scene } from '../state/scene';
import { WorldMap } from '../state/worldMap';
import areneProjet from './arene/arene-projet.json';

export interface CampaignChapter {
  id: string;
  tome: number;
  title: string;
  scene: Scene;
}

const arene: CampaignChapter[] = (areneProjet as unknown as Scene[]).map((s) => ({ id: s.id, tome: 0, title: s.nom, scene: s }));

export const campaign: CampaignChapter[] = [...arene]; // campaign[0] = arene-zone1 (départ de « Nouvelle partie »)

/** Carte du monde de la campagne (#T2 Voyage) — vide par défaut (l'arène ne voyage pas ; un projet
 *  éditeur fournit la sienne via loadProject). */
export const campaignWorldMap: WorldMap = { id: 'campagne-carte', nom: 'Carte du monde', places: [], routes: [] };
