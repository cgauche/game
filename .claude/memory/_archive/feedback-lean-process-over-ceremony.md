---
name: feedback-lean-process-over-ceremony
description: Privilégier le débit de dev sur la cérémonie (revues/commits) ; le golden+typecheck+suite SONT le garde-fou
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bf030429-e9e6-4510-9862-ce4901c0d820
---

L'utilisateur : « Vous passez plus de temps à créer vos commits parfaits qu'à développer. » En subagent-driven-development sur ce repo, ne PAS dérouler une revue à deux étages (spec-reviewer + quality-reviewer en subagents) NI une vérification de scope de commit par subagent sur chaque tâche.

**Why:** la cérémonie de process (revues exhaustives, vérif de commit parfait) volait le temps de dev ; il veut du débit. Prolonge [[feedback-workflows-calibres-taille]] + [[feedback-decisiveness-routine-git]] + [[feedback-no-padding-status]].

**How to apply:**
- Garde-fou primaire = **golden master + `npm run typecheck` + `npm test`** (runners en Bash natif). C'est ça qui prouve l'iso-rendu, pas un subagent reviewer.
- Tâches additives/mécaniques (registre vide, extraction de table en fichiers, commit de script) → implémenteur → coup d'œil `git show --stat` + golden vert → commit → suivant. Pas de reviewer dédié.
- Reviewer adversarial dédié réservé aux tâches à régression silencieuse (flips de migration qui touchent du code partagé hors périmètre du golden : vues back/anim/éditeur) et à l'art (l'audit aveugle EST la revue).
- Commits scopés (`git commit -- <chemins>`) restent nécessaires (arbre partagé, WIP d'une autre session à ne pas embarquer) mais = un coup d'œil, jamais un subagent. Cf. [[git-commits-propres-wip-parallele]].
