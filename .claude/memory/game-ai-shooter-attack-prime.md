---
name: game-ai-shooter-attack-prime
description: "IA combat — « un coup jouable prime » ; tireurs/hybrides utilisent leur arme à distance, ne chargent/repli pas"
metadata: 
  node_type: memory
  type: project
  originSessionId: 595d00e2-e728-4472-a745-cee05f908fbc
---

Principe IA combat (héros auto + ennemis, `chooseEnemyAction` unifié) confirmé par 2 retours playtest 2026-06-27 (arbalétrière fonce au centre au lieu de tirer ; chasseur charge à l'arme simple alors qu'il a une fronde). **Un combattant qui PEUT attaquer attaque ; il ne se repositionne/n'approche au contact qu'à défaut.**

**Why:** la REPOSITION/repli a une utilité d'ÉCHELLE DE POSITION (couvert/danger, `positionValue`), incommensurable avec l'échelle Blessures d'une attaque. Le seul biais `TIER` (cast<shoot<melee<move) ne départage qu'à utilité ÉGALE → un gain de couvert (~5) battait un tir/cast peu fiable (~1-2). Et `isShooterOrCaster = … || (hasRanged && !hasMeleeWeapon)` déclassait les HYBRIDES (fronde+dague, arbalète+épée) en mêleeurs dès hors de portée → charge au contact.

**How to apply:** (1) la REPOSITION (`ai.ts` ~910) ne s'émet QUE si `!hasPlayableAttack` (aucun candidat cast/castArea/shoot/melee d'util>0). (2) `isShooterOrCaster = canCast || canShoot || hasAnyOffensiveSpell || hasRanged` (sans `&& !hasMeleeWeapon`) → un hybride hors de portée s'approche à sa DISTANCE DE TIR (standoff via `preferredRange`), jamais au contact ; mêlée au contact (cible adjacente) et tir en portée restent gérés par `canShoot`/candidat mêlée direct. Golden : tireur tire / hybride standoff / lanceur au contact lance / repli seulement sans attaque (`ai-golden.test.ts`). Vérif déterministe = `buildAiInput`+`chooseEnemyAction` sur la vraie scène, pas le navigateur. Lié à [[game-data-driven-architecture]], [[feedback-playtest-themes-not-points]].
