---
name: feedback-pas-de-plan-superpowers-tickets-github
description: "2026-08-23 : l'utilisateur DÉTESTE le format de plan superpowers (writing-plans/executing-plans, checkboxes, docs/superpowers/plans) — la planification de ce projet = TICKETS GitHub par lot (DoD, deps, état, labels) + briefs .superpowers/sdd/"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 581b89eb-a389-4f97-87c2-713104a0fbca
  modified: 2026-08-23T10:31:22.067Z
---

Verbatim utilisateur (2026-08-23, au moment où j'invoquais `superpowers:writing-plans` pour #1463) : « Ah, j'avais oublié que tu avais besoin de superpowers pour faire tes tickets ... qu'est ce que je deteste superpower pour ca ».

**Why :** le plan superpowers (fichier daté sous `docs/superpowers/plans/`, tâches à checkboxes « écrire le test / lancer / committer ») est (a) un doc DATÉ dans `docs/` — la classe de poison responsable de la dérive des structures ([[feedback-docs-dates-poison-de-design]]) ; (b) redondant avec la convention du projet : un ticket GitHub par lot porte DoD, dépendances explicites et état mesuré ([[feedback-tickets-dependances-etat-mesure]]), et c'est le ticket que le prochain agent lit.

**How to apply :** ne JAMAIS invoquer `superpowers:writing-plans` / `executing-plans` / `subagent-driven-development` sur ce dépôt. Planifier = (1) l'épique sur son ticket (design validé en commentaire daté verbatim) ; (2) un ticket par lot, gabarit #101+ avec labels (`gh label list`), « Bloqué par #N / Débloque #N » explicites, DoD mesurable ; (3) les briefs de codeur dans `.superpowers/sdd/<chantier>/` (gitignoré), un par tâche, au format du skill `orchestrer-des-agents` (périmètre exact, primitives cibles, réfs RAW nues, sortie brute des portes exigée). Le skill `superpowers:brainstorming` reste utile pour l'ALTITUDE (questions, options, réfutation) mais sa sortie va au ticket, pas dans `docs/superpowers/specs/`.
