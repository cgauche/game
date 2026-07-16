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

**Code intouché** (consigne user : `src/` va beaucoup évoluer) → l'Atlas est sur l'échelle Marker, le code
sur l'ancienne : `reconcile.mjs` passe Sens A **0→2** (`LDB 05`, `LDB 12`, dérive >±20) — signal honnête de
où recaler le code plus tard, pas un bug.

**À savoir** : `docs/raw/` ET `scripts/raw/` sont **non suivis par git** (jamais committés). Étend [[game-atlas-raw-doc]].
