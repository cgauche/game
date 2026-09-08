---
name: feedback-gates-docs-build-avant-lancement-sinon-25-min-perdues
description: "Vécu 2026-09-06 (#1700, worktree A) : gates --serie lancées AVANT `npm run docs:build` sur l'arbre committé → 21 min de gates vertes puis `docs:empreinte` ROUGE sur deux pieds, run à rejouer ; verbatim user « 25min pour rien, merci » — la règle existait déjà (fiche du 2026-09-05), elle n'a pas été appliquée"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b92c8bcd-85a9-40b8-88ea-216704604df3
  modified: 2026-09-06T21:13:42.229Z
---

**Fait (2026-09-06, session #1700)** : après trois commits de préparation dans `.wt-ab-phanes` (fichiers ajoutés/retirés sous `.phaneslight/` et `scripts/ops/`), j'ai lancé `npm run gates -- --serie` directement. 12 gates vertes en 21 min (suite 484 s, test:hooks 313 s, build 125 s), puis `docs:empreinte` ROUGE : `docs/consommateurs-de-champs.md` et `docs/reprise-apres-pause.md` portaient un pied calculé sur un autre listing. Correctif = `npm run docs:build`, 2 lignes de pied, un commit `chore(docs)`, et un second run de gates.

Verbatim utilisateur : « Ca prends 25min ?! » puis « 25min pour rien, merci ».

**Why :** la règle était DÉJÀ écrite dans [[env-garde-memoire-harnais-gates-serie-detachees]] (« commit → docs:build → commit des pieds → gates → push ») ; une fiche lue n'est pas une fiche appliquée. Tout commit qui ajoute ou retire un FICHIER dans un dossier lu par un générateur (`scripts/`, `.phaneslight/`, `src/`) change un listing, donc un pied d'empreinte.

**How to apply :**
1. Avant TOUT lancement de gates : `npm run docs:build` sur l'arbre committé, `git status` — si des docs bougent, commit `chore(docs)` d'abord. Coût : 2 min. Un run de gates perdu : 20 à 25 min.
2. Les gates à clé PARTIELLE (suite, typecheck, lint, build) ne rejouent pas après un commit docs-only : un rouge de docs coûte donc ~8 min de rejeu, jamais le run entier — mais il coûte quand même.
3. Amélioration à ticketer sur le tronc : en `--serie`, jouer les gates COURTES à clé pleine (`docs:empreinte` 14 s, `docs:check` 113 s) AVANT la suite de 484 s — l'ordre de ci.yml n'est pas un ordre de coût.

Lié : [[env-garde-memoire-harnais-gates-serie-detachees]], [[feedback-train-court-codeur-rend-apres-gates]].
