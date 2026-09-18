# Ajouter un livre source (pipeline complet)

Opération : intégrer au projet un **nouveau livre autorisé** — VF, ou le livre VO nommément
autorisé au § Sources VF de `CLAUDE.md` — de
son PDF à sa présence dans l'Atlas RAW (`docs/raw/`) et, si besoin, dans `src/data/*.json`. Suit le
runbook rejoué pour **La Mer des Griffes** (MDG, 15e livre, 2026-06-22 — commits `295f9a40` +
`819de62d`). Lire d'abord `docs/raw/00-index.md` et `docs/raw/sources.md`.

**Préalable non négociable** (règle 1 de `CLAUDE.md`) : un livre n'entre dans le pipeline que s'il est
déjà listé au § *Sources VF* du `CLAUDE.md` racine du dossier `Game`, en **VF**. Un livre **VO**
n'entre que s'il y est **NOMMÉMENT** autorisé ; à ce jour il y en a UN, le *Core Rulebook 5e*
(arbitrage utilisateur du 2026-09-18, épique #1816). La Boîte d'Initiation
WFRP 4e est explicitement **exclue** (`docs/raw/sources.md` § *Exclu des règles* — ruleset simplifié
divergent, jamais une source de règles ni de stats).

## 0. Format canonique (la forme UNE de toute extraction)

Toutes les extractions de `Source/` ont **UN** format, décrit ici et mesuré par
`scripts/raw/check-source-format.mjs`. **Le geste, un seul** : rejouer la chaîne canonique sur le
livre — re-découpe depuis la sortie Marker conservée sous `Source/_marker/`, ou ré-extraction quand
cette sortie manque. Jamais un rafistolage chapitre par chapitre (arbitrage utilisateur du
2026-09-14, verbatim : « Il faut un format unifié pour toutes les extractions, donc s'il faut
rééxtraire, on rééxtrait » ; fiche
`.claude/memory/user-doctrine-format-unifie-reextraction-permise.md`). La clause de l'épique #1388
« un livre en service ne se ré-extrait plus » est levée par cet arbitrage ; « FORME jamais SENS »
reste.

**La chaîne JOUABLE aujourd'hui** — c'est exactement celle des §1 et §2, et rien d'autre n'est
committé :

- `marker-pdf` (CPU), config `scripts/raw/marker-paginate.json` (`paginate_output: true`, inchangée
  depuis `09b30a7b8`) : le markdown de sortie porte des séparateurs `{N}----`, N = page PDF
  **0-indexée**.
- Une passe **PLEINE** par livre (§1), ou le driver `scripts/raw/reextract-all.sh` qui boucle les 13
  suppléments vers le staging `Source/_marker/split/<dir>/` sans jamais écraser `Source/`.
- Découpe par `scripts/raw/marker-split.mjs` : il pose lui-même la ligne 1 `*Pages PDF …*` et passe
  chaque nom de fichier par `nomAscii`. Il s'**aligne sur la structure `Source/` préexistante** —
  il lit les anciens `NN - X.md` et leur marqueur `Pages PDF` pour retrouver les frontières. Un
  dossier qui n'en porte pas (les 6 livres en `*Folio N+*`, les 4 dossiers pré-pipeline) ne lui
  donne aucun chapitre : sa structure cible se pose d'abord (§2).
- Folios ensuite : `scripts/raw/folio-bootstrap.mjs` puis `scripts/raw/anchor-fill.mjs`.

**Découpage en tranches (reste de #1739).** La session d'extraction produit le PDF par tranches de
40 pages ; le séparateur `{N}----` portant l'index **absolu** de page quelle que soit la tranche,
les tranches s'unissent **par page** (une page en double ou un texte hors pagination doivent être
refusés). **Cet outil d'union n'est pas encore committé** : `marker-split.mjs` prend UN seul `.md`
et n'unit rien ; il arrivera avec le premier livre ré-extrait (AU1). Les contraintes de machine
citées avec — MAX_PATH (260) dépassé par `<out>/<nom du PDF>/<nom du PDF>.md` et l'échec **après**
conversion, ~7 Go de pointe, 15-20 s par page CPU, un seul Marker à la fois — sont un **témoignage
relevé le 2026-09-14** par la session d'extraction, non mesuré ici.

**La forme CIBLE**, telle que la garde la mesure — **aucune extraction ne l'atteint aujourd'hui**
(20 dossiers sur 20 hors format, LDB compris) :

| Trait | Forme canonique | Famille d'écart |
|---|---|---|
| Ligne 1 d'un chapitre | `*Pages PDF a-b*` (ou `*Pages PDF a*` pour une page unique) | `ligne1-hors-format` |
| Folios | au moins une ancre `data-folio` par chapitre | `sans-folio` |
| Ancres | `<span id="page-N-0" data-folio="F"></span>` **inline**, préfixe du texte qu'elle ouvre — jamais seule sur sa ligne | `ancre-seule` |
| Nom de fichier | `NN - Titre imprimé.md` par `nomAscii` — jamais un signet Word (`_GoBack`, `_gjdgxs`, `Sans titre`) | `nom-de-signet` |
| HTML | aucun, hors ancres et `<br>` | `html-residuel` |
| `00 - Index.md` | liens relatifs tous vivants | `index-mort` |
| Tables | chaque bloc a sa ligne de séparateur `\|---\|` | `table-sans-separateur` |

**La garde et son stock.** `node scripts/raw/check-source-format.mjs` balaie les **20 dossiers FR
suivis** — les 16 livres à `dir` de `src/data/books.json` plus les 4 dossiers antérieurs au pipeline,
atteints par balayage des préfixes `Warhammer v4 - `, `WH - V4 - `, `WH4_FR_`, `Boite d'Initiation`,
`Warhammer - Habitants` — et compare ce qu'elle mesure au stock nominatif
`scripts/raw/source-format-stock.json` : une entrée par (famille, dossier, détail). Les deux sens
sont rouges — un écart hors du stock (rejouer la chaîne sur le livre, ou déclarer l'entrée au
message par `CLIQUET:`), une entrée sans écart mesuré (la chaîne a été rejouée : l'entrée se
retire). `--ecrire-stock` régénère le stock. Comme la `ref` d'une entrée porte un **compte**
(« ×N »), **tout geste non canonique se voit** : corriger une occurrence sur N déplace la clé et
rougit la garde — c'est voulu. **Comment le stock décroît** : un livre repassé par la chaîne en sort
dans le train qui l'intègre — remplacement du dossier suivi, `node scripts/raw/reanchor.mjs --apply
--remap`, `node scripts/source/reparer-adresses.mjs --apply`, stocks régénérés, le tout dans le
MÊME commit. L'ordre de ré-extraction vit sur le ticket #1739. Le stock ne remonte jamais sans un
`CLIQUET:` porté au message.

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

**Piège connu** : Marker **gate par mise en page** — un livre
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
  "<marker-paginé.md>" "<dossier-sortie>" [--pdf <chemin.pdf>]` — `--pdf` (par défaut
  `Source/<nom du dossier du livre>.pdf`) est la référence des vérifications de pages perdues
  (ci-dessous) ; le 2ᵉ argument accepte un `.md` d'un tenant **ou un
  dossier de tranches `--page_range`** (`slices/<a>-<b>/<pdf>/<pdf>.md`, union des tranches par la lib
  `scripts/raw/lib/marker-pages.mjs`, parseur `{N}----` UNIQUE du dépôt). Aligne les nouveaux chapitres sur les noms de fichiers
  et pages de début des anciens `.md` (marqueur `Pages PDF X` en tête de chaque ancien chapitre),
  frontière **titre-d'abord** (cherche l'en-tête markdown au/après la page de début), repli sur
  l'offset de page si le titre ne matche pas (gère les chapitres qui partagent une page — génère
  alors un stub `*(Page X partagée avec un chapitre voisin…)*`, à vérifier).
  **Nommage** : un titre d'ancien fichier qui est un nom de **signet Word** (`_gjdgxs`, `Sans titre`)
  ne se recopie pas — le fichier de sortie prend le **titre imprimé** (texte de l'en-tête Marker qui a
  matché, réduit par `nomAscii`) ; si aucun en-tête n'a matché pour ce chapitre, le script **échoue**
  en le nommant (jamais un `Sans titre` écrit sous `Source/`).
- **Livre neuf, sans structure à réaligner** : écrire un splitter dédié sur le patron de
  `scripts/raw/split-mdg.mjs` — liste ordonnée `[titre de fichier, clé normalisée du titre]` tirée
  du **sommaire** du livre, recherche **séquentielle** de chaque en-tête `#…` (gère les titres
  dupliqués ailleurs dans le texte), page PDF déduite du dernier séparateur `{N}----` rencontré + 1.
  Sortie : `Source/<Livre>/NN - Titre.md` (garde l'en-tête `*Pages PDF X*` ou `*Pages PDF X-Y*`,
  séparateurs `{N}----` retirés) + `00 - Index.md` récapitulatif.

**Pages perdues** — Marker gate PAR MISE EN PAGE : une page saturée de planches ou d'encadrés peut
sortir **vide** (son seul contenu est un saut de ligne) alors que la couche texte du PDF en porte
des milliers de caractères. Une page vide est INVISIBLE pour un simple inventaire des pages
absentes : les deux découpeurs la mesurent (`pagesPerdues` de `scripts/raw/lib/marker-pages.mjs` —
page vide ou absente chez Marker **et** plus de 200 caractères lus par pypdf) et **refusent de
découper** en imprimant, pour chaque page, la commande de **ré-extraction ciblée** à jouer
(`--disable_ocr --force_layout_block Text --page_range <k>` sur cette page seule, sortie dans
`restitutions/<k>/` à côté des tranches). Au run suivant, `restituerPages` fusionne ces restitutions
dans l'extraction de base — une restitution ne remplace QU'une page vide ou absente ; sur une page
déjà pleine, elle lève. Mesuré sur le *WFRP 5e Core Rulebook* : pages PDF 17, 19 et 126 (1806 / 1461 /
2070 caractères chez pypdf, `'\n'` chez Marker — la page entière classée `Figure` par la mise en page).
`--force_ocr` n'y change RIEN (même page vide) : c'est la mise en page qui gate, pas la couche texte ;
`--force_layout_block Text` la saute et rend le texte à plat (titres et paragraphes non séparés, à
recoller au PDF si la page est citée).

Les noms de dossier et de chapitre sont **ASCII** : les scripts de découpe écrivent par `nomAscii`
(`scripts/source/nom-ascii.mjs`, la seule translittération du dépôt) et la garde
`src/source-hygiene-guard.test.ts` refuse le reste — un caractère hors de sa table s'y déclare, il ne
s'absorbe pas en silence.

Après découpe : vérifier qu'aucun chapitre n'est un stub vide/mal replié (grep `Page .* partagée`),
puis committer le dossier `Source/<Livre>/` (le PDF et `Source/_marker/` restent gitignorés).

## 3. Enregistrement du livre dans le pipeline

Trois points d'enregistrement, dans cet ordre :

1. **`src/data/books.json`** (SOURCE UNIQUE des acronymes, #585) — l'entrée du livre porte
   `abbr: '<ABRÉV>'`, `dir: 'Source/<dossier du livre>'` et `language` : la langue DU LIVRE (`'VF'`,
   ou `'VO'` pour un livre VO autorisé) — un livre déjà présent en placeholder VO sans `dir` se
   COMPLÈTE, jamais un doublon. Puis **`scripts/raw/_lib.mjs`** — ajouter
   l'`id` du livre au tableau `BOOK_ORDER` : `BOOKS` en DÉRIVE (filtre les entrées porteuses d'un `dir`,
   ordonnées par `BOOK_ORDER` — source unique partagée par `coverage.mjs`/`reconcile.mjs`/`reanchor.mjs`).
   L'ordre de `BOOK_ORDER` fixe l'ordre d'affichage des rapports. (Édition de `books.json` : round-trip
   octet-fidèle exigé par `src/data/serialize.test.ts`.)
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

- **Workflow multi-agents** (opt-in « ultracode », cf. skill `orchestrer-des-agents`) :
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

> ⚠️ **AVANT de curer : inventaire de complétude par TYPE d'entité (garde anti-oubli, #734/#735).**
> `coverage.mjs ⬜0` mesure la **CITATION** (chapitre cité par une fiche / crédité par un catalogue /
> hors-règle), **jamais** la CAPTURE du contenu — un chapitre `📖` est *« transcrit, jamais traité »*.
> Ne JAMAIS prendre `⬜0` pour « livre intégré », et ne PAS dériver le périmètre de curation des seuls
> buckets de catalogue : les entités **transverses** (un talent défini au ch.X, modifié aux ch.Y/Z)
> tombent entre les mailles (vécu VDM 2026-07-22 : le Talent *Concocter* modifié en ch.12 et les 4
> nouveaux Traits, ratés par une énumération pilotée par la couverture — trouvés par l'utilisateur).
>
> **Passe OBLIGATOIRE avant de déclarer le livre intégré** — workflow multi-agents, **un agent par
> chapitre** (patron `vdm-completude-entites`, cf. run 2026-07-22) : recenser EXHAUSTIVEMENT, **par
> TYPE** (sort · carrière · compétence · **talent** · trait · qualité · objet/équipement · état ·
> créature/PNJ · règle · activité · rituel · table · race), tout ce que le livre **ajoute / MODIFIE
> (variante gatée par le module, cf. [`game-doctrine-une-entite-n-livres-n-variantes`]) / republie**,
> avec réf `<ABRÉV> NN l.X`. Sortie = un artefact DATÉ `docs/plans/AAAA-MM-JJ-<livre>-inventaire-entites.md`.
> Puis **RÉCONCILIER** : chaque entité est soit déjà dans `src/data`, soit portée par un ticket. Rien
> qui flotte. Le livre n'est « fait » que quand l'inventaire est soldé (précédent VDM :
> `docs/plans/2026-07-22-vdm-inventaire-entites.md`, 460 entités → tickets #729-#735).

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
  `GameOp[]` (`src/engine/ops.ts`), édité via `<GameOpEditor>` — jamais un type/champ ad hoc (cf. `docs/primitives.md`).

## 6. Vérification (gardes rejouables)

Dans l'ordre, après toute extraction/intégration :

```bash
node scripts/raw/reanchor.mjs --apply     # ré-ancre les citations verbatim « … » de l'Atlas contre la Source courante
node scripts/raw/coverage.mjs             # chapitres du livre : ✅ couvert / 📖 catalogue seul / 🟡 effleuré / ⬜ trou / ➖ hors-règle
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

## 7. Corriger un défaut d'extraction (table cassée, césure, chapitre mal titré, page perdue)

Un `.md` de `Source/` n'est pas figé : une table recollée de travers, un paragraphe coupé par une
césure, une page que Marker a sautée se corrigent **à la main**, au PDF. Ce geste **déplace du
texte**, donc il déplace ce qui le cite : les numéros de ligne des réfs de l'Atlas et du code, et les
**adresses** `descRef` de la donnée. Tout se rejoue en une passe, et **tout part dans le MÊME
commit** (Source corrigée + réfs recalées + adresses recalées + fiches `Implémente` régénérées).

**Frontière avec le §0** : ce geste manuel ne vaut que pour un défaut de **CONTENU** — ce que la
bonne chaîne, rejouée, produirait de la même façon. Un défaut de **FORMAT** (l'une des sept familles
de `scripts/raw/check-source-format.mjs`) ne se corrige JAMAIS à la main : on rejoue la chaîne
canonique sur le livre entier (§0). Corriger une seule occurrence d'une famille déplace la clé du
stock et rougit la garde — c'est ainsi qu'un geste non canonique se voit.

1. **Éditer** `Source/<livre>/NN - X.md`, la page PDF ouverte à côté — verbatim, y compris les
   coquilles du livre. Les marqueurs `<span … data-folio="N">` sont l'ancrage de page : on les
   déplace avec leur texte, on n'en invente pas.
2. `node scripts/raw/reanchor.mjs --apply --remap` — **avant** de committer la Source. La clause de
   `--remap` est écrite plus haut (§6, « Ne jamais lancer `--remap` sur une Source déjà committée ») :
   la carte de recalage se lit du diff `git HEAD`↔arbre, elle n'existe donc que tant que la
   correction n'est pas commitée.
3. `npx vitest run src/data/prose-resolution.test.ts` — la garde de re-résolution liste **exactement**
   les entrées dont l'adresse ne rend plus son texte, avec le code de la rupture
   (`bornes-hors-limites`, `empreinte-divergente`, `ligne-introuvable`…). C'est l'inventaire des
   consommateurs impactés : ni plus, ni moins.
4. `node scripts/source/reparer-adresses.mjs` puis `--apply` — relocalise chaque adresse cassée par
   son **texte d'origine** (la même adresse résolue sur la version `--depuis`, lue par `git show`) et
   propose l'adresse corrigée. Quatre verdicts : `RECALÉE` (un seul emplacement, et l'adresse neuve
   re-rend le texte d'origine à l'octet), `AMBIGUË` (plusieurs emplacements, listés), `PERDUE` (le
   texte n'est plus là), `IRRÉCUPÉRABLE` (l'adresse ne résolvait déjà pas à `--depuis`). Sur un
   montage, c'est le verdict le plus coûteux qui gouverne : un fragment `PERDUE` rend l'adresse
   entière `PERDUE`, même si un autre fragment n'était qu'`AMBIGUË`. **`--apply` n'écrit que les
   `RECALÉE`** ; les trois autres se règlent à la main, au PDF.
5. `node scripts/raw/anchor-fill.mjs <ABBR> --ch NN --pdf <chemin> --apply` s'il reste des blocs sans
   folio : il pose des ancres `data-folio` **ciblées**, et saute tout candidat absent, multiple ou
   hors bornes.
6. `npm run gates && git commit` — tout dans le même commit.

### Défaut de table → geste

Les tables sont là où Marker casse le plus, et une table cassée est une table **inadressable** (une
`descRef` de cellule vise une ligne par sa CLÉ et une colonne par son EN-TÊTE). L'inventaire est
MESURÉ et cliqueté : `node scripts/raw/check-source-tables.mjs` — une entrée par site dans
`scripts/raw/source-tables-stock.json`, un site hors stock comme une entrée sans site sont rouges.
Le fichier de stock est l'**INVENTAIRE** des sites mesurés ; la **dette** est le compte `à trier`
(entrées sans `preuve`), qui décroît vers zéro. Deux gestes soldent donc un site : **corriger** le
`.md` (le site disparaît, on retire son entrée), ou **prouver au PDF** que la forme est celle du livre
(`"preuve": "PDF p.N : …"` + `"date"` sur l'entrée, qui RESTE — le site existe toujours, il est
jugé). Une `preuve` vide, ou posée sur un site qui n'est plus mesuré, est rouge.

| Défaut (famille du détecteur) | À quoi ça ressemble | Geste au `.md` |
|---|---|---|
| `br-litteral` | `\| Gagnez 3 États<br>Assourdi \|` | **RIEN par réflexe** : la lib absorbe la FORME (adressage `sansBr`, rendu de cellule `brEnSaut` → saut de ligne), le site n'est plus inadressable. Son SENS se **lit au PDF, site par site** : une simple **césure** typographique se recolle en espace dans `Source/` ; une **liste d'items** réellement imprimée en colonne se garde telle quelle et se solde par une `preuve` (« PDF p.N : … ») + `date` sur son entrée de stock |
| marqueur de folio collé à une ligne de table — **PAS un défaut** | `<span … data-folio="7"></span>\| Lancer \| …` | **RIEN** : `toBlocks` retire les `<span>` AVANT `parseTable`, la table se lit entièrement (25 lignes sur 25 mesurées le 2026-09-14). L'ancre **reste où la page coupe** — la déplacer réécrirait `Source/` pour un défaut déjà absorbé |
| `donnee-en-tete` | une table dont les « en-têtes » sont `\| 81-85 \| Bouche explosée \|` | c'est la **continuation** de la table précédente coupée par un saut de page : **fusionner** les deux blocs sous les en-têtes réels |
| `cle-de-ligne-ambigue` | deux tables d'une même section partagent la clé `01-10` | restituer les **headings IMPRIMÉS** qui séparent les tables au livre (une section par localisation, par domaine…) — jamais inventer un titre |
| catégorie en mauvaise colonne | `ARMES D'HAST` en 5ᵉ colonne | la ramener en **colonne 1**, comme le bandeau intérieur du PDF — la table reste **UNE et entière**, jamais découpée en headings |
| bandeau de titre en MAJUSCULES | `\| \| TABLEAU DES MOUVEMENTS \| \|` devant les en-têtes | **RIEN** : le parseur l'absorbe (`parseTable` → `titre`), les en-têtes réels remontent tout seuls |
| `banniere-suspecte`, bandeau **non majuscule** ou d'**une seule lettre** | `\| Effet \| \|` (en-tête réel d'une table à UNE colonne), `\| A \| \|` (séparateur d'index), `\| \| \| 159 \|` (folio capté) | **trier au PDF, un par un** : en-tête réel → on n'y touche pas ; folio capté ou séparateur d'index → se retire ou se sort de la table. Jamais d'élargissement de la garde, qui sauterait un en-tête réel |
| `banniere-suspecte`, bandeau **MAJUSCULE sans rangée de donnée** (titres de statbloc PNJ et leurs rubriques) | `\| \| ISABELLA — PROPHÈTE (BRONZE 4) \| \| \|`, `\| COMPÉTENCES DE BASE \| \| \|` | si le livre imprime ce libellé comme un **TITRE** au-dessus du bloc, il devient un **heading `####` tel qu'imprimé**, au-dessus de la table — jamais un titre inventé. Le corpus le prouve pour une partie d'entre eux : `ZI 14 - Expéditions prévues.md:66` porte déjà `#### COMPÉTENCES DE BASE` là où `:234` rend le même libellé en rangée (14 des 63 bandeaux à ≤ 2 rangées sont dans ce cas, mesuré). Pour les autres (`ISABELLA — PROPHÈTE…`, jamais heading ailleurs) : **trier au PDF** |
| `banniere-suspecte`, bandeau **MAJUSCULE devant une table SANS en-têtes** | `46 - Les règles magiques.md:34-36` : `TABLEAU DES INCANTATIONS IMPARFAITES MINEURES` puis directement `\| 01-05 \| Signe de Sorcière… \|` | **restituer la rangée d'en-têtes telle qu'imprimée au PDF**, entre le bandeau et la première donnée. Le parseur REFUSE d'absorber ce bandeau (`estCleDePlage(headers[0])`) : l'absorber promouvrait la fourchette `01-05` en en-tête et ferait perdre une rangée à la table |

Ce que chaque outil voit, et ce qu'il ne voit **pas** :

| Outil | Ce qu'il juge | Son angle mort |
|---|---|---|
| `scripts/raw/check-code-refs.mjs` | qu'une réf `<ABRÉV> NN l.X` du code tient dans les bornes du chapitre, et que la ligne citée n'est pas vide | le **contenu** : une réf qui tombe sur un autre paragraphe de la bonne longueur passe |
| `scripts/raw/reanchor.mjs` | les citations verbatim de l'Atlas, retrouvées à l'identique dans la Source courante | les réfs de *synthèse* (sans citation) — d'où `--remap`, et sa clause d'antériorité au commit |
| `src/data/prose-resolution.test.ts` | que toute `descRef` du dépôt rend son texte AUJOURD'HUI (empreintes comprises) | il nomme la rupture, il ne la répare pas |
| `scripts/source/reparer-adresses.mjs` | où le texte d'origine a atterri, et le re-prouve à l'octet | il n'écrit que les `RECALÉE` — une source **réécrite** n'est pas un déplacement |

Deux précédents exécutés de bout en bout : `850ae3199` (le folio 88 du livre de base restitué — la
page du Juriste revenue à la vérité citable, la donnée suivant le livre) et `8d7465698` (20
lignes-titres de carrières restituées au chapitre 08, `careers.json` repassé au folio imprimé).

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
- `npx vitest run src/data/no-html-in-prose.test.ts` — aucune description collée en HTML. Son prédicat
  `HTML_TAG` vit dans `src/data/source/normalize.ts` et sert AUSSI au volet E de
  `src/data/prose-resolution.test.ts` : la prose **adressée** ne rend pas plus de HTML que la prose
  copiée — un `<br>` resté dans une cellule du `Source/` ne peut donc pas atteindre le joueur.
- `node scripts/raw/check-source-tables.mjs` — tables cassées du `Source/` (cinq familles, stock
  nominatif décroissant `scripts/raw/source-tables-stock.json`) ; le geste est le tableau
  « défaut de table → geste » du §7. `--ecrire-stock` régénère le stock après une correction.
- `node scripts/raw/check-source-format.mjs` — écart de FORME des 20 dossiers FR au format canonique
  (sept familles, stock nominatif décroissant `scripts/raw/source-format-stock.json`) ; le geste est
  de REJOUER la chaîne canonique sur le livre (§0), jamais une correction manuelle.
  `--ecrire-stock` régénère le stock après ce passage.
- `node scripts/source/reparer-adresses.mjs` (+ `--apply`, `--dataset <nom>`, `--depuis <ref-git>`) —
  adresses `descRef` recalées après une correction d'extraction ; sortie 1 tant qu'une adresse reste
  cassée. La garde qui les JUGE est `src/data/prose-resolution.test.ts`.
