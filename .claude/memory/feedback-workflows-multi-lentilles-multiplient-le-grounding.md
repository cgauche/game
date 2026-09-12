---
name: feedback-workflows-multi-lentilles-multiplient-le-grounding
description: "Un workflow à N lentilles + N réfutateurs coûte N× le grounding (0,8-2,2 M tokens par run) — il économise le CONTEXTE de l'orchestrateur, pas les tokens ; verbatim user 2026-09-05 « c'est pire qu'avant en terme de consommation » → un seul juge nourri d'un grounding écrit une fois, réfutation seulement sur un bloquant de concept"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 02e357dc-4cb8-4e52-8966-93c37c1ab79e
  modified: 2026-09-05T20:50:56.014Z
---

Verbatim utilisateur (2026-09-05, soir) : « Le but des workflows au point de départ c'était de penser moins de token, justement en évitent les aller retours entre Fable 5.1 et les différents agents. Ce que tu m'as fait avec ces workflows c'est pire qu'avant en terme de consommation. »

Mesuré le même soir (#1679 L3b) : `juge-design-socle` = 7 agents, 0,79 M tokens, 49 min (11 runs sur L3 ≈ 9,9 M) ; `revue-palier` = 16 agents, 2,22 M tokens, 57 min ; contre UN agent juge sur un diff ≈ 0,17 M et un lecteur de grounding ≈ 0,22 M.

Récidive le 2026-09-11 : le workflow `revue-palier` relancé par réflexe (palier de 25 commits, pre-commit bloqué) — verbatim : « Oula arrete avec ce workflow, je n'ai pas assez d'utilisation pour survivre a ca ». Arrêté par `TaskStop`. Le fichier `.claude/workflows/revue-palier.js` existe encore : son existence n'est PAS une autorisation de le jouer. Les faits de palier font 399 Ko (`faits-de-palier.mjs`) — un réducteur (`faits-reduire.mjs`, textes tronqués avec renvoi au fichier complet) les ramène à 33 Ko ; inutile si UN juge lit le fichier complet lui-même.

**Why:** chaque lentille refait de son côté TOUT le grounding (mêmes fichiers lus, mêmes sondes rejouées), puis chaque réfutateur refait celui de la lentille qu'il juge : 8 lentilles + 8 réfutateurs = 16 groundings du même dépôt. Le workflow ne supprime pas les allers-retours, il les multiplie ; ce qu'il épargne, c'est le contexte de l'orchestrateur (rendus lus en résumé), ce qui n'est pas la consommation.

**How to apply:**
- Un jugement (design, diff, palier) = UN agent juge (Opus), les lentilles dans un seul prompt, NOURRI du grounding déjà écrit (fichier `grounding-*.md`, faits de palier) — il ne re-mesure que ce qu'il conteste.
- Réfutation : jamais une étape systématique ; un agent, seulement sur un bloquant qui contesterait le CONCEPT.
- Un workflow multi-agents ne se justifie que si les agents font des travaux DIFFÉRENTS sur des entrées différentes (découpe d'un corpus), jamais pour multiplier les regards sur la même entrée.
- Le coût (agents, tokens, minutes) de chaque jugement se mesure et s'écrit au pilotage.
- Voir [[env-workflow-pipeline-rend-des-copies]], [[feedback-une-seule-session-orchestratrice]], [[user-passage-fable-derives-opus]].
