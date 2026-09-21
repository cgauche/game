// DÉTECTEURS PURS du PONT (#1848, #1856) — ils ne lisent qu'un RELEVÉ, jamais le DOM : c'est ce qui
// les rend testables à fixtures (`detecteurs-pont.test.mjs`, gate `test:recette`) alors que le
// contrat qu'ils gardent est un contrat de RENDU, invisible à jsdom.
// La MESURE vit dans la sonde navigateur (`console-pont-formes.mjs`), le VERDICT ici.

/**
 * SURFACE OCCULTÉE PAR UN PONT — la classe de défaut du ticket #1848 : une surface ancrée en bas du
 * champ (dialogue, tiroir du journal, fil d'événements, commandes de première personne, puce
 * d'attente) passe SOUS le pont, qui se peint par-dessus.
 *
 * Le critère est l'OCCLUSION, jamais une fraction de recouvrement : au CENTROÏDE de l'intersection
 * des deux boîtes, c'est le pont que le navigateur rend (`elementFromPoint`) alors que la surface
 * revendique ce point. Un seuil de surface (« 90 % recouverts ») aurait laissé passer le défaut
 * mesuré au ticket — 31px de dialogue sous un pont de 49px, soit un tiers de la boîte.
 *
 * `touche` dit QUI répond au centroïde : `pont` (défaut), `surface`, `autre`, `rien` — ou
 * `descendant` quand la surface est PORTÉE par le pont (le tiroir-journal assis sur le pont
 * d'exploration) : le pont répond alors légitimement, et il n'y a aucune occlusion à juger.
 *
 * @param {{ vue: string, surfaces?: { nom: string, pont: string, inter: { w: number, h: number } | null, touche: string }[] }} releve
 * @returns {string[]} un défaut NOMMÉ par surface occultée (liste vide = rien d'occulté)
 */
export function surfaceOcculteeParUnPont(releve) {
  const out = [];
  for (const s of releve.surfaces ?? []) {
    if (!s.inter) continue;
    if (s.touche === 'pont') {
      out.push(`${releve.vue} : « ${s.nom} » est OCCULTÉE par ${s.pont} (intersection ${s.inter.w}×${s.inter.h}px, le pont répond au centroïde)`);
    }
  }
  return out;
}

/**
 * ÉLÉMENT HORS FENÊTRE (#1856) — un élément dont la boîte sort du viewport par la gauche ou par la
 * droite : à l'écran, il est INATTEIGNABLE (« Fin du tour » mesuré à [1040..1104] dans 1100px).
 * Tolérance d'UN pixel : un arrondi de sous-pixel n'est pas un débord.
 *
 * @param {{ vue: string, largeur: number, elements?: { nom: string, left: number, right: number }[] }} releve
 * @returns {string[]}
 */
export function elementsHorsFenetre(releve) {
  const out = [];
  for (const e of releve.elements ?? []) {
    if (e.right > releve.largeur + 1) {
      out.push(`${releve.vue} : « ${e.nom} » sort de la fenêtre par la DROITE ([${e.left}..${e.right}] pour ${releve.largeur}px)`);
    } else if (e.left < -1) {
      out.push(`${releve.vue} : « ${e.nom} » sort de la fenêtre par la GAUCHE ([${e.left}..${e.right}] pour ${releve.largeur}px)`);
    }
  }
  return out;
}
