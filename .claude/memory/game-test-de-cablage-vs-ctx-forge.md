---
name: game-test-de-cablage-vs-ctx-forge
description: "Un test unitaire qui FORGE le ctx (applyOps direct) ne couvre pas le CÂBLAGE — vécu #541 : la clé overcastDurationSteps omise par 1 des 3 sites runCastFlow, invisible des tests, attrapée par la recette navigateur ; exiger un test de câblage niveau state qui ÉCHOUE si on retire la clé du site d'appel."
metadata: 
  node_type: memory
  type: project
  originSessionId: b7898333-a7b3-4cc0-9fb5-ae369c234e88
---

Vécu 2026-07-17 (#541) : l'op `rollTable.extraRollsPerStep` lisait `ctx.overcastDurationSteps`, testé vert en unitaire — mais le test appelait `applyOps` avec un ctx forgé à la main. En jeu, 1 des 3 sites d'appel `runCastFlow` (`on:'target'`, le chemin des sorts à cible `self`) omettait la clé → toujours 0, bug visible uniquement en recette navigateur. Un 2e trou JUMEAU latent existait déjà (`conjureForm` porté par 1 seul site).

**Why** : quand une donnée de contexte traverse une couture multi-sites (N sites d'appel construisent le même objet ctx à la main), chaque clé est un point de divergence silencieux — l'op est testable isolément, le câblage non.

**How to apply** :
- Pour toute nouvelle clé d'`OpsCtx` (ou d'un ctx construit à plusieurs endroits) : exiger du codeur un test de CÂBLAGE niveau state (flux réel de commit, ex. `castAllocOvercast` → `castConfirm`) et la PREUVE qu'il échoue si on retire la clé du site d'appel — un test qui forge `extras`/ctx au point de contourner le site fautif ne prouve rien.
- Au review d'une clé ctx : diff clé-par-clé des N sites constructeurs (le balayage #541 a trouvé le trou jumeau en 5 minutes).
- Classe de fond : N constructions manuelles du même objet = le smell ; à terme mutualiser la construction du ctx ([[feedback-mutualiser-invariant-pas-juste-appel]]).
