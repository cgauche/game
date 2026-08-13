/**
 * ORDRE DE RENDU du monde volumique (#1176, #1247) — la table UNIQUE des `renderOrder` de l'écran de
 * jeu. Chaque famille d'objets montés y a son rang nommé ; aucun site ne pose de littéral.
 *
 * POURQUOI UNE TABLE, ET PAS LE TRI DE THREE. Le tri par défaut range les objets TRANSPARENTS par
 * profondeur de leur CENTRE (`painterSortStable` : `renderOrder`, puis `groupOrder`, puis `z`). Trois
 * familles de cet écran n'écrivent PAS la profondeur (`depthWrite: false` — jumeaux de silhouette,
 * marques et halos, semis d'intempéries) et deux d'entre elles couvrent la carte entière : leur centre
 * est le centre de la carte, donc leur ordre relatif est le hasard de l'ordre de montage React. La
 * nappe de brume ajoute le cas franc : elle partage son centroïde avec le semis de pluie.
 *
 * LA LOI, du plus loin au plus près de l'œil :
 *  - `jumeau` passe AVANT tout : il ne peint que des pixels OCCLUS (test de profondeur retourné), et
 *    rendu après les corps il couvrirait des jetons VISIBLES (#1297) ;
 *  - `monde` = la matière (géométrie cuite, accents de sol) et les marques de CASES posées dessus ;
 *  - `pions` = les billboards et leurs ombres de contact ;
 *  - `pluie` puis `nappe` : les intempéries se peignent sur le monde et sur les pions — c'est ce
 *    qu'être DANS l'averse veut dire ; la nappe passe après la pluie, dont elle est le fond ;
 *  - `chrome` au sommet : marques dynamiques et halos d'interaction ne se voilent JAMAIS — ce sont
 *    des affordances, et c'est la même raison qui leur donne déjà `fog: false`.
 *
 * CE QUE LE RANG `jumeau` COÛTE, en fait : le jumeau de silhouette (#1297) est le double d'une
 * affordance (anneau d'équipe, corps hors-vue), mais il passe AVANT la pluie et la nappe — il est donc
 * VOILÉ par elles, là où le chrome dont il est le double ne l'est jamais. Ce n'est pas un oubli : sa
 * position est CONTRAINTE par le test de profondeur retourné qui le définit. Il ne peint que les pixels
 * déjà écrits par le monde, donc il doit passer avant les billboards — qui trichent de 0,3 m vers la
 * caméra et écrivent leur profondeur ensuite ; rendu après eux, il couvrirait des corps VISIBLES. Un
 * rang au-dessus des intempéries lui coûterait cette garantie ; sous une averse dense, une silhouette
 * à travers un mur se lit donc à travers la pluie qui la couvre.
 *
 * PORTÉE : `renderOrder` ne trie qu'à l'INTÉRIEUR d'un groupe de rendu (three dessine tous les opaques
 * avant tous les transparents). Les rangs ci-dessous départagent donc les familles TRANSLUCIDES entre
 * elles ; les inscrire aussi sur les familles opaques rend la table TOTALE — aucune famille montée par
 * cet écran n'est hors registre, et une famille de plus se pose ici avant de se monter.
 */

/** Une famille d'objets montés, dans l'ordre de peinture. */
export type RenderRank = 'jumeau' | 'monde' | 'pions' | 'pluie' | 'nappe' | 'chrome';

/** Les familles, du plus tôt peint au plus tard. */
export const RENDER_RANKS: readonly RenderRank[] = ['jumeau', 'monde', 'pions', 'pluie', 'nappe', 'chrome'];

/** Le `renderOrder` de chaque famille. `monde` vaut 0 : c'est le défaut de three, donc tout objet
 *  monté sans rang tombe avec la matière — jamais au-dessus du chrome. */
export const RENDER_ORDER: Record<RenderRank, number> = {
  jumeau: -1,
  monde: 0,
  pions: 1,
  pluie: 2,
  nappe: 3,
  chrome: 4,
};

/** Pose le rang d'une famille sur un objet monté, et le rend. UNE écriture, au site du montage. */
export function withRenderRank<T extends { renderOrder: number }>(objet: T, rang: RenderRank): T {
  objet.renderOrder = RENDER_ORDER[rang];
  return objet;
}
