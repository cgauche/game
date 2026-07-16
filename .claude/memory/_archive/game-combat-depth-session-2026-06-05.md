---
name: game-combat-depth-session-2026-06-05
description: État du chantier « profondeur combat » (Jalon 1) au 2026-06-05 — un plan écrit reste à exécuter
metadata: 
  node_type: memory
  type: project
  originSessionId: ea0c9f98-e8c2-42bc-8aa3-45c13c76f4d5
---

Grosse session « compléter le combat » (Jalon 1) sur `feat/wfrp4-rpg-foundation`, ~30 commits (probablement **non poussés** sur origin — à vérifier au réveil).

**Livré & committé** (specs/plans sous `docs/superpowers/`, tout vert : `npm test`/typecheck/build) :
- Chance : relance corrigée (1×/Test sur d100 propre raté), **+1 DR** cumulable, **Détermination** (retirer un État), **3ᵉ usage** (pré-emption d'initiative `RoundStartModal`).
- **Ramasser** un objet au sol (un à la fois, réutilise `objet`/`search`).
- **Blessures critiques & mort** (LDB 18-Traumatisme) : 0 PB ≠ mort, tables par localisation, overkill/double, Mort Subite figurants ; `isOutOfAction` corrigé.
- **Destin/Résilience sacrifiés** : `pendingFateSave` (coup létal + mort lente), « Je ne faillirai pas ! ».

**À EXÉCUTER prochaine session** : `docs/superpowers/plans/2026-06-05-rechargement-munitions.md` (spec `…-rechargement-munitions-design.md`) — **écrit, validé, PAS implémenté** (aucun `weaponWithAmmo` dans `items.ts` encore). Munitions = équipement (`subType`/`qty`), choix joueur, tir = arme+munition, « Recharge N » ; **héros uniquement** (ennemis abstraits). 5 tâches TDD prêtes.

**Reste « compléter le combat »** après ça : ligne de vue + couvert ; **Maladresses** (table de combat) ; et les différés Destin/Résilience (« Je te renie ! » dépend des mutations ; choix de localisation d'un Critique).

Méthode : superpowers brainstorm→spec→plan→execute, TDD, commits par tâche (mes seuls fichiers, cf. [[git-commits-propres-wip-parallele]]). Voir [[game-death-critical-model]], [[game-no-mj-model-everything]]. **Note tooling** : `ctx_edit` glitche sur les très gros blocs (« 1 replacement » mais md5 inchangé) → Edit natif.
