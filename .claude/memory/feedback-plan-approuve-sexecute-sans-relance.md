---
name: feedback-plan-approuve-sexecute-sans-relance
description: "2026-08-30 : un plan APPROUVÉ s'exécute jusqu'au bout sans relance utilisateur — chaque item est exécuté, dispatché, ou ancré avec BLOCAGE NOMMÉ ; un « pas aujourd'hui » sans raison est une défaillance d'orchestration"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7fa03aff-afd5-481d-b04f-f8c0892b5ff1
  modified: 2026-08-30T18:41:36.847Z
---

Verbatim utilisateur (2026-08-30, jour même de l'adoption du régime de fermeture) : « En tout cas ca montre clairement que notre worflow échoue si tu échoue a exécuté notre plan sans mon intervention ». Contexte : plan d'audit approuvé (7 paquets) ; j'avais exécuté les paquets saillants puis répondu « pas aujourd'hui » pour le reste — dont 2 items laissés SANS ANCRE (soldes versionnés, cliquets par classe) découverts seulement en me relisant. Il a fallu DEUX relances (« Pourquoi ce "pas aujourd'hui" ? ») pour que tout parte — alors que rien ne bloquait et que les agents pouvaient tourner en parallèle.

**Why :** le régime anti-dérive repose sur l'exécution complète des décisions ; si l'orchestrateur sérialise ou diffère sans raison, la vigilance de l'utilisateur redevient le goulot — précisément ce que l'audit (1,22× de parallélisme, restes résorbés à 19-24 %) condamnait. Un plan approuvé est un ARBITRAGE : le sous-exécuter en silence est de la même famille que le reste flottant.

**How to apply :**
1. À l'approbation d'un plan : dérouler chaque item et lui donner IMMÉDIATEMENT un des trois états — exécuté maintenant, dispatché maintenant (parallélisme par défaut), ou ancré (ticket/lot rattaché) avec BLOCAGE NOMMÉ (dépendance réelle, arbitrage manquant, charge machine). « Plus tard » sans blocage = interdit.
2. Avant de déclarer le travail d'un plan terminé : relire le FICHIER de plan item par item et rendre l'inventaire des trois états — les trous se découvrent en se relisant, pas en attendant la question de l'utilisateur.
3. Le red flag correspondant vit dans le skill [[orchestrer-des-agents]] ; la même discipline vaut pour les DoD de tickets (voir [[feedback-regle-1-jamais-commit-avec-reste-ouvert]], [[feedback-avancer-en-autonomie-jamais-serialiser]]).
