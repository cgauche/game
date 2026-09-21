// DÉTECTEURS PURS de la HAUTEUR (#1847) — ils ne lisent qu'un RELEVÉ, jamais le DOM : c'est ce qui
// les rend testables à fixtures (`detecteurs-hauteur.test.mjs`, gate `test:recette`) alors que le
// contrat qu'ils gardent est un contrat de RENDU, invisible à jsdom.
// La MESURE vit dans la sonde navigateur (`hauteur-reelle.mjs`), le VERDICT ici.
//
// L'invariant qu'ils servent, à chacune des vues de `vues-recette.json` : l'action principale d'un
// écran est atteignable sans défiler la PAGE, et un corps de modale n'est jamais écrasé par ses
// bandes.

/** Une boîte COUVRE le viewport si ses quatre bords y collent : elle n'est plus un cadre DANS un
 *  écran, elle EST l'écran. Tolérance d'UN pixel, comme partout ici. */
function couvreLeViewport(boite, fenetre) {
  if (!boite || !fenetre) return false;
  return boite.left <= 1 && boite.top <= 1
    && boite.right >= fenetre.largeur - 1 && boite.bottom >= fenetre.hauteur - 1;
}

/**
 * SCROLLPORT DE PAGE — mesure FONDATRICE du ticket (#1847) : à 1366×650, la carte du menu principal
 * faisait 782px et ce qui défilait était la surface plein champ qui la porte. Rien d'ancré ne le
 * restait, et l'action principale pouvait sortir de l'écran.
 *
 * Le critère est structurel, jamais une valeur d'écran : **le scrollport ne doit jamais être
 * `document.scrollingElement` — ni un élément qui en tient lieu.** Une boîte défilante qui COUVRE
 * tout le viewport est le scrollport de page sous un autre nom : la distinction « page » / « cadre »
 * ne se lit pas au nom de l'élément, elle se lit à sa BOÎTE.
 * Un contenu plus haut que la fenêtre reste légitime — il défile DANS un cadre (`.screen-scroll`,
 * le corps d'une carte, un inspecteur), et ce qui est autour de ce cadre, lui, ne bouge pas.
 *
 * `defileurs` sert des deux côtés du verdict : il porte les cadres qui en tiennent lieu (jugés) et
 * dit, quand la page déborde, où le contenu aurait dû aller.
 *
 * @param {{ vue: string, ecran: string, page: { scrollH: number, clientH: number },
 *           fenetre?: { largeur: number, hauteur: number },
 *           defileurs?: { sel: string, scrollH: number, clientH: number,
 *                         boite?: { left: number, top: number, right: number, bottom: number } }[] }} releve
 * @returns {string[]} un défaut par scrollport de page (liste vide = tout défile dans un cadre)
 */
export function scrollportDePage(releve) {
  const { page } = releve;
  if (!page) return [`${releve.vue} · ${releve.ecran} : aucune mesure de page — sonde aveugle`];
  const out = [];
  const cadres = (releve.defileurs ?? []).filter((d) => d.scrollH - d.clientH > 1);
  const debord = +(page.scrollH - page.clientH).toFixed(1);
  if (debord > 1) {
    const ou = cadres.length
      ? `les cadres défilants montés (${cadres.map((d) => d.sel).join(', ')}) ne l'absorbent pas`
      : `aucun cadre défilant ne le recueille`;
    out.push(`${releve.vue} · ${releve.ecran} : la PAGE défile de ${debord}px (scrollHeight ${page.scrollH} > clientHeight ${page.clientH}) — ${ou}`);
  }
  for (const d of cadres) {
    // Un cadre dont la boîte commence SOUS le viewport est la vraie cause : la page défile de
    // quelques pixels, mais ce qui est en jeu est un cadre entier hors champ. Le dire, sinon le
    // chiffre du débord de page (« 3px ») est exact et trompeur.
    if (releve.fenetre && d.boite && d.boite.top >= releve.fenetre.hauteur - 1) {
      out.push(
        `${releve.vue} · ${releve.ecran} : « ${d.sel} » commence SOUS la fenêtre (haut ${d.boite.top} pour ` +
        `${releve.fenetre.hauteur}px) et porte ${d.scrollH}px de contenu dans ${d.clientH}px — ce qu'il tient ` +
        `n'est pas à l'écran`,
      );
    }
    if (couvreLeViewport(d.boite, releve.fenetre)) {
      out.push(
        `${releve.vue} · ${releve.ecran} : « ${d.sel} » couvre TOUT le viewport et défile de ` +
        `${+(d.scrollH - d.clientH).toFixed(1)}px (scrollHeight ${d.scrollH} > clientHeight ${d.clientH}) — ` +
        `c'est le scrollport de PAGE sous un autre nom : rien d'ancré ne le reste`,
      );
    }
  }
  return out;
}

/**
 * CORPS DE MODALE ÉCRASÉ — « la fenêtre tient-elle ce qu'elle RÉCLAME ? ». Aucune constante ici :
 * le contrat est publié par le CSS lui-même (`roll-shell.css` : `--roll-fenetre` la boîte réclamée,
 * `--roll-band-min` / `--roll-dock-min` les planchers des deux bandes), la sonde le lit au
 * `getComputedStyle` du voile et le passe tel quel. Le détecteur ne fait que confronter.
 *
 * Ce qu'une fenêtre DOIT tenir dès lors que son corps défile : sa boîte réclamée, ou — si l'écran
 * est trop bas pour elle — tout ce que l'écran laisse une fois les deux planchers pris. En deçà,
 * ce sont les bandes qui la tiennent, pas l'écran. Tolérance d'UN pixel : les bandes se calculent
 * en `vh`, donc en sous-pixels.
 *
 * Une fenêtre dont le voile ne PUBLIE PAS son contrat est un défaut NOMMÉ, jamais un silence : le
 * jour où `--roll-fenetre` disparaît, la sonde doit crier, pas devenir muette.
 *
 * @param {{ vue: string, modales?: { quoi: string, corps: { clientH: number, scrollH: number },
 *           place: number, boite: number, reclame: number | null,
 *           plancherHaut: number, plancherBas: number }[] }} releve
 * @returns {string[]}
 */
export function corpsDeModaleEcrase(releve) {
  const out = [];
  for (const m of releve.modales ?? []) {
    if (!m.corps || !m.place) continue;
    const cache = +(m.corps.scrollH - m.corps.clientH).toFixed(1);
    if (cache <= 1) continue; // le corps ne défile pas : rien à juger
    if (m.reclame == null) {
      out.push(
        `${releve.vue} : le corps de « ${m.quoi} » défile (${m.corps.clientH}px rendus sur ${m.corps.scrollH}px) ` +
        `et le voile ne PUBLIE aucun contrat (\`--roll-fenetre\`) — rien à confronter, le contrat a disparu du CSS`,
      );
      continue;
    }
    const du = Math.min(m.reclame, m.place - m.plancherHaut - m.plancherBas);
    if (m.boite < du - 1) {
      out.push(
        `${releve.vue} : « ${m.quoi} » ne tient que ${m.boite}px alors qu'elle réclame ${m.reclame}px et que ` +
        `l'écran lui en laisse ${du}px (place ${m.place} − planchers ${m.plancherHaut}/${m.plancherBas}) ` +
        `— son corps défile pour ${cache}px que ses bandes retiennent`,
      );
    }
  }
  return out;
}

/**
 * COMMANDE INATTEIGNABLE dans une carte de menu — le CRITÈRE d'atteignabilité : un bouton est
 * atteignable si son bas tombe dans la boîte du corps défilant (`corpsBas`), ou dans la course qui
 * reste à défiler (`restant`). Au-delà, aucun geste du joueur ne l'amène sous ses yeux.
 * La sonde RELÈVE (bas de chaque commande, bas du corps, course restante) ; le verdict est ici.
 * Tolérance d'UN pixel, comme partout ici.
 *
 * @param {{ vue: string, ecran: string, cartes?: { sel: string, corpsBas: number, restant: number,
 *           commandes?: { nom: string, bas: number }[] }[] }} releve
 * @returns {string[]}
 */
export function commandesInatteignables(releve) {
  const out = [];
  for (const c of releve.cartes ?? []) {
    const atteignableJusqua = c.corpsBas + c.restant;
    for (const e of c.commandes ?? []) {
      if (e.bas <= atteignableJusqua + 1) continue;
      out.push(
        `${releve.vue} · ${releve.ecran} : « ${e.nom} » (bas ${e.bas}) est INATTEIGNABLE dans ${c.sel} ` +
        `— le corps s'arrête à ${c.corpsBas} et il ne reste que ${c.restant}px de course`,
      );
    }
  }
  return out;
}

/**
 * ACTEUR COURANT HORS CHAMP — celui dont c'est le tour doit être VISIBLE dans sa piste, entier :
 * une frise plus longue que l'écran qui ne ramène pas l'entrée au trait dans son champ laisse le
 * joueur sans réponse à « qui joue ? ». Le verdict porte sur la piste (le scrollport de la frise),
 * jamais sur la fenêtre : une piste peut légitimement défiler, l'entrée au trait non.
 * Tolérance d'UN pixel, comme partout ici.
 *
 * `courant` absent = rien n'est au trait (pause d'initiative, combat fini) : il n'y a rien à dire,
 * et une sonde qui crierait là rendrait le détecteur inutilisable hors du tour d'un héros.
 *
 * @param {{ vue: string, courant?: { nom: string, left: number, right: number, top: number, bottom: number } | null,
 *           piste?: { left: number, right: number, top: number, bottom: number } | null }} releve
 * @returns {string[]}
 */
export function courantHorsChamp(releve) {
  const { courant, piste } = releve;
  if (!courant || !piste) return [];
  const sorties = [];
  if (courant.left < piste.left - 1) sorties.push(`de ${+(piste.left - courant.left).toFixed(1)}px par la GAUCHE`);
  if (courant.right > piste.right + 1) sorties.push(`de ${+(courant.right - piste.right).toFixed(1)}px par la DROITE`);
  if (courant.top < piste.top - 1) sorties.push(`de ${+(piste.top - courant.top).toFixed(1)}px par le HAUT`);
  if (courant.bottom > piste.bottom + 1) sorties.push(`de ${+(courant.bottom - piste.bottom).toFixed(1)}px par le BAS`);
  if (!sorties.length) return [];
  return [`${releve.vue} : l'acteur au trait « ${courant.nom} » sort du champ de sa piste ${sorties.join(', ')}`];
}
