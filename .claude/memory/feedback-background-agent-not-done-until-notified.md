---
name: feedback-background-agent-not-done-until-notified
description: "Un agent run_in_background n'est PAS fini tant que sa <task-notification> n'est pas arrivée — ne pas tester/lire son WIP."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c3f59f27-07d7-490b-8e12-1a5db6c863e7
---

Quand je lance un agent en `run_in_background`, ses modifications de l'arbre de travail sont **en cours d'écriture**, pas finies, tant que la `<task-notification>` de complétion n'est pas arrivée.

**Why:** un WIP mi-écrit affiche des erreurs FANTÔMES — fonctions appelées mais pas encore définies/importées (`ReferenceError: X is not defined`), actions store pas encore câblées (`Y is not a function`). Les prendre pour des bugs de l'agent = faux diagnostic, effort gaspillé, et risque d'**interférer** avec un agent encore actif (la consigne de dispatch dit explicitement « ne duplique pas son travail, évite ses fichiers »).

**How to apply:** ne PAS lancer ses tests, ni lire/grep ses fichiers, ni diagnostiquer son code, AVANT la notification de fin. Si un test échoue sur du code visiblement à moitié posé d'un agent background, c'est qu'il n'a pas fini — attendre. Vérifier (diff + RAW + tests) UNIQUEMENT une fois la complétion notifiée. Lié à [[feedback-orchestrator-verify-delete-redo]] (vérifier oui, mais APRÈS « terminé »).
