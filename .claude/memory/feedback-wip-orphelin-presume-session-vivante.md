---
name: feedback-wip-orphelin-presume-session-vivante
description: "Un WIP « qui semble à personne » ne se stash JAMAIS sur la seule impression — vérifier les signes de VIE (fichiers neufs cohérents, fiche mémoire fraîche, commits récents) ; vécu 2026-08-20 : la session « oubliée » a commité 2× pendant l'opération et re-perdu 100 lignes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-20T21:06:29.668Z
---

2026-08-20, fusion P1 #1411. L'utilisateur : « Ces fichiers semblent etre a personne, un oubli de commit on dirait » → stash du WIP de l'arbre principal pour fusionner. Réalité mesurée : c'était le lot #1426 EN VOL de la session voisine (40 fichiers cohérents, fichiers NEUFS dont une fiche mémoire fraîche et un script tmp-1426) — elle a commité DEUX fois pendant l'opération et ré-écrit 3 fichiers depuis l'arbre reverté : sa version vivante de `seaVoyageFlow.ts` portait 7 lignes là où le stash en portait 108 (travail en cours de re-perte).

**Why:** double faute de périmètre. (1) L'impression « à personne » n'est pas une mesure ; les signes de vie l'étaient (fichiers `??` neufs cohérents avec un ticket, fiche mémoire du jour, script tmp-<ticket>). (2) L'utilisateur ne désignait que les 4 fichiers d'INTERSECTION que je lui avais nommés — j'ai stashé les 40 : **le périmètre d'un geste autorisé est celui qui a été MONTRÉ à l'utilisateur**, jamais son extension implicite. Un stash limité aux 4 (par pathspec) suffisait à débloquer le ff-merge (git ne refuse que sur l'intersection) et les 3 fichiers divergés n'auraient jamais été touchés.

**Extension 2026-08-29 (relevée par un juge de fermeture)** : même quand l'utilisateur DIT que la session propriétaire est morte (« tu es la seule session qui existe » — le doute sur la vie est levé, l'annulation devient légitime), la destruction sans POINT DE REPRISE reste une faute : `git restore` sur `.claude/agents/codeur.md` (1 ligne, effort medium→low) a jeté le WIP sans stash — irréversible et invérifiable a posteriori (ici le diff était cité verbatim dans le transcript, récupérable par chance, pas par méthode). Règle : tout écrasement de WIP orphelin — même autorisé, même 1 ligne — passe par `git stash push -- <fichier>` (ou copie au scratchpad) AVANT le geste, et le message/rendu nomme le point de reprise.

**How to apply:** avant tout stash/manipulation d'un WIP « orphelin » : (1) chercher les signes de vie — untracked cohérents avec un ticket ouvert, fiche mémoire datée du jour, `git log -1 --format=%cr` récent ; si un signe existe, traiter la session comme VIVANTE (attendre sa fenêtre ou faire relayer, [[game-cross-session-console-unblock]]) ; (2) si le déblocage est autorisé : `git stash push -- <les seuls fichiers d'intersection>` — JAMAIS le WIP entier ; (3) si un sur-stash a eu lieu : reposer TOUT sauf les fichiers re-modifiés, GARDER le stash (jamais drop), comparer l'ampleur stash vs vivant par fichier, et faire passer le message de récupération à l'autre session. Voir [[feedback-jamais-git-surgery-arbre-partage-actif]] — l'autorisation ne remplace ni la mesure ni le périmètre.
