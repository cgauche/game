---
name: feedback-no-commit-perfectionism
description: "Ne pas sur-investir l'hygiène des commits face à la session parallèle — coder, pas peaufiner les patchs."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6a091869-bf82-4c57-9848-2d25a75eaedb
---

« Vous passez plus de temps à créer vos commit parfait qu'à développer. » Les scripts d'isolation de hunks faits-main (node + git apply --cached + strict gate, ré-exécutés à chaque commit) coûtent plus qu'ils ne rapportent.

**Why:** la session Claude parallèle qui partage le working tree sweepera de toute façon mes hunks de fichiers chauds dans ses commits (et inversement) — c'est ACCEPTÉ ([[git-commits-propres-wip-parallele]] dit déjà « code landed in HEAD = OK, don't over-isolate »). Le temps passé à séparer chirurgicalement chaque commit est du temps volé au développement, ce que l'utilisateur veut.

**How to apply :**
- Fichiers NOUVEAUX (à moi) → `git add` + commit simple, point.
- Fichiers CHAUDS partagés → soit pathspec direct en assumant un éventuel embarquement parallèle, soit on laisse l'autre session les committer (mon code atterrit en HEAD quand même) ; **vérifier juste que mon code est en HEAD**, pas re-séparer.
- **Committer moins souvent / par lots** à des coutures naturelles, pas après chaque micro-edit.
- PAS de script d'isolation node sauf fuite vraiment grave (secret, gros refacto). Une vérif PowerShell rapide suffit si besoin.
- Priorité = DÉVELOPPER. Prolonge [[feedback-decisiveness-routine-git]] et [[feedback-no-padding-status]].
