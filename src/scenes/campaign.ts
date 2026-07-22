/** Index de la campagne. La campagne de LANCEMENT est l'Arène (projet de DONNÉES éditeur — cf.
 *  src/scenes/arene/arene-projet.json, créable/éditable dans l'éditeur, paquet de campagne
 *  `{schema:3, scenes, worldMap, narratif}`) : `campaign[0]` est sa scène d'entrée, toutes ses scènes
 *  (bourg + zones + expéditions) sont enregistrées → les transitions résolvent, et sa carte du
 *  monde alimente le voyage (#T2). */
import { Scene } from '../state/scene';
import { WorldMap, emptyWorldMap, parseProject } from '../state/worldMap';
import type { NarratifBlock } from '../state/campaignNarratif';
import areneProjet from './arene/arene-projet.json';
import loupEtSaumureProjet from './loup-et-saumure/loup-et-saumure-projet.json';
import bargeDuSelProjet from './barge-du-sel/barge-du-sel-projet.json';

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
  label: string;
  icon: string;
  scenes: Scene[];
  startSceneId: string;
  worldMap: WorldMap | null;
  /** Bloc narratif du paquet (schema 3, #765) — acheminé au runtime par `loadProject` (#767). */
  narratif: NarratifBlock;
}

const loupEtSaumure = parseProject(loupEtSaumureProjet);
const bargeDuSel = parseProject(bargeDuSelProjet);

/** Campagnes BUILT-IN proposées au picker en plus de l'Arène (chemin `pendingCampaign: null`
 *  historique). Ajouter une campagne étalon = un item ICI, jamais un chemin parallèle. */
export const builtinCampaigns: BuiltinCampaign[] = [
  {
    id: 'loup-et-saumure',
    label: 'Le Loup et la Saumure',
    icon: 'scenario/naval',
    scenes: loupEtSaumure.scenes,
    startSceneId: loupEtSaumure.scenes[0].id,
    worldMap: loupEtSaumure.worldMap ?? null,
    narratif: loupEtSaumure.narratif,
  },
  {
    id: 'barge-du-sel',
    label: 'La Barge du Sel',
    icon: 'scenario/naval',
    scenes: bargeDuSel.scenes,
    startSceneId: bargeDuSel.scenes[0].id,
    worldMap: bargeDuSel.worldMap ?? null,
    narratif: bargeDuSel.narratif,
  },
];

/** L'Arène (chemin `pendingCampaign: null` historique) sous la MÊME forme `BuiltinCampaign`, pour
 *  la réutiliser partout où une liste homogène est nécessaire (#367 : « Ouvrir » de l'éditeur). */
export const areneCampaign: BuiltinCampaign = {
  id: 'arene',
  label: "L'Arène",
  icon: 'scenario/arena',
  scenes: arene.map((c) => c.scene),
  startSceneId: arene[0].id,
  worldMap: campaignWorldMap,
  narratif: projet.narratif,
};

/** Toutes les campagnes BUILT-IN (Arène + `builtinCampaigns`), source unique pour tout listing
 *  homogène (picker de campagne ET « Ouvrir » de l'éditeur, #367). */
export const allBuiltinCampaigns: BuiltinCampaign[] = [areneCampaign, ...builtinCampaigns];
