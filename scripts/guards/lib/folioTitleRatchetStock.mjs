// STOCK CLIQUETÉ de la voie C — folio réfuté par le TITRE DE SECTION (#1200) — consommé par
// `src/data/book-source-integrity.test.ts`. Même patron et mêmes trois verrous que
// `folioRatchetStock.mjs` (dont il est le strict complément : une entrée n'est jugée par le titre
// QUE si sa desc n'a rien pu localiser).
//
// Chaque clé `<dataset>:<id>` est une entrée dont le `source.page` est exclu par l'encadrement
// `data-folio` du TITRE `# **<Label>**` retrouvé dans le livre déclaré, ET dont la page déclarée ne
// nomme nulle part l'entrée, ET dont le titre le plus proche tient dans `MAX_ECART_TITRE` folios. Le
// commentaire de fin de ligne dit ce qui est PROUVÉ — « titre le plus proche : folio N (chapitre),
// écart E » — jamais un emplacement réel que la voie C n'a pas établi.
//
// POSE (2026-08-10, #1200) : 57 clés, révélées d'un coup par l'ouverture de la voie C — elles ne sont
// PAS une régression de ce commit, elles étaient invisibles (leur desc n'est pas verbatim, donc
// aucune voie ne les jugeait). Elles ne sont pas corrigées ici : chacune demande un aller-retour au
// Source, hors périmètre de #1200. Deux familles s'y lisent à l'œil :
//   - le report de ±1 à ±3 folios au fil des imports (`creatures.json:gobelin-des-forets` 14, titre en
//     15 ; `maladies.json:colique` 92, titre en 93) — le gros du stock ;
//   - la table GOUVERNANTE citée à la place de la section (`qualities.json` ×8 : p.286 est la table
//     des Qualités de `59 - Faire son marché.md`, les titres de section sont en 292+) — ambiguïté de
//     convention déjà connue de la voie B, son solde dépend d'un arbitrage, pas d'une correction.
// Une première pose comptait 103 clés : 46 sont tombées avec les deux garde-fous anti-homonyme
// (29 pages ATTESTÉES par le label, 15 homonymes lointains de 15 à 257 folios, 2 contredisant une
// note authored) — elles sont désormais listées comme irrésolues ou à arbitrer, jamais accusées.
// Ce stock ne peut que DÉCROÎTRE.
//
// `node scripts/data/audit-folios.mjs --stock-titres` re-rend ce fichier et REFUSE de l'agrandir.
/** @type {ReadonlySet<string>} */
export const FOLIO_TITLE_RATCHET = new Set([
  // activities.json
  'activities.json:observer-une-cible', // p.201 -> titre le plus proche : folio 200 (23 - Activités.md), écart 1
  // careers.json
  'careers.json:cartographe', // p.22 -> titre le plus proche : folio 16 (02 - INTRODUCTION.md), écart 6
  'careers.json:chevalier-du-soleil-flamboyant', // p.32 -> titre le plus proche : folio 34 (03 - LES CHEVALIERS DE L'EMPIRE.md), écart 2
  'careers.json:specialiste-de-siege', // p.46 -> titre le plus proche : folio 48 (04 - LES CHIENS DE GUERRE.md), écart 2
  'careers.json:suiveur-de-camp', // p.20 -> titre le plus proche : folio 22 (02 - INTRODUCTION.md), écart 2
  // creatures.json
  'creatures.json:brochet-du-stir', // p.38 -> titre le plus proche : folio 36 (04 - « L'abominable » Halagrundsor.md), écart 2
  'creatures.json:caledair-la-faux-de-feu', // p.33 -> titre le plus proche : folio 31 (03 - Dragon.md), écart 2
  'creatures.json:chamane-gobelin-des-forets', // p.14 -> titre le plus proche : folio 15 (01 - TROIS EXPÉDITIONS.md), écart 1
  'creatures.json:chef-de-meute-du-clan-moulder', // p.43 -> titre le plus proche : folio 41 (04 - « L'abominable » Halagrundsor.md), écart 2
  'creatures.json:chevalier-mort-vivant-revenant', // p.97 -> titre le plus proche : folio 93 (13 - Sirène.md), écart 4
  'creatures.json:choses-du-bois-mort', // p.40 -> titre le plus proche : folio 37 (04 - « L'abominable » Halagrundsor.md), écart 3
  'creatures.json:cornu', // p.81 -> titre le plus proche : folio 80 (10 - Macareux à bec tranchant.md), écart 1
  'creatures.json:dragon-barbele', // p.96 -> titre le plus proche : folio 90 (13 - Sirène.md), écart 6
  'creatures.json:dragon-de-la-foret', // p.33 -> titre le plus proche : folio 30 (03 - Dragon.md), écart 3
  'creatures.json:gobelin-de-la-nuit', // p.31 -> titre le plus proche : folio 28 (02 - Griffon.md), écart 3
  'creatures.json:gobelin-des-forets', // p.14 -> titre le plus proche : folio 15 (01 - TROIS EXPÉDITIONS.md), écart 1
  'creatures.json:il-potente-granchio', // p.92 -> titre le plus proche : folio 85 (12 - Il Potente Granchio.md), écart 7
  'creatures.json:l-abominable-halagrundsor', // p.36 -> titre le plus proche : folio 34 (04 - « L'abominable » Halagrundsor.md), écart 2
  'creatures.json:l-ombre-du-fleuve', // p.11 -> titre le plus proche : folio 10 (01 - TROIS EXPÉDITIONS.md), écart 1
  'creatures.json:le-fantasma', // p.96 -> titre le plus proche : folio 91 (13 - Sirène.md), écart 5
  'creatures.json:le-vieux-dos-de-pus', // p.18 -> titre le plus proche : folio 19 (01 - TROIS EXPÉDITIONS.md), écart 1
  'creatures.json:leviathan', // p.92 -> titre le plus proche : folio 85 (12 - Il Potente Granchio.md), écart 7
  'creatures.json:mangeuse-d-hommes-de-la-drakwald-araignee-geante', // p.12 -> titre le plus proche : folio 13 (01 - TROIS EXPÉDITIONS.md), écart 1
  'creatures.json:peau-de-loup', // p.71 -> titre le plus proche : folio 70 (07 - Chimère.md), écart 1
  'creatures.json:prototype-du-clan-skryre', // p.98 -> titre le plus proche : folio 95 (13 - Sirène.md), écart 3
  'creatures.json:rat-loup', // p.43 -> titre le plus proche : folio 41 (04 - « L'abominable » Halagrundsor.md), écart 2
  'creatures.json:rat-ogre-briseur-d-os', // p.43 -> titre le plus proche : folio 41 (04 - « L'abominable » Halagrundsor.md), écart 2
  'creatures.json:rhinox', // p.28 -> titre le plus proche : folio 24 (02 - Griffon.md), écart 4
  'creatures.json:sirene', // p.94 -> titre le plus proche : folio 86 (13 - Sirène.md), écart 8
  'creatures.json:sorciere-troll-des-rivieres', // p.48 -> titre le plus proche : folio 49 (05 - Amibe.md), écart 1
  'creatures.json:stegadon', // p.80 -> titre le plus proche : folio 79 (10 - Macareux à bec tranchant.md), écart 1
  'creatures.json:technomage-du-clan-skryre', // p.98 -> titre le plus proche : folio 95 (13 - Sirène.md), écart 3
  'creatures.json:wyrm-des-mers', // p.95 -> titre le plus proche : folio 88 (13 - Sirène.md), écart 7
  // etats.json
  'etats.json:voie-d-eau', // p.124 -> titre le plus proche : folio 117 (13 - Navigation maritime.md), écart 7
  // locations.json
  'locations.json:auerswald', // p.280 -> titre le plus proche : folio 279 (55 - Colonies.md), écart 1
  // maladies.json
  'maladies.json:colique', // p.92 -> titre le plus proche : folio 93 (16 - CHAPITRE 14 - Maladies transmises par l’eau.md), écart 1
  // naval-traits.json
  'naval-traits.json:nid-de-pie', // p.97 -> titre le plus proche : folio 99 (12 - Navires et construction navale.md), écart 2
  // qualities.json
  'qualities.json:bacle', // p.286 -> titre le plus proche : folio 292+ (60 - Fabrication.md), écart 6
  'qualities.json:laid', // p.286 -> titre le plus proche : folio 292+ (60 - Fabrication.md), écart 6
  'qualities.json:leger', // p.286 -> titre le plus proche : folio 292+ (60 - Fabrication.md), écart 6
  'qualities.json:peu-fiable', // p.286 -> titre le plus proche : folio 292+ (60 - Fabrication.md), écart 6
  'qualities.json:pratique', // p.286 -> titre le plus proche : folio 292+ (60 - Fabrication.md), écart 6
  'qualities.json:raffine', // p.286 -> titre le plus proche : folio 292+ (60 - Fabrication.md), écart 6
  'qualities.json:solide', // p.286 -> titre le plus proche : folio 292+ (60 - Fabrication.md), écart 6
  'qualities.json:volumineux', // p.286 -> titre le plus proche : folio 292+ (60 - Fabrication.md), écart 6
  // tavernGames.json
  'tavernGames.json:alvatafl', // p.93 -> titre le plus proche : folio 91 (16 - JEUX DE TAVERNE.md), écart 2
  'tavernGames.json:arene', // p.94 -> titre le plus proche : folio 92-93 (16 - JEUX DE TAVERNE.md), écart 1
  'tavernGames.json:bete-tailleurs', // p.93 -> titre le plus proche : folio 92 (16 - JEUX DE TAVERNE.md), écart 1
  'tavernGames.json:boules', // p.93 -> titre le plus proche : folio 92 (16 - JEUX DE TAVERNE.md), écart 1
  // trappings.json
  'trappings.json:acide-de-troll', // p.107 -> titre le plus proche : folio 106 (13 - Sirène.md), écart 1
  'trappings.json:baiser-de-la-vouivre', // p.105 -> titre le plus proche : folio 104 (13 - Sirène.md), écart 1
  'trappings.json:bouclier-de-la-forge', // p.107 -> titre le plus proche : folio 106 (13 - Sirène.md), écart 1
  'trappings.json:boursoufleur', // p.105 -> titre le plus proche : folio 104 (13 - Sirène.md), écart 1
  'trappings.json:lance-harpon', // p.29 -> titre le plus proche : folio 30 (02 - Les ogres.md), écart 1
  'trappings.json:potion-a-deux-tetes', // p.106 -> titre le plus proche : folio 105 (13 - Sirène.md), écart 1
  'trappings.json:remede-de-lurek', // p.106 -> titre le plus proche : folio 105 (13 - Sirène.md), écart 1
  'trappings.json:silence', // p.115 -> titre le plus proche : folio 116 (13 - Sirène.md), écart 1
])
