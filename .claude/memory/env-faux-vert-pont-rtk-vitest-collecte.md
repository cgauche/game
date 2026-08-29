---
name: env-faux-vert-pont-rtk-vitest-collecte
description: "Le pont RTK peut afficher un FAUX VERT : « EXIT = 0 » sur un vitest rendu 1 (erreur de collecte, 2026-08-09) ET « TypeScript: No errors found » sur un tsc à 4 erreurs EXIT=2 (2026-08-19, reproduit 2×) — seul spawnSync.status écrit HORS PIPE fait foi, pour vitest COMME pour tsc"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 581b89eb-a389-4f97-87c2-713104a0fbca
  modified: 2026-08-26T07:32:38.026Z
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

**Extension mesurée 2026-08-24 (#1466 T3-b, sonde gen-registry)** : le pont pipé peut afficher une
LIGNE DE CONTENU non concordante avec l'état disque — `npm run gen | tail -1` a rendu « [inchangé] »
à la seconde même où mtime + contenu du `_ids.generated.ts` prouvaient l'écriture (générateur
byte-exact vérifié :612-616, hors de cause). Le mensonge frappe donc aussi les lignes de LOG, pas
seulement les codes de sortie. Cause jumelle côté observateur, à éliminer d'abord : le plugin Vite
`registryGen` (`vite.config.ts:9-20`) régénère EN SILENCE au buildStart de tout vitest/vite dev —
un « [inchangé] » juste APRÈS un test peut être vrai (fichier déjà écrit) pendant que le diff vs
HEAD montre du neuf.

**Extension mesurée 2026-08-26 (juge de diff Lot P #1466)** : le pont frappe aussi les RECHERCHES —
`grep -n "escapeStrength\|Tenue indisciplin" src/data/miscast.json` via Bash a rendu « 0 matches »
alors que le fichier porte 6 occurrences (vérifié par ctx_search puis lecture directe :194-211).
Un FAUX NÉGATIF de grep fonde silencieusement une conclusion « n'existe pas » — toute affirmation
d'ABSENCE issue du pont se recoupe par un outil d'une autre famille (ctx_search, lecture directe).

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

## Extension 2026-08-28 (juge V-UNION #1467) — le pont ment AUSSI sur tsc et grep -c
Le pont Bash/RTK a rendu « TypeScript: No errors found » avec EXIT=1 sur un tsc qui émettait 2 erreurs (visibles en ctx_shell raw=true : [exit:2]). Et `git status --porcelain | grep -c` a rendu « 5 » sur un arbre où ctx_glob mesure 0 fichier. TOUT verdict tsc/comptage lu à travers le pont est NUL — code de sortie SANS pipe (redirection fichier + $?) ou spawnSync obligatoires.
