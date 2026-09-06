---
name: env-scratchpad-purge-en-cours-de-session
description: "Le scratchpad de session (et le dossier tasks/) a été purgé EN COURS de session le 2026-09-04 — tout fichier antérieur à ~20h02 a disparu, cause non attribuée ; la todo de vague et le message de commit y vivaient"
metadata: 
  node_type: memory
  type: project
  originSessionId: 02e357dc-4cb8-4e52-8966-93c37c1ab79e
  modified: 2026-09-04T18:37:31.019Z
---

Mesuré le 2026-09-04 vers 20 h 35 (session « audit-drift-project-plan », #1679 L2 T2) : le dossier
`…\Temp\claude\<slug>\<session>\scratchpad\` ne contenait plus que 56 fichiers, TOUS datés de
20 h 02 ou après ; le dossier frère `tasks\` ne portait plus que deux sorties d'agents (20 h 20 et
20 h 34). Disparus : `TODO-vague-1679.md` (≈ 150 lignes, la SOURCE de reprise de la vague),
`msg-T2.txt` (le message de commit), `pilotage-1679-v8.md`, `design-L2.md`, tous les briefs et
sondes des juges antérieurs, les sorties de gates. Les transcripts survivants des trois agents en
vol ne portent AUCUNE commande de suppression visant le scratchpad ; le codeur avait été coupé par
une limite d'API à 19 h 50 et relancé vers 20 h ; l'utilisateur avait joué `/login` puis `/effort`
entre-temps. Cause NON attribuée (harnais ? reprise de session ?) — ne pas la deviner.

**Why :** la doctrine du skill d'orchestration fait du scratchpad le repli de la todo de vague quand
le harnais n'expose pas de task tools. Ce repli n'est pas durable, même à l'échelle d'une session.

**How to apply :** (1) le PILOTAGE GitHub de l'épic (commentaire réécrit en place) est la seule
reprise fiable — le re-poster à CHAQUE étape franchie, pas seulement à la fin d'un train ;
(2) un message de commit long se réécrit depuis le contexte, jamais depuis un fichier seul ;
(3) au moindre `ls: cannot access` sur un fichier du scratchpad que l'on vient d'écrire, mesurer
l'étendue (`ls -lat`) avant de continuer ; (4) les sondes de juge qui doivent survivre se promeuvent
en tests committés dans le geste (règle déjà existante, ici c'est ce qui les a sauvées).
Lié : [[feedback-reprise-chantier-recuperer-les-analyses-pas-que-le-wip]], [[env-sous-agents-background-figes]].
