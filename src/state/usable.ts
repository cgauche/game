/**
 * UTILISABLE — dériveur UNIQUE des actions qu'une entité de scène OFFRE au joueur (#1687).
 *
 * MODÈLE UNIQUE : `estUtilisable(scene, ent) = actionsDe(scene, ent).length > 0`. Il n'existe pas de
 * drapeau « utilisable » à interroger : une entité est utilisable parce qu'elle a quelque chose à
 * offrir, et une capacité N+1 coûte UNE ligne de ce dériveur.
 *
 * DEUX gisements, réunis ici et nulle part ailleurs :
 *  1. les CAPACITÉS D'INSTANCE, qui vivent déjà sur l'entité et se dérivent sans rien activer —
 *     `dialogueId`, `merchant`, `interact`, `tavernGame` (leurs hôtes RESTENT) ;
 *  2. l'ASSISE, si l'instance est ACTIVÉE et que son type porte des places JOUABLES
 *     (`placesJouables`, `state/seating.ts` — la seule capacité qui vive sur le TYPE, donc la seule
 *     qu'un opt-in d'instance ait à ouvrir).
 *
 * Une action AUTHORÉE sur l'instance est un TROISIÈME gisement, qui arrive avec son exécution et son
 * choix borné au lot 3 de #1687 : `SceneEntity.usable` est une enveloppe VIDE aujourd'hui.
 *
 * PUR et FEUILLE : aucune lecture de store, aucun rendu. Les libellés passent par `t()` (`MsgKey`) —
 * jamais une chaîne joueur en dur.
 */
import { t } from '../i18n';
import { placesJouables } from './seating';
import type { Scene, SceneEntity } from './scene';

/** Une action OFFERTE par une entité — ce que le joueur lira dans sa liste. */
export interface ActionOfferte {
  /** Identité STABLE : id de capacité (`parler`, `commercer`, `jouer`, `fouiller`, `sasseoir`). Le
   *  `label` est de l'AFFICHAGE. */
  id: string;
  label: string;
  /** D'où l'offre vient : capacité d'instance dérivée, ou assise du type activé. */
  origine: 'capacite' | 'assise';
}

/**
 * Les actions offertes par `ent`, dans l'ordre où le joueur les lira : capacités d'instance, puis
 * assise.
 */
export function actionsDe(scene: Scene, ent: SceneEntity): ActionOfferte[] {
  const out: ActionOfferte[] = [];
  const capacite = (id: string, label: string) => out.push({ id, label, origine: 'capacite' });
  if (ent.dialogueId) capacite('parler', t('usable.parler'));
  if (ent.merchant) capacite('commercer', t('usable.commercer'));
  if (ent.tavernGame) capacite('jouer', t('usable.jouer'));
  // La fouille n'a pas de libellé d'auteur (`SceneEntity.interact` = `{ flow, consume }`) : le
  // libellé est celui du geste, pas celui du décor — le NOM du décor est son `label`.
  if (ent.interact) capacite('fouiller', t('usable.fouiller'));
  // ASSISE : `placesJouables` porte DÉJÀ l'activation d'instance — la relire ici en ferait une
  // seconde garde, à faire diverger.
  if (placesJouables(scene, ent.id).length) out.push({ id: 'sasseoir', label: t('usable.sasseoir'), origine: 'assise' });
  return out;
}

/** Une entité APPELLE-t-elle un geste ? SOURCE UNIQUE de l'affordance (curseur main), du choix de
 *  l'entité qu'un clic sur la CASE traite, et de ce que l'éditeur montre à l'auteur — trois lectures
 *  qui mentiraient séparément. Un décor est utilisable parce qu'il OFFRE quelque chose. */
export const estUtilisable = (scene: Scene, ent: SceneEntity): boolean => actionsDe(scene, ent).length > 0;
