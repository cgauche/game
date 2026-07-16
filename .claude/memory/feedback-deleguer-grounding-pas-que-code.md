---
name: feedback-deleguer-grounding-pas-que-code
description: "Déléguer aussi le grounding/exploration à un agent Explore, pas seulement le code"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5b6e3f22-7155-4d2e-bf85-94656ba3d0fa
---

L'user (« Pourquoi tu n'utilise pas un agent, cela m'échappe ») a tiqué en me voyant lire
IsoStage/BodyToken/store/frise/CSS **dans le fil principal** avant de déléguer l'implémentation.

**Why:** « orchestrator, agents pour coder » ne s'arrête pas au code. L'**archéologie de code**
(quel fichier, quelles lignes, comment c'est câblé) est exactement le rôle d'un agent **Explore** —
la faire inline gonfle mon contexte pour rien. La *décision d'archi* (où mettre l'état, séparer
deux mécanismes, compat recette) doit rester dans mon contexte ; le *sweep de lecture* non.

**How to apply:** pour une feature non triviale : (1) déléguer le **grounding** à un Explore (il rend
les régions + un rapport), (2) garder dans le fil principal **uniquement** la décision d'archi + le
spec, (3) déléguer le **code** à un agent, (4) **vérifier moi-même** (typecheck + tests + navigateur).
Lire 1-2 fichiers ciblés inline pour trancher reste ok ; un sweep de 6+ fichiers = Explore.

Raffine [[feedback-reutiliser-avant-reinventer]] et la consigne « orchestrator » ; cf.
[[feedback-workflows-calibres-taille]] (calibrer à la taille, l'instruction user prime).
