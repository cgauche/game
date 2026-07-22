---
name: game-pre-commit-raw-gate-collision-arbre-partage
description: "Le pre-commit lance TOUT le gate raw (raw:implemente --check + test:raw) dès qu'un diff touche docs/raw ou scripts/raw — une dette raw pré-existante d'une autre session bloque alors ton 1er commit raw"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7589f79f-ac8f-465b-a31d-eaa189991f04
  modified: 2026-07-22T04:59:56.976Z
---

`scripts/git-hooks/pre-commit` (→ `pre-commit.mjs`) est **diff-scopé** : un commit qui NE touche
PAS `docs/raw`/`scripts/raw`/`src/data/books.json` passe SANS lancer `raw:implemente --check` ni
`npm run test:raw`. Conséquence sur l'[[game-migration-transverse-en-vol-bloque-le-commit|arbre partagé]] :
une session parallèle peut committer du code (UI/state) qui **dérive** les champs `Implémente`
(GÉNÉRÉS) des fiches ou introduit une citation `ch.` cosmétique — SANS que son gate ne le voie. La
dette reste, invisible, jusqu'à ce que TON commit (qui touche un fichier raw) déclenche le gate COMPLET
et se fasse refuser pour une dette **qui n'est pas la tienne**.

**Why:** vécu 2026-07-22 (enregistrement VDM). Le pre-commit a refusé mon commit pour `raw:implemente`
périmé (4 fiches, réordonnancement de symboles) + `test:raw` #174 (graphy `chDot` : 4 `LDB ch.60` dans
des fichiers creator/qualities) — tout ça du code committé par la session #620, exposé par mon 1er
commit raw.

**How to apply:**
1. Ne PAS attribuer la rougeur à ton travail. Diagnostiquer : `git status` (les 4 fiches sont-elles en
   WIP ? non → dérive de code committé), et **preuve par le regex** (ajouter un livre à l'alternation
   BOOKS ne peut que faire matcher PLUS de chaînes → une rougeur graphy sur des fichiers sans ce livre
   est pré-existante).
2. Vérifier que régénérer ne CAPTURE PAS le WIP d'autrui : `grep` les refs RAW dans leurs fichiers `M`
   non committés — s'ils n'en ont pas, régénérer reflète le code committé (sûr).
3. Débloquer proprement en **un commit `chore(raw)` séparé** (resync `npm run raw:implemente` + normalise
   `ABBR ch.NN`→`ABBR NN`, cf. [[game-refs-raw-convention-prefixe-fichier]]), PUIS ton commit par-dessus.
   Ne jamais re-cliqueter une baseline pour masquer ce qui doit être normalisé.
4. `BOOKS` dérive de `src/data/books.json` (entrées avec `dir`) + `BOOK_ORDER` de `_lib.mjs` (#585) —
   les deux DOIVENT rester synchro (`build-implemente` lève sinon). Éditer books.json = round-trip
   octet-fidèle exigé (`serialize.test.ts`).
