---
name: feedback-svg-art-fable-pas-opus
description: "Observation user (2026-07-11) : « Fable était meilleur pour faire du svg que Opus » — les tâches d'art SVG/rig se dispatchent sur des agents en modèle FABLE, pas Opus/Sonnet."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dcfa9f52-337e-40a6-9036-fb84db19e703
---

**Observation user (2026-07-11, verbatim)** : « J'ai remarqué que Fable était meilleur pour faire du svg que Opus d'ailleurs. » — dite en ouvrant le front visuel (rigs jamais traités pendant le programme attendu-vs-réalité).

**Why :** la qualité du dessin SVG (proportions, lisibilité à l'échelle du jeu, composition des paths) varie fortement par modèle ; l'user a comparé sur pièces. Le coût d'un art raté se paie en re-rondes de QC reconnaissabilité.

**How to apply :** tout dispatch d'agent dont le livrable est du DESSIN SVG (rigs, props, navires, véhicules, vues multiples) → `model: 'fable'` explicitement. Opus/Sonnet restent pour le code de la machinerie de rendu (registres, projections, QC harness). Rappels liés : [[game-qc-reconnaissabilite]] (agents juges AVEUGLES pour le QC), [[feedback-rigs-vs-illustrations]] (rigs calés sur les illustrations officielles).
