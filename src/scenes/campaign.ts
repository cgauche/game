/** Index de la campagne. La campagne de LANCEMENT est l'Arène (projet de DONNÉES éditeur — cf.
 *  src/scenes/arene/arene-projet.json, créable/éditable dans l'éditeur, format projet v2
 *  `{schema:2, scenes, worldMap}`) : `campaign[0]` est sa scène d'entrée, toutes ses scènes
 *  (bourg + zones + expéditions) sont enregistrées → les transitions résolvent, et sa carte du
 *  monde alimente le voyage (#T2). */
import { Scene } from '../state/scene';
import { WorldMap, emptyWorldMap, parseProject } from '../state/worldMap';
import areneProjet from './arene/arene-projet.json';
import loupEtSaumureProjet from './loup-et-saumure/loup-et-saumure-projet.json';

export interface CampaignChapter {
  id: string;
  tome: number;
  title: string;
  scene: Scene;
}

const projet = parseProject(areneProjet);

const arene: CampaignChapter[] = projet.scenes.map((s) => ({ id: s.id, tome: 0, title: s.nom, scene: s }));

export const campaign: CampaignChapter[] = [...arene]; // campaign[0] = arene-zone1 (départ de « Nouvelle partie »)

/** Carte du monde de la campagne (#T2 Voyage) — celle du projet arène (un projet éditeur chargé
 *  via loadProject la remplace). */
export const campaignWorldMap: WorldMap = projet.worldMap ?? emptyWorldMap();

/** Une campagne BUILT-IN (embarquée au build, pas dans le localStorage) — même forme que
 *  `GameState['pendingCampaign']` (`state/store.ts`) : le picker de campagne (`CampaignSelect`,
 *  `ui/PartyScreen.tsx`) la charge par `loadProject`, comme un projet publié de l'éditeur. #211. */
export interface BuiltinCampaign {
  id: string;
  name: string;
  icon: string;
  scenes: Scene[];
  startSceneId: string;
  worldMap: WorldMap | null;
}

const loupEtSaumure = parseProject(loupEtSaumureProjet);

/** Campagnes BUILT-IN proposées au picker en plus de l'Arène (chemin `pendingCampaign: null`
 *  historique). Ajouter une campagne étalon = un item ICI, jamais un chemin parallèle. */
export const builtinCampaigns: BuiltinCampaign[] = [
  {
    id: 'loup-et-saumure',
    name: 'Le Loup et la Saumure',
    icon: 'scenario/naval',
    scenes: loupEtSaumure.scenes,
    startSceneId: loupEtSaumure.scenes[0].id,
    worldMap: loupEtSaumure.worldMap ?? null,
  },
];
