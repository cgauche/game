---
name: game-loot-window-identification
description: "Fenêtre de loot attribuable partout (pendingLoot) + Évaluation/Détection d'artefact — brique partagée avec l'écran de victoire ; décors interactifs bloquants"
metadata: 
  node_type: memory
  type: project
  originSessionId: 12b827af-0e14-4669-9205-8ef07478f915
---

Livré 2026-06-12 (commit c1aa3f9, déployé prod). Origine : bug « je clique le décor à halo, rien ne se passe » — la fouille MARCHAIT mais tout partait dans le journal (giveTrapping silencieux au héros 1).

**Architecture (ne pas dupliquer) :**
- `applyEffectsLoot(get,set,effects,title)` (combatFlow) : hors combat, les `giveTrapping` SANS heroId → `pendingLoot` (fenêtre « qui l'emporte ? ») ; avec heroId = don d'auteur direct ; en combat = passthrough. Câblé : interactEntity, resolveTest, checkTriggers, chooseDialogue, dismissTravelRecap, péripéties voyage.
- `gearFromEffects` + `assignGearAt('pendingLoot'|'pendingVictory')` : source unique victoire/fenêtre. UI partagée `GearAssignList` (VictoryScreen + LootModal). Restes à la fermeture → héros 1 (contrat victoire).
- LootModal gated `!battle` (réapparaît après le combat) ; monté AVANT AppraiseModal ; `.modal-overlay` z=130 > victoire (120).

**Identification (sourcée) :**
- Évaluation (LDB 60 l.10) : révèle `identified` + estime le prix — fenêtre, victoire, ET inventaire (avant : marchand seulement). Échec → verrou du JOUR (`appraiseTriedDay`, LDB 12 l.120 + ADE2 « une semaine par tentative »).
- Détection d'artefact (LDB 10 l.310-312) : Intuition au toucher du MEILLEUR PORTEUR du Talent (`bestDetector`), 1 tentative/artefact (`detectTried`), succès → `magicKnown` (✨), DR ≥ nb qualités → identifié. PendingAppraise réutilisé (`mode:'detect'`).
- Perception de la Magie (LDB 10 l.741) = détecte les SORCIERS, pas les objets — hors sujet.
- ADE2 « Identifier un artefact » = Activité d'interlude LIVRÉE (264e138), au CATALOGUE : `activities.json#identify` → resolver `identify` de `runActivityResolver` (`src/state/interludeFlow.ts`) — Savoir (Magie) Intermédiaire (+0) exigée (compétence AVANCÉE : il faut l'avoir, sinon refus journalisé), 1 Activité = 1 semaine ; ACE 12 l.33-42 a son propre resolver `identifyByResearch`. Tableau mappé MONOTONE (DR≥4 identifié, succès<4 magicKnown, échec ≤−4 → `suspectedQualities` = FAUSSES certitudes affichées « soupçonné », purgées par toute vraie révélation) — la ligne 0/+1 du tableau FR (révèle une cachée alors que +2/+3 non) lue comme artefact d'OCR.

**Décors interactifs bloquants** : `entityBlockedAt` — prop avec `interact` bloque sa case 1×1 (fini de marcher SUR le coffre en combat). Piège : les spawns d'ennemis à GROSSE empreinte peuvent chevaucher un prop interactif (Vouivre zone 7 3×3 déplacée (24,4)→(24,5) dans le JSON ET zones1-7.mjs).

**Affordance** : étincelle dorée flottante (au-dessus du sprite, d+0.02) + onde sonar (halo-ping, transform-box fill-box) sur tout prop fouillable.

Pièges rejoués : ConvertTo-Json PowerShell APLATIT les JSON pretty (19911→1 ligne) — édition chirurgicale obligatoire ; HMR full-reload casse la recette ([[game-browser-verif-tempo]]) ; reset() des tests doit purger pendingLoot/pendingAppraise ([[game-jet-modale-exhaustif]]).
