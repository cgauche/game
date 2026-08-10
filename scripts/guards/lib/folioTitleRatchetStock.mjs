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
// POSE (2026-08-10, #1200) : 57 clés, révélées d'un coup par l'ouverture de la voie C — invisibles
// jusque-là (leur desc n'est pas verbatim, donc aucune voie ne les jugeait). Une première pose en
// comptait 103 : 46 sont tombées avec les deux garde-fous anti-homonyme (29 pages ATTESTÉES par le
// label, 15 homonymes lointains de 15 à 257 folios, 2 contredisant une note authored) — elles sont
// listées comme irrésolues ou à arbitrer, jamais accusées.
//
// SOLDE (2026-08-10, #1225) : les 57 sont MESURÉES au Source une à une et corrigées en donnée — le
// stock est VIDE. Ce que la curation a montré, pour la prochaine famille :
//   - le gros du stock était un report de folio au fil des imports (ZI `creatures.json` ×28, de -8 à
//     +1 ; `trappings.json` ×8) — le titre de l'entrée (le statblock `#### <NOM>`) tranche seul ;
//   - `qualities.json` ×8 ne relevait d'AUCUN arbitrage de convention : le folio 286 du LDB est dans
//     `55 - Colonies.md`, il n'y porte aucune table de Qualités ; les 8 Atouts/Défauts d'objet vivent
//     en folio 292 (`60 - Fabrication.md`), ce que l'index du livre confirme entrée par entrée
//     (`85 - Traits de créature.md` l.581-700 : « Léger 292 », « Peu fiable 292 »…).
// Ce stock ne peut que DÉCROÎTRE : une clé neuve est une régression à corriger au Source.
//
// `node scripts/data/audit-folios.mjs --stock-titres` re-rend ce fichier et REFUSE de l'agrandir.
/** @type {ReadonlySet<string>} */
export const FOLIO_TITLE_RATCHET = new Set([

])
