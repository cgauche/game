---
name: feedback-decisiveness-routine-git
description: "Agir décisivement sur l'hygiène git de routine plutôt que sur-délibérer"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 24bd007c-bb00-4fa8-84dd-c36f173caa26
---

Sur les décisions de routine et réversibles — surtout l'hygiène git en contexte multi-sessions — l'utilisateur veut que j'**agisse**, pas que je délibère longuement ou pose des questions. Il a corrigé 2× mon excès de prudence en une session (« Tu ne pouvais pas juste committer le travail en cours ? »).

**Why :** il pilote souvent **plusieurs sessions Claude en parallèle dans le même working tree** et valorise la vitesse/le momentum ; une décision réversible (checkpoint-commit, reset --soft) ne mérite pas un débat.

**How to apply :** pour du réversible à faible risque (checkpoint-commit de la WIP des autres sessions quand elles sont arrêtées, commits par pathspec, retype de donnée morte), faire le choix évident et le **signaler en une ligne**, puis continuer. Réserver les questions (AskUserQuestion) aux choix vraiment irréversibles, sortants, ou ambigus sur le fond. Lié à [[git-commits-propres-wip-parallele]].
