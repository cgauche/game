---
name: feedback-gardes-structurelles-pas-greps
description: "Doctrine user (2026-07-10, « inline ça ne devrait jamais exister — guards mal foutus, code trop permissif ») : un garde par motif/grep est un pis-aller — la vraie garde est STRUCTURELLE : la primitive dangereuse devient non-importable hors de son système (whitelist du GRAPHE D'IMPORTS), la violation ne compile pas au lieu d'être chassée."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dcfa9f52-337e-40a6-9036-fb84db19e703
---

**Déclencheur** : un codeur a livré des Tests de Natation de HÉROS par `rollTest` inline (naufrage #244) — lignes visibles mais ni Chance ni cadence ni contrôleur. La garde `rollflow-no-drift` (grep des verbes re-codés) ne l'a pas vu : elle traquait UNE forme de dérive, pas la classe. Verdict user : « inline… ça ne devrait jamais exister. On a des guards mal foutus et du code trop permissif. »

**Why** : tant qu'une primitive est librement exportée, chaque agent localement-vert peut violer la doctrine globale — et un garde par motif court derrière les formes qu'il n'a pas prévues. La détection est un aveu d'expressivité : si on peut le greper, on peut l'écrire.

**How to apply** :
- Primitive à discipline (résolveur de jet, mutation d'état brute, spawn bas niveau…) → QUARANTAINE : importable uniquement par son système (fabrique/specs) + UN helper sanctionné et hurlant pour les cas légitimes (`npcInlineRoll`…), documenté.
- La garde vérifie le GRAPHE D'IMPORTS (whitelist de 3-4 fichiers), pas des motifs d'appel — structurel, zéro faux négatif de forme nouvelle.
- À chaque nouvelle classe de dérive découverte : se demander D'ABORD « comment la rendre inexprimable ? » ; le grep-baseline n'est que le pis-aller quand la structure ne peut pas porter l'interdit.

Relié : [[game-rollflow-canonical-system]], [[game-exhaustive-guard-vs-per-domain]], [[feedback-fait-se-juge-a-lecran-contre-attendu]].
