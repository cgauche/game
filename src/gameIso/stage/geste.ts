/**
 * LE geste du pointeur — composé par le hook ET par la sonde de recette, jamais deux copies.
 *
 * Ce que le picking rend est un VERDICT de pixel (`stage/pickResolve.ts`) ; ce que le GESTE traite
 * sous ce verdict est une autre question, et elle se tranche ICI : quelle entité un clic servirait, et
 * laquelle l'affordance annonce. Le hook (`stage/useStagePointer.ts`) et la sonde de recette
 * (`stage/pickProbe.ts`) l'appellent tous les deux — une sonde qui ne jouerait que l'entonnoir de
 * résolution rapporterait `nature:'case'` là où le clic ouvre un dialogue.
 *
 * Module FEUILLE et PUR : aucun React, aucun accès au rendu, aucune lecture de store — la scène, le
 * verdict et la case lui sont TENDUS.
 */
import { entitesEnCaseEtage } from '../../state/decorIndex';
import { estUtilisable } from '../../state/usable';
import type { Pt } from '../../state/path';
import type { Scene, SceneEntity } from '../../state/scene';
import type { Verdict } from './pickResolve';

/** L'entité que le geste traite sous ce verdict. Le RAYON prime : quand il a nommé une entité, c'est
 *  celle-là qu'on VOIT sous le pixel, même si une autre partage sa case. Sinon la question est la
 *  CASE, et elle se lit à l'index d'ancrage (`state/decorIndex.ts:entitesEnCaseEtage`, O(1) par
 *  mouvement de souris) : l'UTILISABLE d'abord (`state/usable.ts:estUtilisable`, dériveur unique de
 *  l'offre) — c'est elle que l'affordance annonce —, la première du document à défaut. */
export const entiteDuGeste = (sc: Scene, v: Verdict, t: Pt): SceneEntity | undefined => {
  if (v.nature === 'entite') return sc.entities.find((e) => e.id === v.entId);
  const surLaCase = entitesEnCaseEtage(sc, t.x, t.y, t.z ?? 0);
  return surLaCase.find((e) => estUtilisable(sc, e)) ?? surLaCase[0];
};
