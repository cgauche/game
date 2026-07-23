---
name: deployer-en-prod
description: À utiliser quand l'utilisateur demande une mise en production, un déploiement, ou de publier le jeu sur cgauche.github.io/jeu — et UNIQUEMENT sur demande explicite.
---
<!-- GENERATED: agents:sync; source=.claude/skills/deployer-en-prod/SKILL.md -->

# Déployer en production

Suivre le § Déploiement du **AGENTS.md** (`node scripts/deploy/deploy.mjs`, `--push` pour publier).
Préconditions ABSOLUES : demande explicite de l'utilisateur + suite complète verte + **arbre
PROPRE/commité** — `deploy.mjs` lit le working tree, pas Git : le WIP non commité d'une autre
session partirait en prod. Vérifier `git status` avant.
