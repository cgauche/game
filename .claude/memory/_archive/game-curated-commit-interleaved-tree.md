---
name: game-curated-commit-interleaved-tree
description: Commiter UNE feature depuis un arbre partagé entrelacé (3 features) sans toucher au WIP des autres
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c3f59f27-07d7-490b-8e12-1a5db6c863e7
---

Quand mon WIP (ex. siège) est **physiquement entrelacé** dans des fichiers partagés
(combatSlice/combatFlow/store/IsoStage) avec le WIP non-commité d'autres sessions
(gamepad/monture) et que celles-ci ne commitent pas, on n'est PAS bloqué : on commite
**siège-only** sans jamais toucher leur arbre.

**Why:** les memos voisins ([[feedback-jamais-git-surgery-arbre-partage-actif]],
[[feedback-no-commit-surgery-shared-tree]], [[git-commits-propres-wip-parallele]])
disent « n'écrase pas leur WIP / pas de --amend » — mais `git add -- <chemins>` ne
suffit pas quand siège+étranger cohabitent DANS un même fichier. La solution est de
stager une version **siège-only** dans l'INDEX en laissant l'arbre de travail intact.

**How to apply (recette vérifiée 2026-06-29, commits 14a621c1+ab6e6069) :**
1. **Classer chaque fichier changé** (script python : par-hunk, mots-clés feature) en
   PURE-SIÉGE / PURE-ÉTRANGER / MIXTE. Buckets auto + drapeau « UNBUCKETED » → zéro oubli.
2. **Vérifier les bornes d'import** : tout symbole que le siège importe doit résoudre
   à HEAD (barrels `export *`) ou être défini dans un fichier siège. `git show HEAD:f |
   grep export`. Sinon le commit siège-only ne compile pas.
3. **PURE-SIÉGE** → `git add <chemins>`.
4. **MIXTE** → patch **curé** (garder les hunks siège, neutraliser une ligne mixte =
   convertir le `-` HEAD en contexte ` `, jeter le `+`), appliqué à l'INDEX :
   `git apply --recount --cached patch` (— `--recount` recompte les `@@`, `--cached`
   = index seul, **arbre intouché**). `--check` d'abord.
5. **Garde anti-`noUnusedLocals`** : chaque symbole importé dans un fichier curé doit
   apparaître ≥2× dans `git show :f` (import + usage). count==1 = soit def exportée,
   soit champ d'interface (faux positif), soit **import mort** (un usage tombé dans un
   hunk droppé → erreur tsc).
6. **Preuve de compilation sans worktree** (l'user interdit worktree/stash sur arbre
   actif) : `git diff --cached | grep '^+' | grep <symboles étrangers>` doit être VIDE
   → siège-only auto-suffisant ⇒ compile (l'arbre superset compile déjà, l'étranger est
   additif et jamais référencé). Pas besoin de tsc isolé.
7. Commit `-F`. Après : `git show HEAD:f` contient le siège, PAS l'étranger ;
   `git diff HEAD` = étranger préservé. Leur `git add -A` ultérieur capture pile leur WIP.

**Variante — arbre ACTIVEMENT co-édité + mon hunk = transform déterministe (vérifié 2026-07-05,
commits 2d60774e/11419417, migration i18n `subType`/`type` de Qualité) :** quand l'autre session
ÉCRIT en continu le fichier partagé (l'outil Edit échoue « modified since read » ; `git apply` contre
l'arbre volatil est racy) ET que mon changement est une transform pure (remplacement de chaîne
label→id), NE PAS extraire le hunk de l'arbre — le **reconstruire depuis HEAD** dans un **index
temporaire ISOLÉ** :
```
export GIT_INDEX_FILE="$(git rev-parse --git-dir)/tmp-idx"   # index jetable, JAMAIS l'index partagé
git read-tree HEAD
git add -- <mes fichiers SOLO>                                # contenu arbre = pur (audité au préalable)
blob=$(git show HEAD:<co-édité> | sed "s/=== 'Label'/=== 'id'/g" | git hash-object -w --stdin)
git update-index --cacheinfo 100644,$blob,<co-édité>          # = HEAD + MA transform seule, 0 WIP voisin
git diff --cached HEAD | grep -c <symboles voisins>           # GARDE : doit être 0 (rien d'embarqué)
git commit -F -                                               # commit l'index temp → HEAD avance
unset GIT_INDEX_FILE; rm -f .git/tmp-idx
git reset -q HEAD                                             # resync l'index RÉEL (sinon MM/D vs HEAD)
```
Avantages vs `git apply --cached` : (a) immunisé à la volatilité de l'arbre (source = HEAD, pas le
buffer qui bouge) ; (b) l'index partagé n'est jamais touché pendant le build ; (c) garde `grep -c`
prouve zéro symbole voisin embarqué. **Piège** : après commit via index temp, HEAD a avancé mais
l'index RÉEL = ancien HEAD → `git status` montre mes fichiers en `MM`/`D` (artefact) → `git reset -q
HEAD` les resynchronise. **Il FAUT quand même appliquer ma transform à l'ARBRE co-édité** (PowerShell
atomique gardé : sentinel du WIP voisin présent avant/après) sinon leur prochain commit du fichier
REVERTERAIT mon hunk (leur arbre n'a pas mon changement). Vérif verte en isolation : suite `--exclude`
le `*.test.ts` cassé de leur WIP actif.

Lié à [[feedback-decisiveness-routine-git]] : ne pas boucler « attends qu'ils commitent » —
investiguer la séparabilité réelle (hunks distincts vs vraiment mixtes) et livrer.
