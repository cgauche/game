# Revue de palier — fenêtre 9e15cba42..abedb5fd4 — 2026-09-14

verdict: PARTIEL

29 commits, 22 de substance (`-- src scripts`), 4 fermetures — #1699, #1732, #1734, #1736 — toutes CLOSED et toutes emportant leur solde DANS le commit qui ferme, plus la revue du palier précédent archivée par `0fc308cef`. Les deux gros claims chiffrés rejoués tiennent à l'octet (chapitres de `Source/` byte-identiques : 336 renommages purs, aucun fichier hors `00 - Index.md` à delta non nul ; huit stocks convertis à dette identique, `JAMBE_INLINE` 97 = 97 sous un plafond qui en tolérait 103). Ce qui ne tient pas : un solde NEUF (#1732) cite une capture ABSENTE de git — la classe que la revue précédente avait nommée est REPRODUITE, pas levée ; le message de `ed42c9a81` annonce que « les plafonds restants sont TRIÉS » alors que dix plafonds de la même forme (compte de dette ≤ N) survivent sans être nommés ni dans le message, ni sur #1727 ; l'instrument `fermetures-non-citees` reste borné par `--depuis <date>`, donc la lentille de fermeture reste inmesurable pour une fenêtre bornée par shas ; et le binaire VO 5e reste sans porteur dans `Source/`. Aucun rouge de CI dans la fenêtre, aucun poison introduit sur 17 307 lignes ajoutées. Juge unique (Opus, lecture seule, 2026-09-14), arbre de lecture = worktree `.wt-1508-t3b` dont le commit local hors fenêtre a été IGNORÉ : toute mesure de contenu par `git show|ls-tree|grep|diff <sha>`.

## Trouvailles confirmées

1. **La classe « capture citée, capture absente de git » est REPRODUITE par un solde de cette fenêtre** (lentille restes-de-la-revue-precedente / fermetures-soldes-DoD) — `.claude/soldes/1732.md:11` ouvre par `capture: public/qc/1732-arete-survol.png` et décrit la preuve visuelle en dix lignes ; `git ls-tree abedb5fd4 -- public/qc/1732-arete-survol.png` → **vide**, `git log --all -- public/qc/1732-arete-survol.png` → **vide** : le fichier n'existe dans AUCUN objet du dépôt. Le solde affirme donc une preuve inouvrable, dans le commit même qui ferme le ticket. La revue précédente (trouvaille 2) avait demandé « la classe se ferme sur le fond : capture versionnée, ou champ de capture qui cesse d'affirmer une preuve ». → attendu : soit la capture entre sous `public/qc/` (le dossier est versionné, `public/qc/baseline-affine/*.png` y vivent), soit le champ `capture:` d'un solde ne nomme qu'un artefact versionné. · NON bloquante, mais c'est une RÉCIDIVE dans la fenêtre suivant le signalement.

2. **`ed42c9a81` (T0c) sur-annonce l'exhaustivité de son tri : dix plafonds de la MÊME forme survivent, non nommés par le message ni par #1727** (lentilles stocks-et-cliquets / rejeu-des-affirmations) — le sujet dit « les plafonds **restants** sont TRIÉS contre l'invariant (juge dédié, table réfutée sur deux lignes, confirmée sur quatre) », et ne nomme hors train que `PLAFOND_HORS_STRATE`. Mesuré à la tête, `toBeLessThanOrEqual(<CONST>)` sur un COMPTE DE DETTE : `FOLIO_RATCHET_MAX = 109`, `FOLIO_TITLE_RATCHET_MAX = 0`, `UNRESOLVED_MAX = 776` (`src/data/book-source-integrity.test.ts:74,109,158`), `SANS_CITATION_MAX = 3294` (`src/data/folio-line-align.test.ts:62`), `PENDING_MAX = 1`, `UNDOCUMENTED_ENGINE_EXPORTS_MAX = 301`, `MANUAL_DOCS_MAX = 8`, `DETTE_ADOPTION_MAX = 346`, `TUS_MAX = 4`, `PLAFOND_ANCRES_OEIL_ABSENTES` — soit dix, plus `PLAFOND_HORS_STRATE` déclaré. `FOLIO_RATCHET_MAX` est l'exemple exact du critère que T0c a appliqué pour tuer `PLAFOND_FINDINGS` : son stock `scripts/guards/lib/folioRatchetStock.mjs` porte 109 entrées et le test tient déjà les deux volets (entrée absente ROUGE, entrée qui ne viole plus ROUGE) — le plafond n'ajoute que des crans d'accueil, et son propre commentaire l'admet (`folioRatchetStock.mjs:15` « (c) la TAILLE du stock est plafonnée »). Aucune occurrence de `FOLIO_RATCHET` dans le corps de `ed42c9a81`, ni dans les commentaires de #1727 (0 hit sur les deux). → attendu : le message dit le PÉRIMÈTRE trié (les plafonds du train) et non « les restants », et le stock résiduel (10 plafonds nommés) va au ticket porteur, sinon le prochain train héritera d'un « restants » déjà faux. · NON bloquante (#1727 est OPEN).

3. **L'instrument `fermetures-non-citees` reste borné par une DATE : la lentille de fermeture d'un palier borné par shas demeure inmesurable** (lentille derogations-et-ci) — mesuré à la tête : `scripts/ops/fermetures-non-citees.mjs:177` lit `args.indexOf('--depuis')`, `fermeesDepuis(depuis)` interroge `search/issues?q=…closed:>=${depuis}` (`:134-138`) et `citesDepuis(depuis)` fait `git log --since=…` (`:160-161`) ; aucune option de PLAGE de shas n'existe. Le stock `scripts/ops/fermetures-non-citees.json` porte `"mesureLe": "2026-09-04"`, `"fenetre": "2026-08-20"` et 12 entrées, inchangé dans la fenêtre. C'était l'attendu n°1 de la revue précédente : il **N'A PAS BOUGÉ**. → attendu : inchangé — `--plage <base>..<tête>` (ou la baseline écrite au même geste que le palier). · NON bloquante, mais elle rend cette lentille non instrumentée pour le deuxième palier consécutif.

4. **Le binaire VO 5e de `Source/` reste sans porteur, un palier de plus** (lentilles regime / poison-des-diffs) — `git ls-tree -r --name-only abedb5fd4 -- Source/` filtré sur les images : deux fichiers, dont `Source/WHFRP 5e - [Cubicle 7 Entertainment] - Warhammer Fantasy Roleplay 5e - Endpaper Map [OEF][2026-09-01].jpg` ; `git grep -i endpaper abedb5fd4 -- docs scripts src` → **aucun site**. Le CLAUDE.md § Sources VF exige qu'un périmètre s'établisse « par PASSAGE, documenté dans `docs/sources-vf.md` ». → attendu : entrée de `docs/sources-vf.md` disant ce que la pièce EST et ce qu'elle n'autorise pas, ou retrait. · NON bloquante.

5. **Une divergence de chiffre entre le message de `e27aceebf` et le blob** (lentille rejeu-des-affirmations) — annoncé « CLAUDE.md 51,7 → 9,0 Ko » ; mesuré `git cat-file -s e27aceebf^:CLAUDE.md` = **53 211 octets** (51,96 Kio / 53,2 ko) et `e27aceebf:CLAUDE.md` = **9 127** (8,91 Kio / 9,1 ko), inchangé à la tête. Le « après » tient, le « avant » est sous-évalué d'environ 0,3 Ko : le chiffre du message n'a pas été pris sur le blob parent. → attendu : les chiffres d'un message se prennent sur les objets du commit. · NON bloquante (la substance — division par ~5,8 — tient).

## Écartées par re-mesure

- ~~Le CLIQUET de `b87100ea2` « `jambesGabaritStock.mjs` +97 » ment : le stock porte 98 entrées~~ — écartée : la première sonde comptait `fichier:` en texte libre (98, dont une occurrence de l'en-tête « FORME DES ENTRÉES »). Comptage structurel `^\s*\{ fichier:` = **97** à `abedb5fd4`, et l'ancien `JAMBE_INLINE` de `jambes-gabarit-ratchet.test.ts` porte **194 quotes = 97 ids**. Dette IDENTIQUE 97 = 97, sous un `PLAFOND_INLINE = 103` (`b87100ea2^:…:46`) qui tolérait donc **6 crans d'accueil silencieux** : la conversion resserre réellement. (La mention « 103 ids » du design collé sur #1727 est ce qui était faux, pas le commit.)
- ~~`6ba23c74f` « chapitres BYTE-IDENTIQUES » est une affirmation de message~~ — écartée : `git diff --numstat -M 6ba23c74f^ 6ba23c74f -- Source/` rend **376 lignes, dont 336 à `0 0`** ; le filtre « non-`0 0` ET non-`00 - Index.md` » rend **zéro ligne**. Tout le delta de contenu est porté par les 39 index + la paire A/D de l'index `Boîte d'Initiation`, exception déjà DÉCLARÉE au solde #1699.
- ~~Poison introduit par la fenêtre~~ — écartée : sur **17 307 lignes `+`** sous `src`/`scripts`, le motif (excuse, tombale, attente, TODO/FIXME/legacy) rend **22 hits**, tous légitimes — 14 sont le CORPUS de test du détecteur `commentPoison` lui-même (positifs et contrôles négatifs de `src/comment-poison-guard.test.ts`), 2 sont son motif (`LOCUTION_ATTENTE`), 4 nomment un FICHIER temporaire (`fichierTemporaire`, écriture atomique du journal de `publier.mjs`), 1 est un verbatim de garde, 1 une frontière de vocabulaire. Aucun commentaire-excuse neuf sans `[entériné]`, aucune pierre tombale.
- ~~`ca4c0fb83` (B2) « la famille `span-colle` disparaît », « inventaire de 664 sites »~~ — écartée, les deux mesurés à la tête : `git grep -c span-colle abedb5fd4 -- scripts/raw/source-tables-stock.json` → **aucun hit** ; `"fichier"` dans ce même stock → **664**. Et `98257f79e` (H-0) : `scripts/raw/source-format-stock.json` → **57 `"fichier"` / 57 `"famille"`**, exactement le `CLIQUET: … +57` déclaré.
- ~~`0fc308cef` : les interdits git du train de publication sont une promesse de message~~ — écartée : `git grep -c execFileSync abedb5fd4 -- scripts/ops/publier.mjs` → **aucun hit** (exit 1), et `commandeInterdite` est défini (`:326`) et appelé avant spawn (`:528`), sous son bloc INTERDITS gravé (`:20`). Aucune porte git parallèle.
- ~~#1728 traverse la fenêtre sans un mot sur le ticket (trouvaille 6 du palier précédent)~~ — écartée : `gh issue view 1728` → OPEN, **1 commentaire**, posté par le train (`<!-- publier: dacc0e575… -->`) et portant les 3 commits, les 24 gates chronométrées et la course CI verte `34847420730`. La correction est venue par l'OUTIL, pas par un geste manuel : c'est la forme la plus solide.

## Tenus

- fermetures-soldes-DoD : les 4 fermetures sont CLOSED (`gh issue view` : #1736 `2026-09-14T11:19:53Z`, #1732 `08:55:14Z`, #1734 `08:55:11Z`, #1699 `08:22:55Z`) et chacune emporte SON solde DANS le commit qui ferme — `git show --stat 0fc308cef -- .claude/soldes` → `1736.md` 13 lignes **+ la revue du palier précédent (45 lignes)** ; `c31571a72` → `1732.md` 14 ; `54e6cdcad` → `1734.md` 12 ; `6ba23c74f` → `1699.md` 12. Aucune fermeture posée hors commit dans la plage.
- fermetures-soldes-DoD : les 4 soldes portent `## Restes` ET `## Réfutation`, chaque reste étant ROUTÉ vers un ticket OUVERT (#1737, #1296, #1727 — tous mesurés OPEN) ou motivé `-> RAS` avec sa mesure (première publication réelle par l'outil = le lot lui-même ; 7 worktrees `propre+fusionné` rendus à l'arbre principal ; `fetchOrigin` de l'inventaire dit en en-tête ; PDF gitignorés hors de tout commit).
- fermetures-soldes-DoD : les DoD contredites sont DITES et non enjolivées — #1736 nomme explicitement que le DoD « première publication par l'outil sur #1732/#1734/T0a » n'a pas eu lieu (ces lots étaient publiés avant) et re-qualifie la première publication réelle ; #1699 qualifie l'exception des 39 index comme décision d'ingénierie dans l'en-tête de la migration.
- derogations-et-ci : **zéro rouge dans la fenêtre**. Les 10 shas de la fenêtre ayant une course (`gh run list --branch main --limit 60`) sont tous `success` : `abedb5fd4`, `dacc0e575`, `98257f79e`, `451c4d6fb`, `3dc9500a7` (CI + Canari), `c5eec9370`, `212a8714b`, `1b3d794cb`, `d25dc31b0` ; les deux seules `failure` de la liste (`6e76f75d6`, `cdb57b518`) sont antérieures à la base.
- commits-triviaux : les `chore(docs)` ne portent QUE des docs générés — `abedb5fd4` 3 fichiers `docs/`, `75c0196ba` 2, `451c4d6fb` 7, `dacc0e575` 9, `1b3d794cb` 7, `a39f6ed25` 4, `f89481739` 11 : aucun chemin hors `docs/`. Le seul `chore` porteur d'un non-doc est `10980523f`, `chore(raw/source)`, qui emporte `scripts/raw/source-tables-stock.json` — c'est EXACTEMENT ce que son sujet annonce (régénération du stock sur les chemins ASCII).
- cross-os-et-determinisme : la passe sur les `+` rend **8 sites**, tous légitimes — `process.platform === 'win32' ? 'npm.cmd' : 'npm'` (×2, la seule forme correcte sous Node/win32), `new Date().toISOString()` (×5 : horodatage de JOURNAL et date d'un message de commit, jamais une décision de test), un `localeCompare(a, b, 'en')` **à locale explicite** en départage d'un tri par profondeur. Aucun chemin absolu de machine, aucun `Math.random`.
- poison-des-diffs : aucun test neutralisé, et les bancs ajoutés sont des contrats POSITIFS — le corpus de `commentPoison` compte 6 positifs, 1 cas `[entériné]` neutralisé et 9 contrôles NÉGATIFS verbatim tirés du code réel : c'est un détecteur dont la couverture est mesurée, pas affirmée.
- stocks-et-cliquets : **18 `CLIQUET:`** dans la fenêtre, chacun avec sa mesure et son motif ; les conversions se lisent à la tête — `paletteLiteralStock` 1268, `entityOrphanStock` 365, `rigViewStock` 127, `jambesGabaritStock` 97, `rigPartViewStock` 79, `quadDecoStock` 73, `folioLineAlignStock` 47, `fleshGradientStock` 44, `tableConsumerStock` 1 — toutes égales aux totaux déclarés. Les hausses sont des NAISSANCES de stock déclarées (`source-tables-stock.json` +687, `source-format-stock.json` +57) et les entrées de `ecrivainsAtteints.test.mjs` portent chacune leur mesure d'écriture (fixtures sous `os.tmpdir()`, écriture fermée par `--ecrire-stock`).
- regime : chaînage sans trou (29 commits, `origin/main` = `abedb5fd4`), un seul auteur git, et **18 des 22 commits de substance portent une trace de juge/réfutation** dans leur corps ; les 4 sans trace sont des régénérations de stock/docs et un recalage de données.
- auditStock : `scripts/ops/audit-stock.json` **n'a pas bougé** dans la fenêtre (aucun commit sur ce chemin) ; son en-tête déclare lui-même son angle mort (« CETTE LISTE EST INVISIBLE À LA PORTE T3 … le cliquet de ce stock-ci vit dans `audit-stock.test.mjs` »), et `package-lock.json` n'a pas été touché : aucune advisory neuve ne peut être entrée sans porteur par cette fenêtre.
- restes-de-la-revue-precedente, bilan à l'octet : (1) bornage `fermetures-non-citees` → **N'A PAS BOUGÉ** (trouvaille 3) ; (2) captures → **N'A PAS BOUGÉ, et la classe récidive** (trouvaille 1) ; (3) `AreteOverlay.tsx:16` → **LEVÉ** (#1732 CLOSED, le détecteur gagne `ATTENTE_DE_X`) ; (4) `1687.md` « sans ticket » → **LEVÉ** (#1734 CLOSED, restes routés vers #1296 OPEN) ; (5) binaire VO 5e → **N'A PAS BOUGÉ** (trouvaille 4) ; (6) #1728 sans commentaire → **LEVÉ** (1 commentaire, posé par le train).
- NON MESURÉ — la re-mesure VIVANTE des advisories (`npm audit`) : elle exige un arbre installé et le réseau, et la consigne interdit tout runner de suite ; jugée par l'immobilité de `audit-stock.json` et de `package-lock.json`.
- NON MESURÉ — le rejeu des suites revendiquées par les messages (`test:hooks` 891/891, `test:ops` 177/177, vitest 139/139, `typecheck` full) : aucun rejeu de suite n'était autorisé ; la CI verte sur les 10 shas publiés en tient lieu.
- NON MESURÉ — « un codeur par train », fan-out d'agents, recettes navigateur : aucune trace vérifiable en lecture seule dans git (et c'est précisément la classe de la trouvaille 1).
- MUTATIONS SUR DISQUE : aucune. Aucune commande git écrivante (0 `add/commit/checkout/restore/reset/stash/clean/fetch`), `gh` en lecture seule (`issue view`, `run list`), aucun serveur, aucun runner de suite. Toute mesure de contenu passe par `git show|ls-tree|grep|diff <sha>` ; les fichiers intermédiaires vivent hors de l'arbre.

---

```
SONDES

# S1 — fenêtre et substance
git -C <wt> rev-parse origin/main
git -C <wt> rev-list --count 9e15cba42..abedb5fd4
git -C <wt> rev-list --count 9e15cba42..abedb5fd4 -- src scripts
-> abedb5fd4999a5f31c2e071830d22fe2f26797a2
-> 29
-> 22

# S2 — fermetures et soldes emportés
git -C <wt> log --format="%h|%s" 9e15cba42..abedb5fd4 | Select-String "corrige #"
-> 0fc308cef corrige #1736 | c31571a72 corrige #1732 | 54e6cdcad corrige #1734 | 6ba23c74f corrige #1699, refs #1388
git -C <wt> diff --name-status 9e15cba42..abedb5fd4 -- .claude/soldes
-> A .claude/soldes/1699.md
-> A .claude/soldes/1732.md
-> A .claude/soldes/1734.md
-> A .claude/soldes/1736.md
-> A .claude/soldes/revue-palier-2026-09-14-5b4fe9b6c-9e15cba42.md
git -C <wt> show --stat --format="%h" 0fc308cef -- .claude/soldes
-> .claude/soldes/1736.md | 13 +++++++
-> .../revue-palier-2026-09-14-5b4fe9b6c-9e15cba42.md | 45 ++++++++++++++
git -C <wt> show --stat --format="%h" c31571a72 -- .claude/soldes  -> 1732.md | 14 ++++
git -C <wt> show --stat --format="%h" 54e6cdcad -- .claude/soldes  -> 1734.md | 12 ++++
git -C <wt> show --stat --format="%h" 6ba23c74f -- .claude/soldes  -> 1699.md | 12 ++++
gh issue view 1736|1732|1734|1699 --repo cgauche/game --json state,closedAt
-> CLOSED 2026-09-14T11:19:53Z / CLOSED 08:55:14Z / CLOSED 08:55:11Z / CLOSED 08:22:55Z

# S3 (trouvaille 1) — capture citée, capture absente
git -C <wt> grep -n "capture:" abedb5fd4 -- .claude/soldes/1699.md .claude/soldes/1732.md .claude/soldes/1734.md .claude/soldes/1736.md
-> abedb5fd4:.claude/soldes/1732.md:11:capture: public/qc/1732-arete-survol.png — recetteur du 2026-09-14 …
git -C <wt> ls-tree abedb5fd4 -- "public/qc/1732-arete-survol.png"
-> (aucune sortie)
git -C <wt> log --oneline --all -- "public/qc/1732-arete-survol.png"
-> (aucune sortie)

# S4 (trouvaille 2) — plafonds de dette survivants
git -C <wt> grep -n -E "toBeLessThanOrEqual\((MAX_|PLAFOND_|[A-Z_]+_MAX)" abedb5fd4 -- src scripts
-> src/data/book-source-integrity.test.ts:100 FOLIO_RATCHET_MAX ; :180 FOLIO_TITLE_RATCHET_MAX ; :201 UNRESOLVED_MAX
-> src/data/folio-line-align.test.ts:135 SANS_CITATION_MAX ; src/data/grounding-corpus.test.ts:74 PENDING_MAX
-> src/data/index-moteur-ratchet.test.ts:38 UNDOCUMENTED_ENGINE_EXPORTS_MAX ; src/data/manual-docs-ratchet.test.ts:77 MANUAL_DOCS_MAX
-> src/data/slots-contrat.test.ts:296 DETTE_ADOPTION_MAX ; src/data/structures-contrat.test.ts:435 PLAFOND_HORS_STRATE
-> src/gameIso/rig/quadruped/quad-anchor-contract.test.ts:134 PLAFOND_ANCRES_OEIL_ABSENTES ; src/ui/compendium/codex-edit-ancrage.test.ts:93 TUS_MAX
   (+ 10 seuils géométriques/physiques écartés : RASTER_PX_MAX, ECART_HAUTEUR_MAX, HAUSSE_MAX, STEP_MAX_M, MAX_VIEW_SPREAD, HALO_PULSE_MAX, ECART_MAX, Z_MAX, QUAD_DECO_PLAN_MAX, ATLAS_FRAMES_MAX)
git -C <wt> grep -n -E "^const (FOLIO_RATCHET_MAX|FOLIO_TITLE_RATCHET_MAX|UNRESOLVED_MAX|SANS_CITATION_MAX|PENDING_MAX|UNDOCUMENTED_ENGINE_EXPORTS_MAX|MANUAL_DOCS_MAX|DETTE_ADOPTION_MAX|TUS_MAX) ?=" abedb5fd4 -- src
-> 109 / 0 / 776 / 3294 / 1 / 301 / 8 / 346 / 4
git -C <wt> show ed42c9a81 --format="%b" --no-patch | Select-String "FOLIO_RATCHET|folioRatchet|book-source-integrity"  -> 0
gh issue view 1727 --repo cgauche/game --comments | Select-String "FOLIO_RATCHET|folioRatchet"        -> 0
git -C <wt> show abedb5fd4:scripts/guards/lib/folioRatchetStock.mjs | Select-String "^\s*'" | count   -> 109 entrées 'dataset.json:id'

# S5 (trouvaille 3) — bornage de fermetures-non-citees
git -C <wt> show abedb5fd4:scripts/ops/fermetures-non-citees.mjs | Select-String "depuis|argv|--"
-> 137: `search/issues?q=repo:${DEPOT}+is:issue+closed:>=${depuis}&per_page=100`
-> 160: export function citesDepuis(depuis) { … git(['log', `--since=${reculeDe(depuis, MARGE_CITATION_JOURS)}`…])
-> 177: const iDepuis = args.indexOf('--depuis')
git -C <wt> show abedb5fd4:scripts/ops/fermetures-non-citees.json
-> "mesureLe": "2026-09-04", "fenetre": "2026-08-20", 12 entrées

# S6 (trouvaille 4) — binaire VO 5e
git -C <wt> ls-tree -r --name-only abedb5fd4 "Source/" | Select-String "\.jpg|\.png"
-> Source/WHFRP 5e - [Cubicle 7 Entertainment] - Warhammer Fantasy Roleplay 5e - Endpaper Map [OEF][2026-09-01].jpg
-> Source/salzenmund-4-zones-off.png
git -C <wt> grep -n -i "endpaper" abedb5fd4 -- docs scripts src   -> (aucune sortie)

# S7 (trouvaille 5) — CLAUDE.md
git -C <wt> cat-file -s e27aceebf^:CLAUDE.md   -> 53211
git -C <wt> cat-file -s e27aceebf:CLAUDE.md    -> 9127
git -C <wt> cat-file -s abedb5fd4:CLAUDE.md    -> 9127

# S8 (écartée) — JAMBE_INLINE : dette identique ?
git -C <wt> show abedb5fd4:scripts/guards/lib/jambesGabaritStock.mjs | Select-String "^\s*\{ fichier:" | count   -> 97
git -C <wt> show b87100ea2^:src/gameIso/rig/parts/tenues/jambes-gabarit-ratchet.test.ts (bloc du Set, quotes)    -> 194 quotes = 97 ids
git -C <wt> show b87100ea2^:…/jambes-gabarit-ratchet.test.ts | Select-String "PLAFOND_INLINE ="                  -> 46: const PLAFOND_INLINE = 103;

# S9 (écartée) — chapitres byte-identiques (#1699)
git -C <wt> diff --numstat -M 6ba23c74f^ 6ba23c74f -- "Source/"
-> 376 lignes, dont 336 à "0  0"
-> lignes non nulles filtrées hors "00 - Index.md" : AUCUNE
-> (les non nulles : 4/0 + 0/4 pour la paire A/D de l'index « Boite d'Initiation », puis 39 « 00 - Index.md » à ±1..5)

# S10 (écartée) — stocks raw et span-colle
git -C <wt> show abedb5fd4:scripts/raw/source-format-stock.json | count '"fichier"' / '"famille"'   -> 57 / 57
git -C <wt> show abedb5fd4:scripts/raw/source-tables-stock.json | count '"fichier"'                 -> 664
git -C <wt> grep -c "span-colle" abedb5fd4 -- scripts/raw/source-tables-stock.json                  -> (aucun hit)

# S11 (écartée) — portes git du train de publication
git -C <wt> grep -c "execFileSync" abedb5fd4 -- scripts/ops/publier.mjs   -> (aucun hit, exit 1)
git -C <wt> grep -n "commandeInterdite" abedb5fd4 -- scripts/ops/publier.mjs
-> :20 (bloc INTERDITS gravés) · :298 · :326 export function commandeInterdite(args) · :509 · :528 const interdit = commandeInterdite(args)

# S12 — poison, cross-OS, CI, commits triviaux, régime
git -C <wt> diff 9e15cba42..abedb5fd4 -- src scripts | count '^\+'                                  -> 17307
… | count '^\+.*(en attendant|pour l.instant|provisoire|temporaire|à terme|déplacé vers|autrefois|jusqu.à ce que|exception assumée|TODO|FIXME|legacy|épargné)'  -> 22 (corpus du détecteur ×16, fichierTemporaire ×4, 2 divers)
… | grep '^\+.*(new Date\(|Math\.random|localeCompare|C:\\|/Users/|process\.platform)'               -> 8 (2 npm.cmd, 5 horodatages de journal/date de commit, 1 localeCompare(…, 'en'))
gh run list --repo cgauche/game --branch main --limit 60 --json headSha,conclusion
-> shas de la fenêtre avec course : abedb5fd4 dacc0e575 98257f79e 451c4d6fb 3dc9500a7(CI+Canari) c5eec9370 212a8714b 1b3d794cb d25dc31b0 — TOUS "success"
-> seules "failure" de la liste : 6e76f75d6 et cdb57b518, antérieures à 9e15cba42
git -C <wt> show --format="" --name-only abedb5fd4|75c0196ba|451c4d6fb|dacc0e575|1b3d794cb|a39f6ed25|f89481739 -> uniquement des chemins docs/
git -C <wt> show --format="" --name-only 10980523f -> 8 docs/ + scripts/raw/source-tables-stock.json (déclaré au sujet)
git -C <wt> rev-list --count 9e15cba42..abedb5fd4 --grep=juge --grep=réfut -i -- src scripts          -> 18 (sur 22)
git -C <wt> log --oneline 9e15cba42..abedb5fd4 -- package-lock.json                                  -> (aucune sortie)
git -C <wt> log --oneline 9e15cba42..abedb5fd4 -- scripts/ops/audit-stock.json                       -> (aucune sortie)
gh issue view 1728 --repo cgauche/game --comments
-> OPEN, 1 commentaire : 3 commits, 24 gates chronométrées, « CI verte — course 34847420730 », marque <!-- publier: dacc0e575… -->
gh issue view 1737|1296|1727 --repo cgauche/game --json state -> OPEN / OPEN / OPEN
```
