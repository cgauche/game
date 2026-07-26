---
name: game-atlas-reanchor-epreuve
description: "Épreuve de l'Atlas RAW — refs dérivées post-Marker, garde reanchor.mjs, refs synthèse encore à risque"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5bf69c7c-47c1-4504-aa51-629b7fa83e34
---

Épreuve de l'Atlas RAW (2026-06-22, `docs/raw/epreuve-2026-06-22.md`). La ré-extraction **Marker** du
2026-06-22 a fait **dériver tous les n° de ligne** des réfs `LDB NN l.X` (l'Atlas était bâti contre l'OCR
pré-Marker) — dérive NON uniforme (−1 à −58 lignes, parfois décalage de **chapitre** : `LDB 08`↔`07`).

**Livré** : `scripts/raw/reanchor.mjs` (garde rejouable) relocalise chaque **citation verbatim** « … » par
plus-long-préfixe exact dans la Source courante → vérifie/répare la ligne (`--apply`). **319 réfs verbatim
re-ancrées** (avant : ~86 % fausses). + `scripts/raw/_lib.mjs` = source unique des helpers (BOOKS,
chapterFile, regex réfs, span, normalize) ; `coverage.mjs`/`reconcile.mjs` re-câblés dessus (sortie identique).

**Verdict** : la PROSE de l'Atlas est un bon point d'entrée (~24/26 questions RAW PASS sur combat/tests/
états/destin). 5 **fabrications** de contenu trouvées+corrigées (ligne Elfe inventée → réel 0/0/2 ; citation
« localisation » fabriquée ; note « artefact PDF » Empêtré périmée ; opposition-CC sur-affirmée ; exemple
difficulté -10→-20). **Discipline** : toujours relire la Source avant de corriger (2 faux-positifs d'agents écartés).

**Dette n°1 TRAITÉE** (2026-06-22, suite) : les réfs de SYNTHÈSE (sans citation à ancrer) ré-ancrées par
**diff de contenu** — l'ancienne Source (du build) survit dans **`git HEAD`**, alignée sur la Marker de
l'arbre. `reanchor --remap` (ancres = lignes uniques communes + LIS + interpolation, saute les fichiers
méta index/sources/épreuve) → **2176 synthèses déplacées**, carte validée exacte (34→31, 142→133). Migration
**ONE-SHOT** : relancer `reanchor --apply --remap` après chaque ré-extraction AVANT de committer la Source
(ensuite HEAD==arbre → identité). Restent à la main : 41 ❌ verbatim + 113 ⛔ synthèses (chapitres décalés/peu ancrés).

**Signal de recalage du CODE** (consigne user : `src/` va beaucoup évoluer) : le Sens A de `reconcile.mjs`
mesure les chapitres cités par le code et absents de l'Atlas — c'est là que se lit un code resté sur
l'ancienne échelle, pas un bug de l'Atlas. Il vaut **0 trou dur côté LDB** (`docs/raw/reconciliation.md`,
§A1 « Aucun. Tout chapitre LDB référencé dans le code est cité par au moins une fiche. ») ; ce qui reste
tombe en §A2 (chapitre couvert, ligne non pinée, tolérance ±20).

**À savoir** : `docs/raw/` ET `scripts/raw/` sont **suivis par git** (34 + 44 fichiers) et gatés en CI comme
au pre-commit par `npm run docs:check` (`build-implemente.mjs --check`, `check-atlas-counts.mjs`) — un commit
qui ajoute ou déplace des réfs RAW régénère et committe les fiches dans le MÊME geste. Étend [[game-atlas-raw-doc]].
