---
name: game-jalon-2-5-regles-manquantes
description: "Jalon 2.5 règles manquantes INTÉGRÉ (merge 2070ca7 poussé) — qualités restantes, ~30 Traits de créature, maladies LDB 20, corruption avancée, inflictTrauma, ~40 talents câblés"
metadata: 
  node_type: memory
  type: project
  originSessionId: cbf06983-1ff6-471d-a4e0-e526aac2e078
---

**Jalon 2.5 « règles manquantes » intégré** (2026-06-10, bundle `wfrp4reglesmanquantes.bundle` d'une session parallèle, merge `2070ca7` poussé, suite verte 2453 / typecheck 0) :

- **Qualités** : 10 derniers Atouts/Défauts d'armes (LDB 62/63) + Critiques du Test opposé (LDB 14 l.7) + Atouts/Défauts d'armure intrinsèques (Flexible, Impénétrable, Partielle, Points faibles) → `src/engine/qualities/defs/` = 39 defs.
- **Traits de créature** (LDB 85) : nouveau registre `src/engine/traits/` (registry+dispatch+parité), ~30 traits mécanisés (40 defs) ; scénario test `15-traits-creature` 🐲.
- **Maladies** (LDB 20) : Litanie de la Pestilence au complet + traits Infecté/Maladie câblés (champs `Combatant.woundedByInfected/woundedByRodent/diseaseExposure/diseaseImmunities` → Tests de Contraction post-combat).
- **Corruption** : Âme pure (seuil +niveau), « Je te renie ! » (refus de mutation, `RenounceModal`), exposition au Trait Corruption.
- **Trauma** : Effet d'éditeur `inflictTrauma` (LDB 18).
- **Talents** : ~40 talents à effet de jeu câblés dans `src/engine/combatFeatures/defs/` (parité 172/172) — le registre du chantier [[game-loadouts-deux-armes-chantier]] tient sa promesse (Riposte, Tir rapide, Maniement de deux armes… présents).

**Pattern bundle session parallèle** (3e fois, rodé) : `git bundle verify` → fetch dans une branche temp → check collisions vs arbre sale → merge ; conflits typiques = **additifs sur `types.ts`** (champs Combatant des deux côtés → garder les deux) + **registres générés → résoudre par `node scripts/gen-registry.mjs`** (jamais à la main ; gère maintenant 15 familles dont qualities/features/traits). Fichier généré localement modifié qui bloque le merge : `git checkout --` puis regen post-merge (le codegen rescanne l'arbre, rien ne se perd).

**Extension du pattern (2026-06-10, merges Jalon 2.6 `51a5d5e` + créatures `cfeb97b`)** : quand le bundle cloud et la session locale ont **complété le MÊME WIP divergent** (ex. clic implicite : cloud garde les modes move/attack/charge, local les supprime), la règle est **l'UX locale gagne (plus récente, celle de l'utilisateur), les apports moteur du bundle se GREFFENT** sur le modèle local (ex. `moveReachFor` Vol-aware substitué à `reachable` dans les calculs de portée locaux ; mode `'teleport'` ajouté à l'union locale ; vérifier que les features bundle hors zones de conflit — auto-mergées — survivent au choix local : grep `teleport`, signatures d'appel). Diff de tri rapide : `git show HEAD:f | Select-String X` vs `FETCH_HEAD:f` pour savoir QUI a changé quoi vs base. Tests en conflit : prendre la version du côté dont on a gardé l'implémentation.
