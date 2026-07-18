// STOCK CLIQUETÉ de la CHAIR GRAVÉE dans les tenues (#583 — couture au poignet) — consommé par
// `src/gameIso/rig/parts/tenues/flesh-gradient.test.ts`. Patron whitelist-en-lib du dépôt
// (`rigPartViewStock.mjs`, `folioRatchetStock.mjs`).
//
// `g_flesh` est un dégradé de peau CLAIRE FIXE (`fxGradients.ts`), gravé au lieu des tokens
// `@peau`/`@peauO`/`@peauH` — il ignore la palette de l'espèce qui porte la tenue. Corps du Set
// GÉNÉRÉ par `npx tsx scripts/rig/regen-flesh-gradient-stock.mts` (DÉCROISSANT-SEULEMENT).
//
// Clé = `<tenueId>:<slot>:<vue>` (id STABLE `slugId(def.name)`) — le libellé est en commentaire.
// Mesure à la pose (2026-07-18) : 44 clés / 10 tenues (Chansonnier, Débardeur, Gladiateur,
// Hors-la-loi, Ingénieur, Marchand, Marin, Naufrageur, Ratier, Tueur). Un slot se solde en migrant
// SES littéraux/`g_flesh` vers `@peau*` (lot d'art JUGÉ, hors périmètre #583 — mesure + garde
// seulement) puis en relançant le régénérateur, jamais en retirant la ligne à la main.
//
// CLIQUET, pas absolution : la garde échoue (a) sur toute clé `g_flesh` ABSENTE de ce stock — une
// tenue neuve n'en grave pas ; (b) sur toute clé du stock qui ne grave plus (soldée) ; (c) si la
// TAILLE dépasse son plafond (`MAX_FLESH_GRADIENT`, gelé dans la garde, pas ici).
//
// NE COUVRE QUE `g_flesh` (interdiction mécanisable SANS faux positif). Les littéraux hex "chair"
// (`#e2b48c` etc., copiés au lieu du token) ne sont PAS gardés ici : un détecteur par distance
// colorimétrique produit des faux positifs confirmés (ex. Bailli|tete réutilise `@peauH`/`@peauO`
// pour un PANACHE/plume, pas de la chair) — cf. mesure manuelle #583, rendue au juge d'art.

/** @type {ReadonlySet<string>} */
export const FLESH_GRADIENT_RATCHET = new Set([
  'chansonnier:bras:back', // Chansonnier
  'chansonnier:bras:front', // Chansonnier
  'chansonnier:bras:profile', // Chansonnier
  'debardeur:bras:back', // Débardeur
  'debardeur:bras:front', // Débardeur
  'debardeur:bras:profile', // Débardeur
  'debardeur:torse:back', // Débardeur
  'debardeur:torse:front', // Débardeur
  'debardeur:torse:profile', // Débardeur
  'gladiateur:bras:back', // Gladiateur
  'gladiateur:bras:front', // Gladiateur
  'gladiateur:bras:profile', // Gladiateur
  'gladiateur:torse:back', // Gladiateur
  'gladiateur:torse:front', // Gladiateur
  'gladiateur:torse:profile', // Gladiateur
  'hors-la-loi:bras:back', // Hors-la-loi
  'hors-la-loi:bras:front', // Hors-la-loi
  'hors-la-loi:bras:profile', // Hors-la-loi
  'ingenieur:bras:back', // Ingénieur
  'ingenieur:bras:front', // Ingénieur
  'ingenieur:bras:profile', // Ingénieur
  'marchand:bras:back', // Marchand
  'marchand:bras:front', // Marchand
  'marchand:bras:profile', // Marchand
  'marchand:torse:back', // Marchand
  'marchand:torse:front', // Marchand
  'marchand:torse:profile', // Marchand
  'marin:bras:back', // Marin
  'marin:bras:front', // Marin
  'marin:bras:profile', // Marin
  'naufrageur:bras:back', // Naufrageur
  'naufrageur:bras:front', // Naufrageur
  'naufrageur:bras:profile', // Naufrageur
  'naufrageur:jambes:front', // Naufrageur
  'naufrageur:torse:back', // Naufrageur
  'naufrageur:torse:front', // Naufrageur
  'naufrageur:torse:profile', // Naufrageur
  'ratier:bras:front', // Ratier
  'tueur:bras:back', // Tueur
  'tueur:bras:front', // Tueur
  'tueur:bras:profile', // Tueur
  'tueur:torse:back', // Tueur
  'tueur:torse:front', // Tueur
  'tueur:torse:profile', // Tueur
])
