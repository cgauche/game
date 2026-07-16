---
name: game-taille-combat-lot
description: "Jalon 1.5 Taille en combat (T2/T3/T4) LIVRÉ — effets de Dégâts/lutte/Blessures + orchestration + éditeur, audit RAW propre"
metadata: 
  node_type: memory
  type: project
  originSessionId: 024cd482-0bab-4295-9fab-7d5591050488
---

Lot **« Taille en combat » (Jalon 1.5, T2/T3/T4)** entièrement livré le 2026-06-07 sur `feat/wfrp4-rpg-foundation` (788 tests verts). Plan : `docs/superpowers/plans/2026-06-07-taille-combat.md`.

Livré (max-RAW, Livre de base FR `85 - Traits de créature.md`) :
- **Dégâts ×N** (avant soak) + Atouts **Dévastatrice/Percutante** (cumul à +2 cat, Inoffensive annule), mêlée & tir — `engine/combat.ts applyHit`, `engine/size.ts`.
- **−2 DR/cat en parade** du plus petit (`finishMelee`) ; **Force opposée** helper pur (sans consommateur).
- **Frappe Mortelle / balayage** : `cleaveTargets`/`autoCleave` (IA) / `maybeHeroCleave` + `pendingCleave` + `CleaveModal`, borné à BCC, déplacement sur case tuée (`combatFlow.ts`/`store.ts`).
- **Désengagement gratuit** du plus grand que TOUS ses Engagés (`startDisengage` court-circuité).
- **Piétinement** = action gratuite (1 Avantage, BF, CC) : `battleTrample`/`applyTrample`/`aiMaybeTrample` + hotbar « 🦶 Piétiner ». `applyTrample` **restaure `acted`** car `applyAttackResult` le force à true.
- **Blessures par catégorie** + dynamiques (`woundsForSize`/`maxWounds`/`effectiveMaxWounds`/`refreshWounds`) ; spawn `char.B ?? formule` ; éditeur `StatblockEditor` champ B optionnel (vide = formule placeholder live).
- **Audit de fidélité multi-agents** (Workflow, 8 dimensions RAW find→verify adversariale) : **0 écart confirmé**.

⚠️ **À trancher en recette** : Piétinement résolu **instantanément** (suivi le plan), ce qui tend l'invariante [[game-roll-modal-pattern]] « si y'a un jet, y'a la modale ». Le héros n'a pas de modale Lancer→Chance pour son stomp. Demander si une modale est voulue.

Reste hors-lot : T5 Peur/Terreur (Psychologie), T6 footprint multi-cases. Voir [[game-difficultes-combat-table]] (T0/T1) et [[game-death-critical-model]].
