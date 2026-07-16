---
name: game-psychologie-subsysteme
description: Sous-système Psychologie WFRP4 (LDB 21) — P1 Peur/Terreur (= Taille T5) LIVRÉ ; P2-P4 à venir
metadata: 
  node_type: memory
  type: project
  originSessionId: 024cd482-0bab-4295-9fab-7d5591050488
---

Sous-système **Psychologie** (`21 - Psychologie.md`), conçu comme **modèle complet de traits éditables** (choix utilisateur). Spec : `docs/superpowers/specs/2026-06-07-psychologie-design.md`. Cœur pur `engine/psychology.ts`. Implémentation **phasée**.

**P1 — Peur/Terreur LIVRÉ + poussé** (2026-06-07, 1104 tests verts ; plan `…/plans/2026-06-07-psychologie-p1-peur-terreur.md`) — débloque **Taille T5** :
- `parsePsychTraits` parse « Peur N »/« Terreur N »/Immunité depuis `creatures.json` (comme `sizeFromTraits`) ; `fearSourceFor` combine Taille (`peurTerreurFromSize`) + statbloc ; `resolvePeurTest` (Test ÉTENDU, cumule `calmeDR` vers l'Indice) / `resolveTerreurTest` (échec → Brisé ×(Indice+|DR−|) puis devient Peur).
- `Combatant` : `causesPeur/Terreur/psychImmune/psychState/groups/psychTraits`. `psychState` = afflictions actives (« sous Peur » ⟺ `calmeDR < indice`) ; `lastTestRound` = 1 test/Round.
- Héros = **modale** `pendingPsych` (ouverte au début de son tour par `maybeOpenHeroPsych`/`collectHeroPsych` dans advanceTurn/round) ; IA = `resolvePsychAI` instantané + journalisé. **−1 DR** vs la source dans `attackModifiers`. Approche vers la source **bloquée** (`battleClickTile`).

**Reste P2-P4** : **P2 Frénésie** (Test FM, +1 BF, attaque obligatoire, immunité psy, → Exténué) ; **P3 traits ciblés** (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie + modèle de **groupes** dérivés de `folder`→catégorie / `species`→racial / `career`, multiples + extras éditables ; effets combat +1 DR/immunités/contrainte d'action + Soc) ; **P4 éditeur**.

Décisions sans-MJ : difficulté du Test de Calme = **Intermédiaire (+0)** par défaut ; « créature agressive » = tout ennemi plus grand en combat ; « (un au choix) » → trait **inerte** sans Cible assignée. Voir [[game-jet-modale-exhaustif]] (modale différée), [[game-taille-combat-lot]], [[game-no-mj-model-everything]].
