---
name: game-train-chirurgical-portes-sur-l-index
description: "Train chirurgical (staging par pathspec/hunks) : les portes de vérité se jouent sur l'INDEX (checkout-index), jamais sur l'arbre — 3 demi-trains en 2 jours par classement PAR NOM + tsc-sur-arbre"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 39a8970a-cba9-474a-be43-12bdf0b366e7
  modified: 2026-09-10T17:34:52.674Z
---

Vécu 2026-08-31→09-01, TROIS occurrences de la même classe en 2 jours (épic #1463) :
1. #1552 : 10 fixtures `type:'scene'` oubliées au staging → CI rouge TS2741 (complément 0b84a5aa8).
2. #1552 : doc CI re-addé version ARBRE après un refus de hook qui avait désempilé (507e329a8).
3. #1553 : les 2 `.d.mts` (déclarations des libs .mjs du lot) classés « WIP voisin » PAR NOM →
   demi-train c21f2bf3d, CI rouge (loadCategoryBooks/ENTITY_ORPHAN_FAMILIES absents), attrapé par
   la session voisine au run 33461938126, complément f7c53474a.

**Pourquoi :** sur un arbre PARTAGÉ churné, le commit est un SOUS-ENSEMBLE de l'arbre. `npm run
typecheck` vert avant commit prouve l'ARBRE (qui porte encore les fichiers oubliés), jamais le
COMMIT. Et un fichier `M` ne se classe JAMAIS par son nom/dossier (« scripts/guards = la voisine ») :
un `.d.mts` adjacent à MES .mjs était à moi. Deux biais qui se composent : le tsc-sur-arbre masque
exactement ce que le classement-par-nom exclut.

**Comment appliquer :**
- Tout fichier `M` se classe par `git diff` LU (le contenu dit son train), jamais par nom — et un
  lot qui touche un `.mjs` typé embarque son `.d.mts`, comme un bump de schéma emporte ses tests.
- Avant un commit chirurgical à risque (test .ts + libs, schéma + fixtures) : porte de vérité sur
  l'INDEX — `git checkout-index --prefix` vers un temp (+ `git init` jetable, cf. le piège
  rev-parse qui remonte à l'arbre) et y rejouer tsc/le test concerné. À défaut, sonde minimale :
  `git diff --name-only` de l'arbre ∩ imports du lot = vide.
- Lien : [[feedback-attribution-rouge-suite-sonde-arbre-committe]] (l'attribution d'un rouge exige
  l'état committé — même racine : l'arbre ment dans les deux sens),
  [[game-stage-chirurgical-hunk-arbre-partage]].

**4e occurrence (2026-09-01, C1 #1457, e89a836d3) — classe VOISINE, pas un oubli de staging :** le lot a
posé le PREMIER `alsoIn` de `species.json` = une nouvelle SIGNATURE D'ENVELOPPE pour ce dataset ; la
famille structures (`structures-contrat`, `no-json-fields`, liste de champs `AlsoInField` de CodexEdit)
exigeait une ligne de stock L1d + `'races'` au picker. Mon juge (lentille RAW/données) et mes gates
(vitest de DOMAINE) ne couvraient pas cette famille → HEAD rouge pour tous pendant mon redémarrage,
soldé par la voisine (d53d75b15). **Règle :** un champ NEUF sur un dataset (même une valeur juste) est
un changement de FORME → jouer la famille structures avant commit, ou la suite COMPLÈTE (c'est
précisément ce qu'elle attrape et que les sous-ensembles « de domaine » ne voient jamais).

**5e occurrence (2026-09-01, B3 #1457, 687863ec6) — même classe FORME/COMPTE :** un dédoublonnage de
`skills[]` (riverain-respecte 27→26) sans rafraîchir le stock de COMPTE `slotsStock.mjs` (5982→5981) —
CI rouge attrapée par la voisine, corrigée dans SON train. Mes gates = 5 suites de domaine ciblées, pas
`slots-contrat`. **La règle n'est pas « jouer la bonne famille » (je ne la devine jamais toute) : c'est
la SUITE COMPLÈTE avant push d'un train de données, sérialisée s'il le faut** — les sous-ensembles sont
une porte de codeur, pas une porte de commit.

**6e occurrence (2026-09-08, #1709 fermeture de #996) — le hook de solde juge l'INDEX AVANT la commande :** `git add <revue> && git commit …` dans UNE commande → refus « revue non stagée » (le PreToolUse évalue l'index tel qu'il est au moment de l'appel, l'`add` n'a pas encore couru). Règle : stager dans une commande, committer dans la suivante ; le message par `-F <chemin LITTÉRAL>` (une variable `$M` rend le fichier « illisible » pour la porte, fail-closed). Corollaire vécu 2026-09-09 (C3c-1) : un fichier RENOMMÉ sous ~60 % de similarité est une NAISSANCE pour le détecteur de plage (`stocks-nominatifs`, gate `test:hooks`) alors que le pre-commit, qui suit le renommage, compte 0 → `CLIQUET: <fichier> +N` au compte de la PLAGE, sinon un run de gates perdu.

**7e occurrence (2026-09-11, #925) — une revue de palier STAGÉE sur une branche en retard bloque TOUT git de l'arbre :** la revue jugeait `origin/main` (3310f2cae) et la branche du worktree était encore à ff93f0a39 → le hook refuse le commit (« sa tête de fenêtre n'est pas dans l'histoire de HEAD »), puis refuse aussi `git merge --ff-only` et même `git restore --staged <revue>` (il juge l'index AVANT chaque commande git de cet arbre). Issue : un script node hors hook (`ff-sous-index.mjs` : `restore --staged` → `merge --ff-only origin/main` → `add`), puis le commit par la voie hookée. Règle : FF la branche du worktree sur `origin/main` AVANT de stager une revue de palier. Même jour : `git -C "$W" …` avec une variable de shell → « ascendance indisponible : spawnSync git ENOENT » (la porte ne développe pas `$W`) — chemins LITTÉRAUX dans toute commande git, comme pour `-F`. Le renommage < 60 % du corollaire ci-dessus est RÉFUTÉ comme cause du « CLIQUET au compte de la plage » (juge D3 : les deux portes comptent un renommage pur `+N`, #1720) ; la vraie cause du précédent C3c-1 reste non mesurée.
