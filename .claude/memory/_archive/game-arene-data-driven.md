---
name: game-arene-data-driven
description: "Arène (#3) LIVRÉE 100% données (encounters + dialogue gated par flags) ; pas de mécanique dédiée — composer avec l'éditeur existant"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4e6c5100-25b0-4b77-aea8-b26dd13e5d75
---

**Arène (#3) LIVRÉE 2026-06-08** — banc d'essai du marchand (Jalon 1.6 quasi complet). Spec
`docs/superpowers/specs/2026-06-08-arene-design.md`. Scénario `src/scenes/test-scenarios/12-arene.ts`
(menu « 🏟️ Arène »).

**Leçon clé (pushback utilisateur, fort)** : j'avais d'abord ajouté `Scene.arena` + Effets dédiés
`arenaNextWave`/`arenaWaveCleared` + état store `arena`. L'utilisateur : « Tu as créé des attributs
spéciaux ? Y'a pas déjà ce qu'il faut dans l'éditeur ? ». **Tout abandonné.** L'arène se compose
**100 % avec les briques existantes** :
- **Vagues** = des `encounters` (ennemis bestiaire par `ref`=`label`, cf. `findCreature`) ; **butin**
  (`giveMoney`/`giveXp`) + **`setFlag arene_vN`** dans leur **`onVictory`** (les effets de victoire
  tournent dans `checkBattleOver`).
- **Maître d'arène** = entité `personnage` avec **`dialogueId` + `merchant`** ; un choix « Marchander »
  fait `openMerchant` (#2), les choix « Lancer la vague N » font `startCombat 'wave-N'`.
- **Séquençage** = **conditions de dialogue gated par flags** (pas de compteur en dur). Défaite = le flag
  n'est pas posé → retry naturel.

**Réflexe à garder** : avant d'ajouter un attribut/Effet/état « spécial » pour une feature de contenu,
vérifier que l'**éditeur existant** (encounters/onVictory, dialogues+choix+conditions, triggers, Effets
`startCombat`/`openMerchant`/`setFlag`/`give*`) ne le fait pas déjà. Si une **brique générale** manque,
la **généraliser** (pas créer un cas spécial). Cf. [[feedback-no-commit-surgery-shared-tree]] (même
esprit : pas de sur-ingénierie).

**Seule généralisation faite** : `condMet` (conditions de flag) accepte désormais des **flags combinés
en ET** (« v1,!v2 ») — nécessaire pour gater « vague N » (= `arene_v(N-1),!arene_vN`). Et **dé-dupliqué** :
`condMet` était copié dans `combatFlow.ts` **et** `DialogueBox.tsx` → **source UNIQUE exportée par
`scene.ts`** (où `Trigger.condition`/`DialogueChoice.condition` sont définis), importée par les deux.
Lié à [[game-marchand-v1]], [[game-creature-registry]].
