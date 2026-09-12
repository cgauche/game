// PRIMITIVE DE CLIQUET : les quatre calculs que chaque garde à stock refaisait à la main — l'ÉCART au
// stock (entrées neuves / entrées périmées), les CHAMPS que la clé n'observe pas, la COUVERTURE du
// balayage qui alimente le cliquet (gisements muets, entrées de stock hors corpus), les LIGNES sans
// échéance lisible.
//
// FRONTIÈRE (la même que `sourceCorpus.mjs`) : cette lib CALCULE, le VERDICT appartient à l'appelant.
// C'est la garde qui décide ce qui est rouge, avec quel message, et à quel plafond — ici on ne rend
// que des listes et un compte.
//
// L'unité mesurée est la COLLECTION, jamais le fichier : un fichier de stock en porte parfois
// plusieurs (`structuresStock.mjs` en porte 8), chacune se mesure pour elle-même. La CLÉ est une
// fonction LIBRE de l'appelant : elle seule sait ce que sa garde compare — `slotsStock` embarque
// l'occurrence dans la sienne, `manualDocsStock` compare des chemins nus. Un stock VIDE se sert
// comme les autres, sans court-circuit : un cliquet tenu à zéro est un cliquet, il rend ses `neuves`.
//
// INTERDITS gravés — chacun est un trou déjà payé dans ce dépôt :
//   - jamais le PLAFOND. Il vit dans le TEST, jamais dans la lib du stock ni ici
//     (`src/data/entity-orphans.test.ts:18-21`, verbatim : « sans lui, le chemin le plus court pour
//     "solder" une orpheline neuve resterait d'ajouter une ligne au stock, CI verte ») — un plafond
//     servi depuis la lib se relèverait dans le même geste que l'append qu'il doit rendre visible.
//   - jamais le VERDICT : aucun `expect`, aucun `throw`, aucun exit.
//   - jamais le DISQUE : aucune lecture, aucun chemin — l'appelant apporte l'observé.
//   - jamais de MÉMOÏSATION : il n'y a rien de stable à keyer. L'observé et le stock arrivent en
//     `Iterable` (souvent un générateur, consommé une seule fois), et le SENS d'un appel tient à la
//     fonction `cle` fournie par l'appelant — une closure, jamais comparable à une autre. Un mémo
//     ici servirait l'écart d'un AUTRE appel. Ce qui se mémoïse, c'est la LECTURE du disque, et elle
//     vit dans `sourceCorpus.mjs` (`readCorpus`, clé de contenu).

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Écart d'une collection OBSERVÉE à son STOCK, dans les DEUX sens.
 * @template O, S
 * @param {{ observe: Iterable<O>, stock: Iterable<S>, cle: (entree: O | S) => string,
 *   remede?: { neuve?: (cle: string, entree: O) => string, perimee?: (cle: string) => string } }} p
 *   `remede` décore les lignes rendues (défaut : la clé nue).
 * @returns {{ neuves: string[], perimees: string[], taille: number }} `taille` = clés DISTINCTES du
 *   stock — de quoi confronter un plafond, que l'appelant seul détient.
 */
export function ecartsDeStock({ observe, stock, cle, remede = {} }) {
  const vues = new Map();
  for (const e of observe) {
    const k = cle(e);
    if (!vues.has(k)) vues.set(k, e);
  }
  const tenues = new Set();
  for (const e of stock) tenues.add(cle(e));
  const neuves = [...vues]
    .filter(([k]) => !tenues.has(k))
    .map(([k, e]) => (remede.neuve ? remede.neuve(k, e) : k));
  const perimees = [...tenues]
    .filter((k) => !vues.has(k))
    .map((k) => (remede.perimee ? remede.perimee(k) : k));
  return { neuves, perimees, taille: tenues.size };
}

/**
 * Champs d'entrée que la CLÉ n'observe pas : les muter laisse le jeu de clés IDENTIQUE, donc la
 * garde verte quoi qu'on écrive dans ces champs. Un stock VIDE n'offre aucune entrée à muter et
 * rend `[]` — mesurer la vacuité appartient à l'appelant.
 * @template {Record<string, unknown>} E
 * @param {Iterable<E>} stock @param {(entree: E) => string} cle @param {readonly (keyof E & string)[]} champs
 * @returns {string[]} les champs AVEUGLES, dans l'ordre demandé.
 */
export function champsAveugles(stock, cle, champs) {
  const entrees = [...stock];
  if (entrees.length === 0) return [];
  const empreinte = (l) => l.map(cle).sort().join('\n');
  const base = empreinte(entrees);
  return champs.filter((champ) => {
    const mutees = entrees.map((e, i) =>
      i === 0 ? { ...e, [champ]: typeof e[champ] === 'number' ? e[champ] + 999 : `${e[champ]}~MUTE` } : e,
    );
    return empreinte(mutees) === base;
  });
}

/**
 * COUVERTURE d'un stock nominatif PAR LE BALAYAGE qui l'alimente, en deux listes NOMMÉES — ce que
 * `ecartsDeStock` (et tout cliquet à la main) ne peut pas dire : un écart se calcule sur ce qui est
 * PRÉSENTÉ, et un balayage amputé présente moins d'entrées, donc moins d'écarts, donc un vert. Même
 * trou que le REFUS DU VIDE de `sourceCorpus.mjs`, une marche plus bas : le balayage peut être NON
 * vide et pourtant avoir perdu un GISEMENT entier (un des dossiers que le cliquet prétend juger) ou
 * le fichier même d'une entrée de stock — la moitié RATCHET de `LABEL_LITERAL_STOCK` a vécu ainsi,
 * ses entrées `src/ui/**` hors du balayage et le verdict vert (#1723).
 *
 * Non-vacuité par GISEMENT et non sur le total (patron `props-volumiques.test.ts`, `2639287cd`) :
 * sur un total agrégé, une moitié de balayage qui s'évapore reste muette derrière l'autre. Aucun
 * CARDINAL n'est attendu — un dossier peuplé, une entrée de stock présente, rien de plus.
 *
 * Les GISEMENTS attendus sont ceux que LE CLIQUET APPELANT juge, jamais tous les dossiers d'une
 * garde voisine : un volet qui ne balaie que la zone à tolérance zéro n'a pas à exiger la zone
 * ratchet. Hors périmètre par nature, un balayage de contenu STAGÉ (hook pre-commit) : un commit ne
 * touche qu'une partie du corpus, et la porte de vérité d'une couverture est la SUITE.
 *
 * GRAPHIE des `gisements` : le séparateur est exigé (`src/ui` peuple sur `src/ui/…`, jamais sur
 * `src/uix/…`), et la comparaison est littérale — un gisement mal graphié (`'src/ui/'`, séparateur
 * Windows `\`) n'est peuplé par rien et sort ÉTERNELLEMENT muet. Fail-loud assumé : le rouge nomme le
 * dossier, sa correction est sa graphie.
 *
 * ANGLE MORT : cette couverture prouve qu'un fichier a été PRÉSENTÉ au cliquet, jamais qu'il a été LU
 * utilement — un gisement réduit à un fichier non représentatif passe. Neutraliser un détecteur sur
 * un fichier de stock PRÉSENT fait bouger son compte, donc rougir la dérive ; le commit qui
 * neutralise le détecteur ET met le stock à jour reste vert, et c'est au message de commit de le
 * dire (credo, « détecteur modifié dans le même commit »), pas à ce calcul de le voir.
 *
 * @param {{ nom: string, stock: Iterable<string>, balayes: Iterable<string>, gisements: Iterable<string> }} p
 *   `nom` = le stock nommé dans les phrases rendues ; `stock` = ses clés de FICHIER ; `balayes` =
 *   les chemins de TOUS les fichiers balayés (le corpus, pas les seuls porteurs de findings) ;
 *   `gisements` = les dossiers que ce cliquet juge, chacun attendu peuplé.
 * @returns {{ gisementsMuets: string[], entreesDeStockAbsentes: string[] }} phrases prêtes à afficher.
 */
export function couvertureDuBalayage({ nom, stock, balayes, gisements }) {
  const vus = new Set(balayes);
  const dossiers = [...gisements];
  const peuples = new Set();
  for (const rel of vus) for (const dir of dossiers) if (rel.startsWith(`${dir}/`)) peuples.add(dir);
  return {
    gisementsMuets: dossiers
      .filter((dir) => !peuples.has(dir))
      .map((dir) => `${dir} : gisement MUET — aucun fichier balayé, le cliquet ${nom} ne juge plus ce dossier (il rendrait vert par vacuité).`),
    entreesDeStockAbsentes: [...stock]
      .filter((rel) => !vus.has(rel))
      .map((rel) => `${rel} : entrée de ${nom} ABSENTE du balayage — son compte n'est plus mesuré ; brancher le fichier au corpus, ou retirer l'entrée s'il a disparu de l'arbre.`),
  };
}

/**
 * Lignes de stock sans ÉCHÉANCE lisible : lot vide, date absente ou non ISO, ou lot HORS de
 * l'ensemble fermé quand l'appelant en fournit un.
 * @param {Iterable<[string, { lot?: string, date?: string }]>} stock paires `[nom, qualification]`
 * @param {{ lotsConnus?: Iterable<string> }} [opts]
 * @returns {string[]}
 */
export function lignesMalQualifiees(stock, { lotsConnus } = {}) {
  const connus = lotsConnus ? new Set(lotsConnus) : null;
  const out = [];
  for (const [nom, v] of stock) {
    const lot = typeof v?.lot === 'string' ? v.lot.trim() : '';
    const date = typeof v?.date === 'string' ? v.date : '';
    if (!lot || !DATE_ISO.test(date)) {
      out.push(`${nom} → lot « ${lot} », date « ${date} » — une ligne sans lot de mort NI date est un régime, pas un cliquet.`);
      continue;
    }
    if (connus && !connus.has(lot)) {
      out.push(`${nom} → lot « ${lot} » hors des lots connus (${[...connus].sort().join(', ')}).`);
    }
  }
  return out;
}
