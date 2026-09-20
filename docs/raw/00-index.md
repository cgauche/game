# Atlas RAW — Index

Base de connaissance des **règles (RAW)** du projet, **consolidées** depuis les livres autorisés, à
**usage d'agent** : répondre vite et sûrement à *« est-ce que X est RAW, et que dit exactement la
source ? »* quand la réponse est éclatée sur plusieurs chapitres **et** plusieurs livres.

Cette page ROUTE. Une fiche appartient à **un cœur de règles**, et son **chemin** le dit
(`docs/raw/<coeur>/<domaine>.md`) : aucun cœur n'est le cœur implicite. Les trois rapports générés
ci-dessous, eux, couvrent **tous les livres**, tous cœurs confondus.

## Cœurs de règles

La liste sort du registre des livres (`src/data/books.json`, champ `coeur`) — un cœur de plus y est
UNE entrée plus un dossier.

<!-- ATLAS-COEURS:DEBUT -->
- [`4e/`](4e/00-index.md) — livre(s) de cœur : LDB
- `5e/` — dossier à créer — livre(s) de cœur : CRB
<!-- ATLAS-COEURS:FIN -->

## ⚠ Fichiers au-dessus du seuil d'outillage (512 Ko)

Les outils de recherche des sessions (`ctx_search`, lean-ctx) **sautent SILENCIEUSEMENT** les
fichiers de plus de 512 Ko et rendent « 0 résultat » : toute preuve d'existence ou d'absence
dans ces fichiers se fait au **grep natif** (`Select-String`/`grep`) — un « 0 résultat »
d'outil n'y prouve RIEN. Fichiers de l'Atlas concernés (garde
`src/oversize-search-blindspot.test.ts` : cette liste et la mesure doivent coïncider) :

- [`4e/catalogue-creatures.md`](4e/catalogue-creatures.md)
- [`4e/catalogue-equipement.md`](4e/catalogue-equipement.md)
- [`4e/combat.md`](4e/combat.md)
- [`4e/catalogue-sorts.md`](4e/catalogue-sorts.md)
- [`4e/catalogue-carrieres.md`](4e/catalogue-carrieres.md)

Même piège hors Atlas : `src/data/*.json` volumineux (`creatures.json`, `spells.json`,
`careerLevels.json`) et certains extraits `Source/**/*.md` — listes gelées dans la même garde.

## Gardes déterministes (rejouables)

- **[`coverage.md`](coverage.md)** (`node scripts/raw/coverage.mjs`) — chaque chapitre des livres autorisés (table dans [`sources.md`](sources.md)) : ✅ couvert par une fiche / 📖 transcrit par un catalogue seul (jamais traité) / 🟡 effleuré / ⬜ trou / ➖ hors-règle (scénario, prose ≠ règle). **Seuil : ⬜ = 0.** Détail section-granulaire à niveau de heading ADAPTATIF par livre (#604) : la mesure ne suppose plus H2, elle DESCEND (H3/H4) sur les livres qui structurent leurs chapitres plus fin.
- **[`reconciliation.md`](reconciliation.md)** (`node scripts/raw/reconcile.mjs`) — code ↔ Atlas. **Sens A : zéro trou dur toléré** (chapitre cité par le code absent de l'Atlas = trou à ticketer ; non-régression LDB verrouillée par `reconcile.test.mjs`, tous livres couverts, folio compris). **Sens B (#434) : tout topic `(non implémenté)` porte une entrée de manifest (ticket #N ou blocage consigné dans `src/data/raw.manifest.json`) — gardé par `npm run raw:implemente --check` (exit 1 sur orphelin).**
- **`node scripts/raw/check-source-tables.mjs`** (#1384) — les TABLES du `Source/` que leur FORME rend inadressables, en cinq familles : `br-litteral` (un `<br>` littéral dans une cellule — un saut de ligne IMPRIMÉ que la lib absorbe pour l'adressage, et dont le SENS se tranche au PDF, site par site, `preuve` à l'appui sur l'entrée), `donnee-en-tete` (continuation après saut de page dont les « en-têtes » sont une fourchette), `banniere-suspecte` (bandeau de titre que le parseur n'absorbe pas), `cle-de-ligne-ambigue` (clé de ligne partagée par deux tables d'une même section) et `table-avalee-par-titre` (bandeau, rangée de labels et valeurs effondrés sur la ligne d'un titre : la table n'existe plus, aucune autre famille ne la voit). **INVENTAIRE NOMINATIF** `scripts/raw/source-tables-stock.json` (une entrée par site, clé `famille :: fichier :: réf :: occurrence`) : un site hors stock ET une entrée sans site sont rouges, et le nombre d'entrées est PLAFONNÉ. La **dette**, elle, est le compte `à trier` (entrées sans `preuve`) imprimé à chaque run : **décroissant vers zéro**, sous son propre plafond (`PLAFOND_A_TRIER`). Un site se solde en corrigeant le `.md` (l'entrée part) ou en prouvant sa forme au PDF (`preuve` + `date` sur l'entrée, qui reste). Le geste de réparation est le tableau « défaut de table → geste » de [`../ajouter-un-livre-source.md`](../ajouter-un-livre-source.md) §7 ; le stock se régénère par `--ecrire-stock`.
- **[`reanchor.md`](reanchor.md)** (`node scripts/raw/reanchor.mjs` ; `--apply` verbatim + `--remap` synthèse) — ré-ancre les réfs `l.X` contre la Source Marker : citations « … » par **match exact**, réfs de synthèse par **diff `git HEAD`↔arbre** (one-shot à relancer après chaque ré-extraction, avant de committer la Source). **Seuils : 🔧 = 0 · 🟡 = 0 · ❌ sous cliquet NOMINATIF par site (`reanchor-low-stock.json`).** Voir l'**[épreuve du 2026-06-22](4e/epreuve-2026-06-22.md)**.

> Les COMPTES courants (✅/🟡/❌, chapitres non pinés, marqueurs, B2) vivent dans les fichiers GÉNÉRÉS ci-dessus, jamais dans cette page — un compte recopié à la main ment dès le commit suivant.

> **Source = Marker propre pour tous les livres autorisés** (table dans [`sources.md`](sources.md) ; texte exact ; pipeline `scripts/raw/marker-*` + `reextract-all.sh`). L'Atlas remplace la source : 0 trou de règle. Les TABLES, elles, ne sont pas toutes intactes : leur dette de forme est MESURÉE et cliquetée par `check-source-tables` ci-dessus — elle se solde à la main au PDF, jamais par une ré-extraction (⚠️ ci-dessous).

> ⚠️ **Ré-extraction de `Source/` : JAMAIS en masse.** Une re-passe Marker totale décale les numéros de
> ligne de ~3 000 citations du CODE que `reanchor.mjs --remap` ne couvre pas (il ne remappe que les fiches) —
> c'est le chantier de ré-ancrage de 2026-07-16 (#434, ~400 réfs corrigées à la main au Source) à refaire en
> entier. Les trous d'ancrage folio se corrigent par **insertions d'ancres CIBLÉES** (#522), chapitre par
> chapitre, gardes `raw:*` relancées avant commit. Une ré-extraction totale exige d'ABORD un outil de remap
> code-side.

> ⚠️ **Limite connue (#323, vérifiée 2026-07-11)** : Marker perd les GLYPHES des schémas de progression
> (marteau/crâne/bouclier — seule la croix survit en `h`). Les gardes `coverage`/`reconcile` ne peuvent
> PAS le détecter (absence silencieuse, pas un caractère corrompu) — seule une comparaison au rendu-image
> du PDF le peut. La donnée app-owned (`careers.json`/`careerLevels.json`) est vérifiée SAINE (10 carrières
> échantillonnées, 40 valeurs conformes PDF) : le défaut ne touche que la prose `Source/*.md` — réparation
> des glyphes au fil des besoins Atlas, par comparaison PDF.
