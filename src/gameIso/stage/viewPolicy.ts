/**
 * POLITIQUE DE VUE de l'écran de jeu (#1176, P3-5) — module PUR : d'un REGARD (plateau iso, plateau
 * du dessus, première personne) il dérive les verdicts de STYLE que l'écran applique. Aucun DOM,
 * aucune scène, aucun store.
 *
 * FRONTIÈRE : style = ce qu'on choisit de MONTRER ; géométrie = ce que la projection rend POSSIBLE.
 * Les `isSquareView` de `authoring/detailSvg.ts` et `authoring/wallsSvg.ts` disent une vérité de
 * PROJECTION (une vue du dessus n'a aucune face verticale à peindre) : ils ne migrent pas ici, et
 * ce module n'a rien à leur dire. Ici ne vivent que des choix — un toit qu'on retire pour voir le
 * plancher, un soleil qu'on n'allume pas, une nappe qu'on ne monte pas.
 *
 * UN VERDICT DE PLUS = UNE LIGNE : c'est le point de ce module. Les verdicts de PION (D2) et de
 * GRILLE (D3) du même chantier s'y poseront de la même façon, sans nouveau site de décision.
 */
import { isSquareView, type ViewMode } from '../../geometry/iso';

/** Le REGARD porté sur le monde, réduit à ce dont le style dépend. `pov` prime : la première personne
 *  n'a pas de projection de plateau. */
export interface RegardVue {
  /** Première personne (`StageFrame` en mode `pov`). */
  pov?: boolean;
  /** Projection du regard de PLATEAU (`Dims.view`) — losange par défaut. Ignorée en POV. */
  view?: ViewMode;
}

/** Ce que l'écran CHOISIT de montrer sous ce regard. */
export interface StyleVue {
  /** Les toitures se dessinent-elles ? En vue du DESSUS, le découvert est PERMANENT : on regarde un
   *  plancher à la verticale, une nappe posée dessus ne montrerait que sa propre tuile. La loi de
   *  dégagement (`clearedSpace`/`lidCutaway`) continue de vivre entière sur le plateau iso. */
  toitsVisibles: boolean;
  /** Un seul ÉTAGE rendu (l'actif), au lieu de l'actif plus le contrebas : superposer le rez à
   *  l'étage rend le plan illisible. Verdict des ÉLÉMENTS de scène comme de la masse cuite — les deux
   *  sites en dépendent ensemble (couche des builders, masque du monde). */
  etageIsole: boolean;
  /** Les NAPPES de brume authorée (#1247) se montent-elles dans le volume ? Raison PROPRE, sans
   *  rapport avec les toitures : à 90° de tangage les nappes se projettent l'une sur l'autre et
   *  l'empilement dégénère en voile plein écran ; la première personne, elle, a sa brume de distance.
   *  Ce verdict coïncide avec `toitsVisibles` par ACCIDENT sur le plateau du dessus, jamais par
   *  dérivation. */
  nappesMonde: boolean;
  /** Le SEMIS d'intempéries (pluie, neige) se monte-t-il ? À 90° de tangage, une particule de pluie
   *  est un segment VERTICAL vu dans son axe : un point immobile, rien à lire — le semis coûte sa
   *  géométrie et sa passe de frame pour zéro information. La météo continue de peser sur cette vue
   *  par ses canaux NON particulaires (teinte des lampes, fond de canevas, palier d'exposition —
   *  `weatherLightScalars`), qu'aucun regard ne gate. Corollaire : sans pluie, plus rien à écrêter
   *  sous un toit retiré (#1247) — l'écrêtage n'a pas de cas à traiter en vue du dessus. */
  precipitations: boolean;
  /** Le RÉGIME SOLAIRE est-il allumé ? Verdict passé à la décision de lumière (`stageLights`), qui
   *  l'applique sur le FONDU : la vue du dessus rend donc le régime SANS SOLEIL complet — aucune
   *  ombre portée en travers du plateau (elle couche la silhouette des masses sur les cases et
   *  brouille la lecture), modelé de forme PLEIN (`shadeSousSoleil` à `fade = 0`), exposition du
   *  monde et des pions appariée PAR CONSTRUCTION. EFFET VOULU, non un effet de bord : `lit` étant
   *  faux, les pions retrouvent leur DISQUE DE CONTACT (`wantsContactShadow`) — le socle de figurine,
   *  idiome de plateau, qui reprend l'ancrage au sol que l'ombre portée donnait en iso. L'ambiante,
   *  donc le palier jour/nuit, ne dépend d'aucun regard : la nuit reste la nuit. */
  ombreSoleil: boolean;
  /** Un couple MONTÉ se rend-il en deux pions distincts (`buildTokens`, paramètre `top`) ? Valeur
   *  d'aujourd'hui, relocalisée ici : la loi des pions se décide au lot D2. */
  montesDissocies: boolean;
}

/** Les verdicts de style de ce regard. */
export function viewPolicy(regard: RegardVue): StyleVue {
  const pov = regard.pov === true;
  const dessus = !pov && isSquareView(regard.view);
  return {
    toitsVisibles: !dessus,
    etageIsole: dessus,
    nappesMonde: !pov && !dessus,
    precipitations: !dessus,
    ombreSoleil: !dessus,
    montesDissocies: dessus,
  };
}
