---
name: git-commits-propres-wip-parallele
description: "Sur Foundry/Game, l'utilisateur développe en parallèle dans le même working tree ; committer uniquement ses propres fichiers via pathspec (recettes : hunks sélectifs, bucketing par fichier, index temporaire+CAS, transform déterministe depuis HEAD), sans sur-investir la chirurgie git (jamais --amend en arbre à forte rotation)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 20c644ef-b525-47b0-9cac-419c04628ba7
  modified: 2026-07-22T07:12:03.921Z
---

Sur le dépôt `Foundry/Game` (branche `feat/wfrp4-rpg-foundation`), l'utilisateur
travaille **en parallèle dans le même working tree** pendant que j'édite : il y a
souvent du WIP non commité à lui (système de magie, engine, `transitionBack`,
regen bestiaire…) dans des fichiers partagés (`scene.ts`, `store.ts`, etc.).

**Mise à jour 2026-06-07 (feedback utilisateur) :** la contrainte est **asymétrique**. (a) Il est **OK que mon travail se retrouve commité par l'autre session** (« pas grave si ton travail se retrouve comité par un autre ») — vu : la session rig a commité `Editor.tsx` en bloc, embarquant mes 2 hunks Météo/Empreinte ; mon code est dans HEAD, c'est très bien. Donc **ne PAS s'acharner** à isoler mes hunks pour l'attribution. (b) L'inverse reste vrai : **NE PAS committer LEUR WIP incomplet/cassé** dans mon commit (ça casse HEAD/CI). Donc l'effort de hunks sélectifs sert à protéger le **build**, pas l'attribution. Note : l'index est **partagé** entre sessions — l'autre session peut reset/stager pendant que je travaille (vu : mon `git apply --cached` annulé entre deux commandes) → stager + committer **atomiquement dans une seule commande**, ne jamais supposer l'index stable entre deux appels.

**Rappel 2026-06-08 (footprint Taille) — NE PAS sur-investir l'isolation quand l'autre session committe en rafale.** Vu : phases 1-3 commitées propres (j'ai gagné la course), mais la **phase 4 a été balayée dans LEUR commit `8788140`** via `git add -A` pendant ma longue danse de patch-isolation (j'ai même dû `reset --soft` un commit qui avait embarqué leur `entityPickables`). Mon code de phase 4 est **intégralement dans HEAD** (vérifié `git show HEAD:src/state/path.ts | grep footFits`), tests verts. → Confirme le point (a) : **le balayage est OK**. Leçon concrète : si l'autre session committe toutes les 1-2 min via `git add -A`, **arrêter la danse de hunks** (elle sera balayée en milieu de route, et `git apply --cached` annulé entre deux commandes) ; soit (i) **éditer puis simplement vérifier que mon code est dans HEAD** après leur prochain sweep, soit (ii) si j'ai *vraiment* besoin d'un commit dédié propre, utiliser d'emblée le **temp-index + commit-tree + update-ref CAS** (méthode 2026-06-08 plus bas) qui ne touche pas l'index partagé — PAS le `git apply --cached` sur l'index partagé. Le gate strict « toute ligne `+` stagée de `<fichier>` doit contenir mon marqueur, sinon ABORT » a bien rattrapé une fuite d'imports Marchand (hunk d'import mixte) → le garder.

**Piège `git commit` SANS pathspec (2026-06-07)** : `git apply --cached <mon hunk>` + `git add <mes fichiers>` + `git commit` (sans pathspec) committe **TOUT l'index**, donc embarque les fichiers que la session rig avait **déjà stagés** (vu : un `BeteDuChaos.ts` rig −9 l. balayé dans mon commit Taille). Heureusement c'était une modif rig **complète** (suite verte) → inoffensif, mais c'est le mauvais sens (committer LEUR WIP). Mitigations : (a) committer avec **pathspec explicite** `git commit -- <mes fichiers>` quand possible (ignore le reste de l'index) ; le hic : un hunk partiel stagé via `git apply --cached` n'est PAS capturé par `git commit -- <fichier>` (qui prend le worktree complet du fichier). Pour un fichier partagé à hunk partiel, accepter le risque ou `git reset` l'index d'abord (mais ça perturbe le rig). (b) Toujours `git show --stat HEAD` après et **vérifier la suite verte** post-commit. **`combat.ts` est devenu rig-hot** (refacto qualités → `engine/qualities/dispatch.ts` : `hasQuality`/`qualitySum`/`parryDRAdjust`/`qualityCritTriggered`) — minimiser mes edits dessus, préférer combatFlow/store.

**Récidive 2026-07-14 (792cd633)** : sous pression d'urgence (l'autre session bloquée sur
mon hook), un `git commit -m` SANS `--` pathspec a embarqué ses 11 fichiers #415 stagés —
alors que le commit PRÉCÉDENT de la même heure avait le pathspec. La discipline ne tient
pas sous urgence : le pathspec `-- <chemins>` va dans le GABARIT de toute commande commit
(l'écrire AVANT le message, jamais « j'ajouterai les chemins après »). Même commit :
annonce « 81/81 » avec 1 test rouge (test:hooks n'est PAS dans le pre-commit — le lancer
soi-même AVANT, coller la sortie réelle). Aveu porté par ffe4dfc3.
**3e RÉCIDIVE 2026-07-22 (2f599164, intégration VDM)** : encore `git add <mes 2 docs>` + `git commit -m`
SANS `--` → a embarqué 14 fichiers #620/#621 stagés par l'autre session (feature delayed-effect, save v13).
User a choisi de LAISSER (travail dans HEAD, non poussé, aucune perte — cohérent avec « ne pas sur-investir la
chirurgie » ci-dessous, d'autant que le `reset --soft` de récupération n'a même pas pris sur l'index vivant).
**4e RÉCIDIVE 2026-07-22 (ca4f0a34, MÊME session que la 3e)** : après avoir POURTANT écrit « désormais atomique »,
un `git add <effect-rule-anchor.test.ts> && git commit` a encore embarqué `src/data/montures.json` (stagé par une
autre session dans l'index partagé). Preuve DÉFINITIVE : « atomique dans un seul appel » ne suffit PAS — `git commit`
nu commite TOUT l'index, pas ce que MON `git add` vient d'ajouter. La seule parade est le **commit PARTIEL par chemin**
`git commit -- <mes chemins> -m …` (ignore le reste de l'index). Laissé (montures.json dans HEAD sous mon message, non poussé, aucune perte).
**4 récidives du MÊME piège = la discipline mémoire ne suffit pas** : le réflexe mécanique est d'écrire
`git commit -- <chemins> -m …` d'un bloc (le pathspec AVANT le message), JAMAIS `git add` puis `git commit` nu.
Un garde pre-commit ne peut pas le rattraper (il ne sait pas « quels fichiers sont à moi ») → c'est un réflexe de frappe, pas un hook. — meilleure que `git stash` quand un fichier partagé (`store.ts`, `combatFlow.ts`) contient À LA FOIS mes hunks ET le WIP non commité du rig (refacto `resolveQualities`, `setItemSkin`, anims de sort) : ne touche JAMAIS le worktree (pas de race avec le rig).
1. Vérifier l'index VIDE : `git diff --cached --stat` (doit être vide).
2. Diff RAW (contourner RTK qui rend `git diff` en résumé non-patchable) : **`rtk proxy git --no-pager diff -- <fichier> > d.patch`**.
3. Filtrer les hunks par contenu en Node (garder ceux qui matchent MES marqueurs ET pas les marqueurs rig), réassembler header + hunks gardés, **`git apply --cached --recount mine.patch`**.
4. **Hunk MIXTE** (mon edit collé au leur, ex. un ajout d'import à côté de leur changement d'import) : le filtre le jette → mon import manque alors que mon code l'utilise = commit cassé. Parade : écrire à la main un mini-patch d'import contre HEAD (récupérer les lignes HEAD via `rtk proxy git --no-pager show HEAD:<fichier>`), créer le `.patch` avec l'outil Write (évite l'enfer du quoting shell pour `'../x'`/accents/emoji), `git apply --cached`.
5. `git add` les fichiers 100 % à moi (nouveaux tests/composants).
6. **Vérifier** le staged : `rtk proxy git --no-pager diff --cached -- <fichier> | grep -c <marqueur-rig>` doit donner 0, et `grep -c <mon-marqueur>` > 0.
7. **`git commit` SANS pathspec** (l'index est précisément contrôlé = mes seuls hunks) — c'est le seul moyen de committer un hunk PARTIEL (un `git commit -- <fichier>` prendrait le worktree complet, embarquant leur WIP). Sûr SI l'étape 1 a confirmé l'index vide au départ.
8. `git show --stat HEAD` post-commit. Le worktree garde leur WIP non stagé intact.

**Why :** un `git add <mes fichiers>` puis `git commit` committe **tout l'index**,
pas seulement ce que j'ai ajouté — donc le WIP déjà staged par l'utilisateur se
retrouve embarqué dans mon commit (vu 2× cette session : un commit a balayé
`magic.ts` + 15 fichiers engine).

**How to apply :**
- Committer **uniquement mes fichiers via pathspec** : `git commit -- <chemins exacts> -m "…"` (committe la version working-tree de ces chemins, ignore le reste de l'index).
- **Règle la plus sûre (validée 2026-06-06, rotation caméra) : un fichier que l'utilisateur édite AUSSI, je ne le committe PAS du tout.** `git commit -- <fichier>` committe la version *worktree complète* du fichier → embarque son WIP même via pathspec (vu : `git add IsoStage.tsx` a balayé son intégration quadrupèdes ; le commit référençait des fichiers non suivis → HEAD cassé). Pour les composants React partagés (`IsoStage.tsx`, `Editor.tsx`, `RigToken.tsx`), j'**édite dans le worktree mais laisse non commité** ; je commit la **part pure** dans des fichiers à moi seul (`iso.ts`, `facing.ts`, `buildings.ts`, `store.ts`) et je **rends `dims`/params optionnels** pour découpler ma logique committée des sites d'appel partagés (HEAD reste compilable sans toucher leurs fichiers). Lister clairement à l'utilisateur les fichiers laissés non commités.
- Récupération si j'ai déjà embarqué son WIP : `git reset <commit-avant-mes-commits>` (mixed, **jamais `--hard`**) → worktree intact, tout revient non commité ; puis recommit fichier par fichier mes seuls fichiers propriétaires.
- Pour un fichier partagé qui contient *à la fois* mon edit et son WIP (ex. `scene.ts`) : `git stash push -- <fichier>` **avant** d'éditer, faire mon changement isolé, committer, puis `git stash pop` pour lui rendre son WIP.
- Toujours `git show --stat HEAD` après commit pour vérifier qu'aucun fichier étranger n'a été embarqué.
- **Vérifier l'index avec `git status --porcelain=v1 -- <chemins>` (colonnes XY), PAS `git diff --cached --name-only | wc -l`** : la couche de compression shell (lean-ctx/RTK) tronque la sortie `--name-only` piped → faux comptes (vu : « 3 fichiers » au lieu de 9 stagés). Le porcelain non-piped passe intact.
- `rg` n'est pas sur le PATH ici → l'outil Grep peut échouer ; fallback `git grep` / lecture directe.
- **Déployer (`deploy.mjs` = `vite build`) lit le working tree, pas Git** : si l'autre session a du WIP non commité (ex. refonte ch.2 `tome1-route.ts`), un deploy embarque son WIP. `git push` (commits seuls) est sûr ; tenir le deploy jusqu'à ce que son travail soit commité.
- **Confirmer les tests AU VERT avant deploy** : RTK compresse la sortie de `npm test` et MASQUE la ligne pass/fail → toujours `npm test 2>&1 | grep -E "Tests "` pour voir `N passed`. `deploy.mjs` ne lance que `tsc -b && vite build` (pas les tests) → un test rouge NE bloque PAS le deploy. Vu : déploiement avec 1 test rouge (assertion périmée, runtime OK, mais mauvaise hygiène).
- `tsc --noEmit` peut renvoyer un cache incrémental périmé (`.tsbuildinfo`) → une erreur peut n'apparaître qu'au 2e passage ; revérifier avant de conclure « clean ».

**Ne pas sur-investir la chirurgie git** (« Vous passez plus de temps à créer vos commits parfaits qu'à
développer ») : les scripts d'isolation de hunks faits-main (node + `git apply --cached` + strict gate,
ré-exécutés à chaque commit) coûtent souvent plus qu'ils ne rapportent. Fichiers NOUVEAUX (à moi) →
`git add` + commit simple, point. Fichiers CHAUDS partagés → soit pathspec direct en assumant un éventuel
embarquement parallèle, soit laisser l'autre session les committer (mon code atterrit en HEAD quand même) ;
vérifier juste que mon code est en HEAD, pas re-séparer. Committer moins souvent / par lots à des coutures
naturelles, pas après chaque micro-edit. Pas de script d'isolation node sauf fuite vraiment grave (secret,
gros refacto) — une vérif PowerShell rapide suffit si besoin.

**Contre-exemple vécu (chirurgie qui a mal tourné)** : deux fois, une reconstruction manuelle (index isolé
+ reconstruction depuis HEAD + `--amend`) a **reverté du travail de sessions parallèles** et coûté ~20
allers-retours — parce que 4 sessions committent dans le même working tree/`.git` toutes les quelques
minutes : HEAD bouge sous moi, un `git show HEAD` au temps T puis un commit au temps T+n se base sur un
HEAD périmé → reconstruire depuis ce HEAD revert ce qu'une session a committé entre-temps ; `--amend` a
même réécrit le commit d'une AUTRE session (le tip avait bougé). **JAMAIS `--amend`** dans un arbre à forte
rotation. Dans ce cas, committer simplement (`git add <mes fichiers> && git commit`, quitte à embarquer des
hunks voisins) plutôt que retenter une reconstruction fragile ; vérifier le TREE de HEAD (contenu + tests),
pas la propreté des diffs intermédiaires.

**Bucketing par fichier avant de curer un hunk (vérifié 2026-06-29, siège vs gamepad/monture, commits
14a621c1+ab6e6069)** : quand mon WIP est physiquement entrelacé avec le WIP non-commité d'AUTRES sessions
dans les mêmes fichiers partagés (`combatSlice`/`combatFlow`/`store`/`IsoStage`) et que ces sessions ne
commitent pas, classer chaque fichier changé (script Python, par-hunk + mots-clés de feature) en
PURE-MOI / PURE-ÉTRANGER / MIXTE (buckets auto + drapeau « UNBUCKETED » = zéro oubli). PURE-MOI →
`git add` direct. MIXTE → patch curé (garder mes hunks, neutraliser une ligne mixte en la reconvertissant
en contexte, jeter le `+` étranger), appliqué à l'INDEX (`git apply --recount --cached`, `--check` d'abord).
**Deux gardes avant de committer un fichier curé** : (1) bornes d'import — tout symbole importé par mon
code doit résoudre à HEAD (barrel `export *`) ou être défini dans un fichier à moi (`git show HEAD:f | grep
export`), sinon le commit ne compile pas isolément ; (2) anti-`noUnusedLocals` — chaque symbole importé
dans un fichier curé doit apparaître ≥2× dans `git show :f` (import + usage réel) sinon c'est soit une
définition exportée/un champ d'interface (faux positif), soit un **import mort** (l'usage est tombé dans un
hunk droppé → erreur tsc). Preuve de compilation sans worktree isolé : `git diff --cached | grep '^+' |
grep <symboles étrangers>` doit être VIDE.

**Variante — arbre ACTIVEMENT co-édité en continu + mon hunk = transform déterministe** (vérifié
2026-07-05, commits 2d60774e/11419417, migration i18n `subType`/`type` de Qualité) : quand l'autre session
ÉCRIT en continu le fichier partagé (l'outil Edit échoue « modified since read » ; un `git apply` contre
l'arbre volatil est racy) ET que mon changement est une transform pure (remplacement de chaîne label→id),
NE PAS extraire le hunk de l'arbre — le **reconstruire depuis HEAD** dans un index temporaire ISOLÉ :
```
export GIT_INDEX_FILE="$(git rev-parse --git-dir)/tmp-idx"   # jetable, JAMAIS l'index partagé
git read-tree HEAD
git add -- <mes fichiers SOLO>
blob=$(git show HEAD:<co-édité> | sed "s/=== 'Label'/=== 'id'/g" | git hash-object -w --stdin)
git update-index --cacheinfo 100644,$blob,<co-édité>          # = HEAD + MA transform seule
git diff --cached HEAD | grep -c <symboles voisins>           # GARDE : doit être 0
git commit -F -
unset GIT_INDEX_FILE; rm -f .git/tmp-idx
git reset -q HEAD                                             # resync l'index réel
```
Avantages vs `git apply --cached` : immunisé à la volatilité de l'arbre (source = HEAD, pas le buffer qui
bouge), l'index partagé n'est jamais touché pendant le build, et le `grep -c` prouve zéro symbole voisin
embarqué. Piège : après ce commit, `git status` montre mes fichiers en `MM`/`D` (artefact, l'index réel est
resté à l'ancien HEAD) → `git reset -q HEAD` resynchronise. Il FAUT quand même appliquer ma transform à
l'ARBRE co-édité (sinon leur prochain commit du fichier REVERTERAIT mon hunk) — vérif verte en isolation :
suite `--exclude` le test cassé de leur WIP actif.

**Méthode la plus robuste (2026-06-08, décor interactif) — INDEX TEMPORAIRE + CAS, quand l'index partagé est activement churné ET HEAD bouge sous moi (l'autre session a committé 3×+ pendant ma session, a même *balayé* mon `store.ts`/`ActionBar.tsx` dans SES commits).** Le `git commit` SANS pathspec (recette step 7) suppose « index vide au départ » — INVALIDE si l'autre session stage en continu. Et `git commit` résout le parent à l'instant du commit → si HEAD bouge entre mon `read-tree` et le commit, il *réverte* leurs commits (l'arbre committé est un snapshot complet basé sur l'ancien HEAD). Solution qui ne touche NI l'index partagé NI le worktree :
  1. `$H = git rev-parse HEAD`. Filtrer mes hunks → `mine.patch` (Python qui lance `git --no-pager diff $H -- <fichiers>` lui-même, split sur `^diff --git`/`^@@ `, garde/jette par marqueur, écrit en LF strict).
  2. Index DÉDIÉ (jamais l'index partagé) : `$env:GIT_INDEX_FILE = "$env:TEMP\idx"; git read-tree $H`.
  3. `git apply --cached --recount mine.patch` (vérifier `--check` d'abord).
  4. `$T = git write-tree` ; `Remove-Item env:GIT_INDEX_FILE` ; `$C = git commit-tree $T -p $H -F msg.txt`.
  5. **CAS** : `git update-ref refs/heads/<branche> $C $H` — n'avance la branche QUE si elle pointe ENCORE sur $H ; si l'autre session a committé entre-temps, échoue → re-tenter depuis $H. C'est ce qui évite d'écraser/réverter leur commit concurrent.
  6. Worktree + index partagé INTACTS ; `git status` ne montre plus que LEUR WIP non commité. `git push` (fast-forward) après suite verte.
- **Pièges de génération du patch** : (a) `git -c core.autocrlf=false diff` fait apparaître TOUT le fichier comme changé (CRLF worktree vs LF blob) → 5000+ lignes embarquant leur code ; **laisser autocrlf actif** (git normalise, le patch sort en LF). (b) PowerShell `... | python | Set-Content -NoNewline` **joint toutes les lignes** (perd les `\n`) → `git apply` dit « No valid patches » ; faire écrire le fichier *par Python* (`open(out,'w',newline='\n')`), pas par le pipe PowerShell.
- **Outil PowerShell = git brut instantané** : le hook RTK sur l'outil Bash rend `git status/diff` lent (auto-backgrounded) et compressé ; l'outil **PowerShell n'a pas ce hook** → `git status --porcelain`/`git diff` y sont instantanés et fidèles. Préférer PowerShell pour toute inspection/commit git en contexte multi-session.
