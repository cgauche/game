// STOCK CLIQUETÉ de la CHAIR GRAVÉE dans les tenues (#583 — couture au poignet) — consommé par
// `src/gameIso/rig/parts/tenues/flesh-gradient.test.ts`. Patron whitelist-en-lib du dépôt
// (`rigPartViewStock.mjs`, `folioRatchetStock.mjs`).
//
// `g_flesh` est un dégradé de peau CLAIRE FIXE (`fxGradients.ts`), gravé au lieu des tokens
// `@peau`/`@peauO`/`@peauH` — il ignore la palette de l'espèce qui porte la tenue. Corps GÉNÉRÉ par
// `npx tsx scripts/rig/regen-flesh-gradient-stock.mts` (DÉCROISSANT-SEULEMENT, refus SITE PAR SITE).
//
// FORME DES ENTRÉES — `{ fichier, ref, occurrence }`, la forme UNIQUE de tout stock nominatif du
// dépôt (`cleDeSite`, `scripts/guards/lib/stock.mjs`) : `fichier` = le def de tenue à ouvrir pour
// migrer, `ref` = `<tenueId>:<slot>:<vue>` (id STABLE `slugId(def.label)`). C'est le `fichier` que la
// porte de plage (`croissanceDesStocks`) voit : une clé nue lui est INVISIBLE, un append ne coûte
// alors rien. Toute prose posée ENTRE les entrées est mangée à la régénération.
//
// Mesure à la pose (2026-07-18) : 44 clés / 10 tenues (Chansonnier, Débardeur, Gladiateur,
// Hors-la-loi, Ingénieur, Marchand, Marin, Naufrageur, Ratier, Tueur). Un slot se solde en migrant
// SES littéraux/`g_flesh` vers `@peau*` (lot d'art JUGÉ, hors périmètre #583 — mesure + garde
// seulement) puis en relançant le régénérateur, jamais en retirant la ligne à la main.
//
// CLIQUET, pas absolution : la garde échoue (a) sur tout site `g_flesh` ABSENT de ce stock — une
// tenue neuve n'en grave pas ; (b) sur toute entrée du stock qui ne grave plus (soldée). Aucun
// PLAFOND : ce qu'une dette ne peut pas faire, c'est croître SANS SE DÉCLARER, et c'est l'entrée
// nommée qui le dit.
//
// NE COUVRE QUE `g_flesh` (interdiction mécanisable SANS faux positif). Les littéraux hex "chair"
// (`#e2b48c` etc., copiés au lieu du token) ne sont PAS gardés ici : un détecteur par distance
// colorimétrique produit des faux positifs confirmés (ex. Bailli|tete réutilise `@peauH`/`@peauO`
// pour un PANACHE/plume, pas de la chair) — cf. mesure manuelle #583, rendue au juge d'art.

export const FLESH_GRADIENT_RATCHET = [
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chansonnier.ts', ref: 'chansonnier:bras:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chansonnier.ts', ref: 'chansonnier:bras:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Chansonnier.ts', ref: 'chansonnier:bras:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Debardeur.ts', ref: 'debardeur:bras:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Debardeur.ts', ref: 'debardeur:bras:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Debardeur.ts', ref: 'debardeur:bras:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Debardeur.ts', ref: 'debardeur:torse:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Debardeur.ts', ref: 'debardeur:torse:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Debardeur.ts', ref: 'debardeur:torse:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Gladiateur.ts', ref: 'gladiateur:bras:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Gladiateur.ts', ref: 'gladiateur:bras:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Gladiateur.ts', ref: 'gladiateur:bras:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Gladiateur.ts', ref: 'gladiateur:torse:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Gladiateur.ts', ref: 'gladiateur:torse:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Gladiateur.ts', ref: 'gladiateur:torse:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Hors-la-loi.ts', ref: 'hors-la-loi:bras:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Hors-la-loi.ts', ref: 'hors-la-loi:bras:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Hors-la-loi.ts', ref: 'hors-la-loi:bras:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ingenieur.ts', ref: 'ingenieur:bras:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ingenieur.ts', ref: 'ingenieur:bras:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ingenieur.ts', ref: 'ingenieur:bras:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marchand.ts', ref: 'marchand:bras:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marchand.ts', ref: 'marchand:bras:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marchand.ts', ref: 'marchand:bras:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marchand.ts', ref: 'marchand:torse:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marchand.ts', ref: 'marchand:torse:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marchand.ts', ref: 'marchand:torse:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marin.ts', ref: 'marin:bras:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marin.ts', ref: 'marin:bras:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Marin.ts', ref: 'marin:bras:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Naufrageur.ts', ref: 'naufrageur:bras:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Naufrageur.ts', ref: 'naufrageur:bras:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Naufrageur.ts', ref: 'naufrageur:bras:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Naufrageur.ts', ref: 'naufrageur:jambes:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Naufrageur.ts', ref: 'naufrageur:torse:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Naufrageur.ts', ref: 'naufrageur:torse:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Naufrageur.ts', ref: 'naufrageur:torse:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Ratier.ts', ref: 'ratier:bras:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Tueur.ts', ref: 'tueur:bras:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Tueur.ts', ref: 'tueur:bras:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Tueur.ts', ref: 'tueur:bras:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Tueur.ts', ref: 'tueur:torse:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Tueur.ts', ref: 'tueur:torse:front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/tenues/defs/Tueur.ts', ref: 'tueur:torse:profile', occurrence: 1 },
]
