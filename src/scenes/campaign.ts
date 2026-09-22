/** Index de la campagne. La campagne de LANCEMENT est l'Arène (projet de DONNÉES éditeur — cf.
 *  src/scenes/arene/arene-projet.json, créable/éditable dans l'éditeur, paquet de campagne
 *  `{schema:6, <identité>, scenes, worldMap, narratif}`) : `campaign[0]` est sa scène d'entrée, toutes ses scènes
 *  (bourg + zones + expéditions) sont enregistrées → les transitions résolvent, et sa carte du
 *  monde alimente le voyage (#T2). */
import { Scene } from '../state/scene';
import { WorldMap, emptyWorldMap, parseProject, documentDeProjet, type ProjectDoc, type ProjectIdentite } from '../state/worldMap';
import type { NarratifBlock } from '../state/campaignNarratif';
import type { GameState } from '../state/store';
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
export interface BuiltinCampaign extends ProjectIdentite {
  /** L'icône est REQUISE sur une campagne exposée au picker (l'enveloppe la pose optionnelle). */
  icon: string;
  scenes: Scene[];
  startSceneId: string;
  worldMap: WorldMap | null;
  /** `ProjectDoc.activeAxes` (#409), présent seulement si le paquet en déclare. */
  activeAxes?: string[];
  /** Bloc narratif du paquet (#765) — acheminé au runtime par `loadProject` (#767). */
  narratif: NarratifBlock;
}

/** La campagne LANCÉE depuis une campagne du jeu (`setPendingCampaign`), SOURCE UNIQUE de tout site
 *  qui la joue (picker de `PartyScreen`, bibliothèque de campagnes, `__wfrp.campaign`). Son paquet a
 *  passé `parseProject` au chargement de ce module. */
export function campagneDuJeu(c: BuiltinCampaign): NonNullable<GameState['pendingCampaign']> {
  return {
    id: c.id,
    label: c.label,
    scenes: c.scenes,
    startSceneId: c.startSceneId,
    worldMap: c.worldMap,
    ...(c.activeAxes !== undefined ? { activeAxes: c.activeAxes } : {}),
    narratif: c.narratif,
  };
}

/** Ce qu'OUVRE dans l'éditeur la COPIE d'une campagne du jeu (#367) — SOURCE UNIQUE de `loadBuiltin`
 *  (`ui/editor/Editor.tsx`), qui ne fait que la poser. Tout y est une copie PROFONDE : l'édition ne
 *  touche jamais le paquet commité. L'identité est ENTIÈRE (provenance comprise), sans le `label`, que
 *  l'éditeur renomme ; `activeAxes` n'y figure que si la campagne en déclare. */
export function copieDuJeu(c: BuiltinCampaign): {
  depart: Scene;
  autresScenes: Scene[];
  worldMap: WorldMap | null;
  activeAxes?: string[];
  narratif: NarratifBlock;
  identite: Omit<ProjectIdentite, 'label'>;
} {
  const depart = c.scenes.find((s) => s.id === c.startSceneId);
  if (!depart) throw new Error(`copieDuJeu : scène de départ « ${c.startSceneId} » absente de « ${c.id} »`);
  const { scenes: _sc, startSceneId: _st, worldMap, activeAxes, narratif, label: _lb, ...identite } = c;
  const copie = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  return {
    depart: copie(depart),
    autresScenes: c.scenes.filter((s) => s.id !== depart.id).map(copie),
    worldMap: worldMap ? copie(worldMap) : null,
    ...(activeAxes !== undefined ? { activeAxes: [...activeAxes] } : {}),
    narratif: copie(narratif),
    identite,
  };
}

/** Le document PORTABLE d'une campagne du jeu, rendu par son EXPORT (bibliothèque de campagnes).
 *  L'identité est RECONDUITE : un export qui la laisserait tomber rendrait un document anonyme, que
 *  sa propre porte refuserait. */
export function documentDuJeu(c: BuiltinCampaign): ProjectDoc {
  const { scenes, startSceneId: _start, worldMap, activeAxes, narratif, ...identite } = c;
  return documentDeProjet(identite, scenes, { worldMap, activeAxes, narratif });
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
function identiteDe(doc: ProjectIdentite, fichier: string): ProjectIdentite & { icon: string } {
  // `id` et `label` sont REQUIS par l'enveloppe du document (#1552) : seule l'icône reste à exiger
  // ici, et elle l'est parce que le PICKER l'affiche. Les champs d'identité sont repris NOMMÉMENT :
  // un spread reconduirait tout ce que `parseProject` rend en plus (ex. `activeAxes`) dans un objet
  // qui n'est QUE l'identité du paquet.
  const { type, id, label, icon, versionContenu, desc, auteur, source, maison } = doc;
  if (!icon) {
    throw new Error(
      fichier + ' : paquet de campagne BUILT-IN sans `icon` à la racine — une campagne exposée au picker s’y montre par son icône.',
    );
  }
  return {
    type,
    id,
    label,
    icon,
    versionContenu,
    ...(desc !== undefined ? { desc } : {}),
    ...(auteur !== undefined ? { auteur } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(maison !== undefined ? { maison } : {}),
  };
}

/** La campagne BUILT-IN DÉRIVÉE d'un paquet passé par `parseProject` — SOURCE UNIQUE de la dérivation
 *  (sa première scène est l'entrée). `activeAxes` n'y figure que si le paquet en déclare, comme pour
 *  une entrée de bibliothèque (`campagneDeLEntree`, `state/projectLibrary.ts`). */
export function campagneDuPaquet(doc: Omit<ProjectDoc, 'schema'>, fichier: string): BuiltinCampaign {
  return {
    ...identiteDe(doc, fichier),
    scenes: doc.scenes,
    startSceneId: doc.scenes[0].id,
    worldMap: doc.worldMap ?? null,
    ...(doc.activeAxes !== undefined ? { activeAxes: doc.activeAxes } : {}),
    narratif: doc.narratif,
  };
}

/** « La Diligence » — chapitre 1 de L'Ennemi Intérieur : paquet éditeur portant SES scènes
 *  (`diligence.scenes`, la première étant l'entrée) et la carte du monde du chapitre. Exposée à part
 *  (comme `areneCampaign`) pour que ses Scènes se réutilisent sans re-parser le paquet. */
export const diligenceCampaign: BuiltinCampaign = campagneDuPaquet(parseProject(diligenceProjet), 'diligence-projet.json');

/** Campagnes BUILT-IN proposées au picker en plus de l'Arène (chemin `pendingCampaign: null`
 *  historique). Ajouter une campagne étalon = un item ICI, jamais un chemin parallèle. */
export const builtinCampaigns: BuiltinCampaign[] = [
  campagneDuPaquet(parseProject(loupEtSaumureProjet), 'loup-et-saumure-projet.json'),
  campagneDuPaquet(parseProject(bargeDuSelProjet), 'barge-du-sel-projet.json'),
  diligenceCampaign,
];

/** L'Arène (chemin `pendingCampaign: null` historique) sous la MÊME forme `BuiltinCampaign`, pour
 *  la réutiliser partout où une liste homogène est nécessaire (#367 : « Ouvrir » de l'éditeur). Sa
 *  carte est `campaignWorldMap`, jamais `null`. */
export const areneCampaign: BuiltinCampaign = { ...campagneDuPaquet(projet, 'arene-projet.json'), worldMap: campaignWorldMap };

/** Toutes les campagnes BUILT-IN (Arène + `builtinCampaigns`), source unique pour tout listing
 *  homogène (picker de campagne ET « Ouvrir » de l'éditeur, #367). */
export const allBuiltinCampaigns: BuiltinCampaign[] = [areneCampaign, ...builtinCampaigns];
