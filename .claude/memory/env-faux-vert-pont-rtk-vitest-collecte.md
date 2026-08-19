---
name: env-faux-vert-pont-rtk-vitest-collecte
description: "Le pont RTK peut afficher un FAUX VERT : « EXIT = 0 » sur un vitest rendu 1 (erreur de collecte, 2026-08-09) ET « TypeScript: No errors found » sur un tsc à 4 erreurs EXIT=2 (2026-08-19, reproduit 2×) — seul spawnSync.status écrit HORS PIPE fait foi, pour vitest COMME pour tsc"
metadata:
  type: reference
---

Mesuré 2026-08-09 (chantier #1153, arbre partagé). Un run `vitest run src/engine src/state` a rendu
**`spawnSync.status = 1`** avec **1 fichier en échec et ZÉRO assertion en échec** — une erreur de
**collecte**, pas un test rouge. Au même moment, la sortie affichée par le pont RTK annonçait
« EXIT = 0 ». Le codeur n'a vu le rouge qu'en écrivant `spawnSync.status` dans un fichier hors pipe.

Cause probable de l'erreur de collecte : sur arbre partagé, le nombre de fichiers de test bougeait
pendant le run (763 → 764 → 765 — un autre agent écrivait). Les runs identiques encadrant celui-ci
étaient verts.

**Extension mesurée 2026-08-19 (lot arbitrages #1346, codeur)** : `npx tsc --noEmit` via l'outil
Bash (pont RTK) a rendu « TypeScript: No errors found » **deux fois de suite** alors que le même
tsc mesuré par `spawnSync` sortait **EXIT=2 avec 4 erreurs** (dont 2 vraies régressions dans des
tests). Le faux vert n'est donc PAS spécifique à vitest ni aux erreurs de collecte : il frappe
aussi tsc en régime nominal. Tout gate (tsc, vitest, lint) exigé d'un agent passe par spawnSync.

**Why:** c'est une famille distincte de [[env-exit-code-avale-par-l-outillage-shell]] (là, le pipe
mange le code ; ici, le pont AFFICHE un code faux). Un « vert » de gate lu à l'écran peut donc être
un rouge — et un lot se ferait committer sur cette foi.

**How to apply:**
1. La mesure de gate qui compte est **`spawnSync(...).status` écrit hors pipe** (fichier ou variable
   relue), jamais la ligne « EXIT »/« PASS » rendue par le pont. Exiger ça des agents dans le brief.
2. Un `status = 1` avec **0 assertion en échec** = erreur de COLLECTE : ne pas chasser un test
   fantôme. Vérifier d'abord si l'arbre a bougé pendant le run (compte de fichiers de test qui
   varie entre deux runs = un autre agent écrit).
3. Corollaire pour l'arbre partagé : **la mesure finale d'un lot se refait sur arbre gelé au commit**
   (cf. [[feedback-attribution-rouge-suite-sonde-arbre-committe]] et
   [[feedback-recette-navigateur-arbre-gele]]) — un gate vert mesuré pendant qu'un autre agent écrit
   ne prouve rien, dans les deux sens.
