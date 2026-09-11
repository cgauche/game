/**
 * LE geste du pointeur — composé par le hook ET par la sonde de recette, jamais deux copies.
 *
 * Ce que le picking rend est un VERDICT de pixel (`stage/pickResolve.ts`) ; ce que le GESTE traite
 * sous ce verdict est une autre question, et elle se tranche ICI : quelle entité un clic servirait, et
 * laquelle l'affordance annonce. Le hook (`stage/useStagePointer.ts`) et la sonde de recette
 * (`stage/pickProbe.ts`) l'appellent tous les deux — une sonde qui ne jouerait que l'entonnoir de
 * résolution rapporterait `nature:'case'` là où le clic ouvre un dialogue.
 *
 * Il porte aussi LA table des gestes d'ARÊTE (`GESTES`, lot 1b-3) : une capacité, une ligne, lue par
 * les deux déclencheurs — le verdict de pixel et le clavier du peintre.
 *
 * Module FEUILLE et PUR : aucun React, aucun accès au rendu, aucune lecture de store — la scène, le
 * verdict, la case et les VERBES lui sont TENDUS.
 */
import { entitesEnCaseEtage } from '../../state/decorIndex';
import { estUtilisable } from '../../state/usable';
import { caseOpposee, type AreteUtilisable, type CapaciteArete } from '../../state/aretes';
import type { RoomPortal } from '../../state/roomPortals';
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

/** Les verbes que le porteur du geste tend à la table : franchir un seuil (marche différée, ouverture
 *  d'un battant — il vit dans le hook, qui tient le survol et le pas à pas), grimper, sauter. */
export interface VerbesArete {
  franchir: (portail: RoomPortal) => void;
  grimper: (de: Pt, vers: Pt) => void;
  sauter: (de: Pt, vers: Pt) => void;
}

/** Dénivelé : le geste part de l'ancrage et va à la case d'en face (`state/aretes.ts:caseOpposee`). */
const traverser = (arete: AreteUtilisable, verbe: (de: Pt, vers: Pt) => void) => {
  const vers = caseOpposee(arete);
  if (arete.ancrage && vers) verbe(arete.ancrage, vers);
};

/**
 * LA table capacité → geste. Une capacité y a UNE ligne, et les deux déclencheurs (verdict de pixel,
 * touche Entrée/Espace du peintre) la lisent par `jouerArete` — jamais un `if` par capacité recopié
 * dans le hook. `structure` n'y figure pas : son geste (`battleClickEntity` par `cid`) est porté par
 * `SiegeHitAreas` (lot 1b-4), et le contexte que l'hôte dérive exclut cette capacité (`battle: null`).
 */
const GESTES: Readonly<Partial<Record<CapaciteArete, (arete: AreteUtilisable, verbes: VerbesArete) => void>>> = {
  porte: (arete, { franchir }) => { if (arete.portail) franchir(arete.portail); },
  escalade: (arete, { grimper }) => traverser(arete, grimper),
  chute: (arete, { sauter }) => traverser(arete, sauter),
};

/** LE geste d'une arête, quelle que soit sa capacité et quel qu'en soit le déclencheur. */
export const jouerArete = (arete: AreteUtilisable, verbes: VerbesArete): void => {
  GESTES[arete.capacite]?.(arete, verbes);
};
