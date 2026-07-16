---
name: game-monolithic-sprites-vestigial
description: Le sprite-sheet monolithique (creatureSprites.json) est SUPPRIMÉ — tout le bestiaire passe par le rig (commit 9bc1b1d, 2026-06-08)
metadata: 
  node_type: memory
  type: project
  originSessionId: 98f84667-75bc-4711-b17b-0e666b4f7e03
---

**SUPPRIMÉ le 2026-06-08 (commit 9bc1b1d, poussé).** Retirés : `creatureSprites.json`/`creatureViews.json` + `enemySprite`/`creatureView`/`creatureNames`/`mutantStand` ; `entitySprite` réduit au décor (props, villageois en filet) ; picker éditeur re-sourcé sur `creatureSpeciesNames()` (defs rig) ; **aperçu inspecteur éditeur re-sourcé sur `pickBackend`** (était le SEUL chemin vivant restant vers `enemySprite`, via la fonction locale `entitySvg` supprimée — quad déjà détourné mais pas les autres plans). 11 scripts caducs supprimés (QC + ingestion mono). Vérif : workflow d'atteignabilité adversarial + recette browser-free via le vrai `pickBackend` (0 créature → backend 'sprite' ; décor reste 'sprite'). `CLAUDE.md` mis à jour. Recette navigateur visuelle non faite (Playwright verrouillé par session //). Prolonge [[game-supprimer-legacy]].

Vérité-terrain (2026-06-08, classifieur réel `classifyEnemy`+`bodyPlanOf` sur les 57 entrées) : **57/57 sprites monolithiques court-circuités** — 29 → rig bipède (Humain, Nain, Orc, Gobelin, Goule, Squelette, Zombie, Vampire, Minotaure, Géant, Troll, Ogre…), 28 → gabarit rigué (quadrupède 8, ailé 8, spectral 3, jabberslythe 3, +arachnide/aviaire/céphalopode/serpentin/squig/amorphe). **Zéro** créature résout en `'monolithic'` (aucun def ne déclare `plan:'monolithic'` ; `bodyPlanOf` défaut = `'biped'`, un vrai plan rig). `AnimatedPlanToken` rend `null` si `'monolithic'` → donc combat n'atteint jamais le monolithique ; seul `pickBackend` l.78 (`entitySprite`) reste vivant, et **uniquement pour les PROPS** (décor) après migration objet→prop / pnj·ennemi→personnage.

⚠️ « passe par le rig » ≠ bonne silhouette — certaines des 29 bipèdes sont des approximations à QC (Minotaure, Fimir, Rat ogre). Routage fait ; qualité visuelle = chantier QC séparé (cf. [[game-bestiary-sprite-bar]], [[game-qc-reconnaissabilite]]).

**Suppression en cours** (user « retirer maintenant ») : enlever `creatureSprites.json`/`enemySprite`/`creatureView`/`creatureViews.json` + branche créature de `entitySprite` ; **GARDER** `entitySprite→propSprite` (décor), re-sourcer `creatureNames` (picker éditeur) sur les defs rig. Tendrils vivants à recâbler, PAS du code mort pur. Même profil que la couche calques retirée (commit 84bef1d, cf. [[game-supprimer-legacy]]).
