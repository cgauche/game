---
name: feedback-une-seule-session-orchestratrice
description: "User (2026-07-11, verbatim) : « Je n'aime pas avoir 2 sessions en // » — une seule session orchestratrice à la fois ; session concurrente détectée = signaler et consolider, jamais installer un partage de rôles durable."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dcfa9f52-337e-40a6-9036-fb84db19e703
---

**User (2026-07-11, verbatim)** : « Je n'aime pas avoir 2 sessions en // » — dit après une journée où deux sessions autonomes ont travaillé le même dépôt (collision sur le front art #342 : deux contrats multi-vues nés en parallèle, remote cassé 1 h par un commit référençant un fichier non committé de l'autre session, coordination de fortune par ticket GitHub).

**Why :** les sessions ne partagent PAS leur contexte de conversation (les arbitrages donnés à l'une sont invisibles de l'autre) mais partagent l'arbre git, la mémoire et les tickets — les collisions sont structurelles, la coordination par ticket est lente et fragile, et l'user ne veut pas payer ce coût.

**How to apply :** dès qu'une session concurrente est détectée (commits étrangers dans l'arbre local, processus claude d'une autre grappe, fichiers WIP inexpliqués) → le SIGNALER immédiatement à l'user et proposer la consolidation (une session termine/committe et se met en veille), au lieu d'installer un partage de rôles. Ne jamais initier soi-même un fonctionnement bi-session. Rappels liés : [[git-commits-propres-wip-parallele]] (l'arbre reste partagé avec d'éventuelles sessions passives).
