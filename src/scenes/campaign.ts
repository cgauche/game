/** Index de la campagne. La campagne de LANCEMENT est l'Arène (projet de DONNÉES éditeur — cf.
 *  src/scenes/arene/arene-projet.json, créable/éditable dans l'éditeur, paquet de campagne
 *  `{schema:6, <identité>, scenes, worldMap, narratif}`) : `campaign[0]` est sa scène d'entrée, toutes ses scènes
 *  (bourg + zones + expéditions) sont enregistrées → les transitions résolvent, et sa carte du
 *  monde alimente le voyage (#T2). */
import { Scene } from '../state/scene';
import { WorldMap, emptyWorldMap, parseProject } from '../state/worldMap';
import type { NarratifBlock } from '../state/campaignNarratif';
import areneProjet from './arene/arene-projet.json';
import loupEtSaumureProjet from './loup-et-saumure/loup-et-saumure-projet.json';
import bargeDuSelProjet from './barge-du-sel/barge-du-sel-projet.json';
import diligenceProjet from './diligence/diligence-projet.json';

export interface CampaignChapter {
  id: string;
  tome: number;
  title: string;
  scene: Scene;
}

const projet = parseProject(areneProjet);

const arene: CampaignChapter[] = projet.scenes.map((s) => ({ id: s.id, tome: 0, title: s.label, scene: s }));

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
  /** Bloc narratif du paquet (#765) — acheminé au runtime par `loadProject` (#767). */
  narratif: NarratifBlock;
}

/**
 * Identité d'une campagne BUILT-IN, DÉRIVÉE de son paquet (#1467 L1b V-formeProjet) — jamais re-tapée
 * ici. Elle vit à la RACINE du document depuis l'aplatissement de l'enveloppe, donc `parseProject`
 * la rend déjà : la DONNÉE fait foi, et le seul moyen de changer l'`icon`/le `label` d'une campagne
 * est d'éditer son générateur (`scripts/<campagne>/generate.mjs`), pas ce fichier.
 *
 * La duplication qui vivait ici avait DÉRIVÉ en silence : l'Arène portait `icon: 'scenario/arena'` et
 * un label à apostrophe ASCII, là où son paquet dit `scenario/village` et une apostrophe
 * typographique. C'est l'écran qui lisait la copie, donc la copie qui gagnait.
 */
function identiteDe(
  doc: { id?: string; label?: string; icon?: string },
  fichier: string,
): { id: string; label: string; icon: string } {
  const { id, label, icon } = doc;
  if (!id || !label || !icon) {
    throw new Error(
      `${fichier} : paquet de campagne BUILT-IN sans identité complète à la racine ` +
      `(id=${JSON.stringify(id)}, label=${JSON.stringify(label)}, icon=${JSON.stringify(icon)}) — ` +
      `une campagne exposée au picker doit être identifiée par SON document.`,
    );
  }
  return { id, label, icon };
}

const loupEtSaumure = parseProject(loupEtSaumureProjet);
const bargeDuSel = parseProject(bargeDuSelProjet);
const diligence = parseProject(diligenceProjet);

/** « La Diligence » — chapitre 1 de L'Ennemi Intérieur : paquet éditeur portant SES scènes
 *  (`diligence.scenes`, la première étant l'entrée) et la carte du monde du chapitre. Exposée à part
 *  (comme `areneCampaign`) pour que ses Scènes se réutilisent sans re-parser le paquet. */
export const diligenceCampaign: BuiltinCampaign = {
  ...identiteDe(diligence, 'diligence-projet.json'),
  scenes: diligence.scenes,
  startSceneId: diligence.scenes[0].id,
  worldMap: diligence.worldMap ?? null,
  narratif: diligence.narratif,
};

/** Campagnes BUILT-IN proposées au picker en plus de l'Arène (chemin `pendingCampaign: null`
 *  historique). Ajouter une campagne étalon = un item ICI, jamais un chemin parallèle. */
export const builtinCampaigns: BuiltinCampaign[] = [
  {
    ...identiteDe(loupEtSaumure, 'loup-et-saumure-projet.json'),
    scenes: loupEtSaumure.scenes,
    startSceneId: loupEtSaumure.scenes[0].id,
    worldMap: loupEtSaumure.worldMap ?? null,
    narratif: loupEtSaumure.narratif,
  },
  {
    ...identiteDe(bargeDuSel, 'barge-du-sel-projet.json'),
    scenes: bargeDuSel.scenes,
    startSceneId: bargeDuSel.scenes[0].id,
    worldMap: bargeDuSel.worldMap ?? null,
    narratif: bargeDuSel.narratif,
  },
  diligenceCampaign,
];

/** L'Arène (chemin `pendingCampaign: null` historique) sous la MÊME forme `BuiltinCampaign`, pour
 *  la réutiliser partout où une liste homogène est nécessaire (#367 : « Ouvrir » de l'éditeur). */
export const areneCampaign: BuiltinCampaign = {
  ...identiteDe(projet, 'arene-projet.json'),
  scenes: arene.map((c) => c.scene),
  startSceneId: arene[0].id,
  worldMap: campaignWorldMap,
  narratif: projet.narratif,
};

/** Toutes les campagnes BUILT-IN (Arène + `builtinCampaigns`), source unique pour tout listing
 *  homogène (picker de campagne ET « Ouvrir » de l'éditeur, #367). */
export const allBuiltinCampaigns: BuiltinCampaign[] = [areneCampaign, ...builtinCampaigns];
