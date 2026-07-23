---
name: creer-un-scenario-de-test
description: À utiliser quand on doit vérifier une feature en jeu et qu'aucun scénario du menu « 🧪 Tests — scénarios » ne couvre le cas, ou quand on ajoute un fichier sous src/scenes/test-scenarios/. Un scénario = groupe fixé + scène adaptée + combat direct.
---
<!-- GENERATED: agents:sync; source=.claude/skills/creer-un-scenario-de-test/SKILL.md -->

# Créer un scénario de test

Lire **`docs/test-scenarios.md`** (catalogue complet + conventions + workflow). Un scénario = un
fichier dans `src/scenes/test-scenarios/` enregistré au registre. TOUJOURS passer par le scénario
adapté pour une recette navigateur — sinon en créer un, jamais bricoler un état à la main.

**Anti-grind (classe, vécu 2026-07-08 : bélier à 5 cases + dérive = 8 Rounds de poussées, 52 min
de recette — l'ennui d'un joueur humain).** Un scénario de test DÉMONTRE, il ne fait pas durer :
- le DoD du scénario est atteignable en **≤ 3 Rounds d'actions joueur** ; une mécanique répétable
  (poussée, rechargement, avance) se démontre en **≤ 2 répétitions** — au-delà c'est du grind ;
- la géométrie est ALIGNÉE sur l'objectif (pas de dérive à corriger : le chemin nominal est droit) ;
- chaque héros du groupe fixe a un rôle OU est hors du chemin critique (3 héros oisifs à re-cycler
  chaque Round = coût mort pour le joueur ET la recette) ;
- verrouiller par un test Vitest « anti-grind » : le nombre exact d'actions nominales suffit
  (modèle : `attackPlan` blocked à N−1 poussées, disponible à N — `42-belier-porte.test.ts`).
