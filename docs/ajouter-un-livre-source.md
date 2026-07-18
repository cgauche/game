# Ajouter un livre source (pipeline complet)

Opération : intégrer un **nouveau livre VF autorisé** (§ Sources VF de `CLAUDE.md`) au projet — de
son PDF à sa présence dans l'Atlas RAW (`docs/raw/`) et, si besoin, dans `src/data/*.json`. Suit le
runbook rejoué pour **La Mer des Griffes** (MDG, 15e livre, 2026-06-22 — commits `295f9a40` +
`819de62d`). Lire d'abord `docs/raw/00-index.md` et `docs/raw/sources.md`.

**Préalable non négociable** (règle 1 de `CLAUDE.md`) : un livre n'entre dans le pipeline que s'il est
déjà listé au § *Sources VF* du `CLAUDE.md` racine du dossier `Game`, en **VF**. La Boîte d'Initiation
WFRP 4e est explicitement **exclue** (`docs/raw/sources.md` § *Exclu des règles* — ruleset simplifié
divergent, jamais une source de règles ni de stats).

## 1. Extraction Marker (PDF → markdown paginé)

Le PDF est gitignoré ; l'extraction passe par `marker-pdf` (CPU), avec la couche texte exacte
**désactivant l'OCR** — plus fidèle que l'ancien pymupdf4llm sur les tables :

```bash
marker_single "Source/<Nom du livre>.pdf" --output_format markdown \
  --config_json scripts/raw/marker-paginate.json --disable_ocr \
  --output_dir "Source/_marker/full/<Nom du livre>" --disable_image_extraction
```

Long (~45 min pour un livre dense) — lancer en arrière-plan. `--config_json marker-paginate.json`
active `paginate_output=true` : le markdown de sortie porte des séparateurs `{N}----` (N = page
PDF **0-indexée**).

**Piège connu** (mémoire `game-atlas-raw-doc`) : Marker **gate par mise en page** — un livre
saturé d'illustrations en zones « figure » peut perdre une grosse part du texte en `--disable_ocr`
(vécu sur *Le Zoo Impérial* : -70 %, ré-extrait en OCR classique, seul livre du corpus dans ce cas).
Vérifier après coup que le `.md` produit fait une taille plausible (comparer au nombre de pages du
PDF) avant de découper ; si la perte est massive, relancer **sans** `--disable_ocr`.

Pour ré-extraire en lot les 13 suppléments existants (hors LDB déjà fait), le driver
`scripts/raw/reextract-all.sh` (bash) boucle la commande ci-dessus + l'étape 2 vers un **staging**
(`Source/_marker/split/<dir>/`) sans jamais écraser `Source/` — la promotion reste une étape
manuelle après revue.

## 2. Découpe en chapitres `Source/<Livre>/NN - Titre.md`

Deux scripts selon que le livre a ou non une structure `Source/` **préexistante** à réaligner :

- **Livre déjà présent sous `Source/`** (ré-extraction) : `marker-split.mjs "<ancien-dossier>"
  "<marker-paginé.md>" "<dossier-sortie>"`. Aligne les nouveaux chapitres sur les noms de fichiers
  et pages de début des anciens `.md` (marqueur `Pages PDF X` en tête de chaque ancien chapitre),
  frontière **titre-d'abord** (cherche l'en-tête markdown au/après la page de début), repli sur
  l'offset de page si le titre ne matche pas (gère les chapitres qui partagent une page — génère
  alors un stub `*(Page X partagée avec un chapitre voisin…)*`, à vérifier).
- **Livre neuf, sans structure à réaligner** : écrire un splitter dédié sur le patron de
  `scripts/raw/split-mdg.mjs` — liste ordonnée `[titre de fichier, clé normalisée du titre]` tirée
  du **sommaire** du livre, recherche **séquentielle** de chaque en-tête `#…` (gère les titres
  dupliqués ailleurs dans le texte), page PDF déduite du dernier séparateur `{N}----` rencontré + 1.
  Sortie : `Source/<Livre>/NN - Titre.md` (garde l'en-tête `*Pages PDF X*` ou `*Pages PDF X-Y*`,
  séparateurs `{N}----` retirés) + `00 - Index.md` récapitulatif.

Après découpe : vérifier qu'aucun chapitre n'est un stub vide/mal replié (grep `Page .* partagée`),
puis committer le dossier `Source/<Livre>/` (le PDF et `Source/_marker/` restent gitignorés).

## 3. Enregistrement du livre dans le pipeline

Trois points d'enregistrement, dans cet ordre :

1. **`scripts/raw/_lib.mjs`** — ajouter `['<ABRÉV>', 'Source/<dossier du livre>']` au tableau
   `BOOKS` (source unique partagée par `coverage.mjs`, `reconcile.mjs`, `reanchor.mjs`). L'ordre du
   tableau fixe l'ordre d'affichage des rapports.
2. **`docs/raw/sources.md`** — ajouter une ligne à la table *Les N livres* (abrév, titre, dossier,
   rôle en une phrase) et incrémenter le compte en tête de fichier (« Le **RAW** du projet = ces
   **N livres** »). Si le livre a des chapitres purement narratifs/de cadre (gazetteer), documenter
   le partage règles/cadre ici ou dans `CLAUDE.md`.
3. **`CLAUDE.md`** (§ *Sources VF*) — ajouter l'entrée abrév + dossier + **périmètre par passage** dans
   la liste **RÈGLES & STATS** de `docs/sources-vf.md` (arbitrage 2026-07-10 : tout livre FR peut fournir
   des règles ; un livre dont aucune règle n'est extraite reste simplement listé parmi les volumes
   scénario, comme Ubersreik). La curation est toujours *à la main* (voir § 5) ; préciser le tag
   `source.book` attendu dans `src/data/*.json`.

`docs/raw/00-index.md` liste séparément le compte de livres en tête (« consolidées depuis les N
livres autorisés ») — **vérifier qu'il reste synchronisé** avec `sources.md` à chaque ajout (cf.
§ Anomalies : au moment de la rédaction, `00-index.md` n'a pas suivi le dernier ajout MDG).

Si le livre a des chapitres de **cadre pur** (gazetteer, sans règle), les lister dans
`HORS_REGLE` de `scripts/raw/coverage.mjs` (ex. `'MDG 1', 'MDG 3', …` — cadre côtier) pour qu'ils
sortent du dénominateur de couverture au lieu de compter comme des trous.

## 4. Intégration à l'Atlas RAW (`docs/raw/`)

L'Atlas (cf. `docs/raw/00-index.md`) consolide les règles **par domaine**, pas par livre — un
nouveau livre vient enrichir les fiches de domaine existantes (`combat.md`, `magie.md`, …) ou en
créer une nouvelle si le livre introduit un domaine inédit (le combat naval de MDG a justifié
`docs/raw/combat-naval.md`, un fichier dédié référencé dans la table `Domaines` de `00-index.md`).

- **Workflow multi-agents** (opt-in « ultracode », cf. § *Workflows multi-agents* de `CLAUDE.md`) :
  un agent par domaine touché fait `extract → verify` adversarial — la vérification reconfronte
  chaque réf/citation à la source, indispensable (des fabrications de contenu ont été trouvées et
  corrigées lors de l'épreuve du 2026-06-22, `docs/raw/epreuve-2026-06-22.md`). Le script workflow
  n'a pas d'accès filesystem : il renvoie topics/entrées de catalogue/sommaire en JSON.
- **Apply déterministe** : un script `apply-<livre>.mjs` (patron `scripts/raw/apply-mdg.mjs`) lit
  le JSON de sortie du workflow et insère topics + sommaire dans les fiches de domaine, **idempotent**
  via un sentinel `<!-- <LIVRE>-INTEGRATION -->`.
- **Catalogues de données verbatim** (`docs/raw/catalogue-*.md`) : régénérés par
  `node scripts/raw/build-catalogs.mjs`, qui concatène **verbatim** les chapitres de données du
  livre (repérés par chapitre dans la table `DOMAINS` en tête du script — ajouter les paires
  `[ABRÉV, [numéros de chapitre]]` du nouveau livre au domaine catalogue concerné :
  `catalogue-creatures`, `catalogue-sorts`, `catalogue-divin`, `catalogue-equipement`,
  `catalogue-carrieres` ou `catalogue-divers`). Un chapitre cité par un catalogue est crédité
  **au niveau chapitre** par `coverage.mjs`/`reconcile.mjs` (pas besoin de citation `l.X`).

## 5. Curation de la donnée dans `src/data/*.json`

`src/data/*.json` est la **source app-owned**, commitée, éditable au Compendium. Toute donnée
mécanique tirée d'un nouveau livre s'ajoute **à la main** (ou via l'éditeur en jeu), jamais par
re-seed automatique — c'est le chemin suivi par AA, ZI, MDG, ACE, MSRC et NADJ (périmètres :
`docs/sources-vf.md`).

- Chaque entrée mécanique tagge sa provenance avec un champ `source: { book: "<ABRÉV>", page: N }`
  (vu tel quel dans `src/data/traits.json`, `naval-traits.json`, `creatures.json`, `activities.json`,
  `mutations.json`, `careers.json`, etc. — 38 fichiers portent ce champ). Certaines données de
  périmètre (activités, véhicules) portent en plus un `where: [...]` qui gate par lieu/contexte
  (ex. `activities.json` avec `"source":{"book":"ACE"}, "where":["altdorf"]`).
- Coller le texte **verbatim** (règle 5 de `CLAUDE.md`) : aucune reformulation, formatage Markdown
  conservé (`**gras**`, listes, sauts `\n\n`), jamais de HTML — garde-fou
  `src/data/no-html-in-prose.test.ts`.
- Toute description mécanique passe par la primitive `<Prose>` (`src/ui/Prose.tsx`) au rendu, pas
  par un `dangerouslySetInnerHTML` ou un template ad hoc.
- Tout **effet mécanique** (passif, déclenché, soin, dégâts…) issu du nouveau livre s'exprime en
  `GameOp[]` (`src/engine/ops.ts`), édité via `<GameOpEditor>` — jamais un type/champ ad hoc (cf.
  table des primitives partagées de `CLAUDE.md`).

## 6. Vérification (gardes rejouables)

Dans l'ordre, après toute extraction/intégration :

```bash
node scripts/raw/reanchor.mjs --apply     # ré-ancre les citations verbatim « … » de l'Atlas contre la Source courante
node scripts/raw/coverage.mjs             # chapitres du livre : ✅ couvert / 🟡 effleuré / ⬜ trou / ➖ hors-règle
node scripts/raw/reconcile.mjs            # code ↔ Atlas : Sens A (règle codée absente de l'Atlas) doit rester à 0
```

- `reanchor.mjs --apply` corrige les dérives **HIGH** (citation retrouvée de façon unique dans la
  source) ; `--remap` (réservé aux réfs de *synthèse*, sans citation attachée) ne doit être lancé
  **qu'avant de committer** une nouvelle extraction de la Source — une fois committée, `git HEAD`
  == l'arbre de travail et la carte devient un no-op. Ne jamais lancer `--remap` sur une Source déjà
  committée : il recalerait aussi les réfs des autres livres via le diff `git HEAD`↔arbre.
- `coverage.mjs` doit sortir le nouveau livre à `⬜ 0` (tout chapitre-règle couvert par une fiche
  **ou** un catalogue **ou** listé en `HORS_REGLE`/`SCENARIO_BOOKS`) avant de considérer
  l'intégration terminée.
- `reconcile.mjs` ne réconcilie que les réfs **`LDB NN l.X`** en profondeur (Sens A ligne-par-ligne) ;
  pour les autres livres (dont un nouveau livre comme MDG), il ne fait qu'un comptage global des
  mentions par livre (section *Autres livres* du rapport), sans le calcul de trou fin par ligne.

## Piège des PDF sources faillibles

Un écart entre `src/data/*.json` et la Source `.md` **n'implique pas que le JSON est faux** — les
PDF WFRP4 (même passés à Marker) contiennent de vraies erreurs, et une partie de la donnée a déjà
été corrigée à la main contre ces erreurs (exemple fondateur : la table de carrières Middenheim
suit l'ordre alphabétique **anglais** dans le PDF FR, ce que le JSON corrige). Sur tout audit,
traiter chaque écart **au cas par cas** : citer la source, se demander si c'est un bug JSON ou une
correction volontaire, et flaguer plutôt qu'imposer la valeur de la source. En cas de doute sur une
valeur/orthographe (pas sur un ordre de collation), la **VO** du même livre (dispo sous `Source/`)
sert d'arbitre — jamais comme source de la donnée affichée, qui reste recollée du FR.

## Gardes

- `node scripts/raw/coverage.mjs` — couverture chapitre-par-chapitre du livre (doit atteindre ⬜0).
- `node scripts/raw/reconcile.mjs` — Sens A (règle codée absente de l'Atlas) doit rester à 0 après
  toute extension de `src/engine`/`src/data` qui cite le nouveau livre.
- `node scripts/raw/reanchor.mjs` (+ `--apply`, one-shot `--remap` avant commit de la Source) —
  citations verbatim de l'Atlas alignées sur la Source courante.
- `npx vitest run src/data/no-html-in-prose.test.ts` — aucune description collée en HTML.
