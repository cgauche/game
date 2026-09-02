---
name: env-bash-background-tue-gates-au-premier-plan
description: "2026-09-02 — deux chaînes de gates (npm test + tsc + eslint) lancées en Bash run_in_background ont été TUÉES (« killed ») à ~1 min sans cause visible, après qu'une première avait réussi ; au premier plan avec timeout 600000 elles passent. Et le dossier de job ($CLAUDE_JOB_DIR) change à chaque job : un chemin de message de commit passé par variable est REFUSÉ par le hook (contrôle de solde fail-closed) — chemin littéral obligatoire"
metadata:
  type: reference
---

**Faits (2026-09-02, session L3 #1659)** : `npm test` (suite complète ~9 min) + `tsc` + `eslint` chaînés en Bash `run_in_background` → notification « killed » deux fois de suite (suite interrompue à mi-course, le fichier d'exit jamais écrit), alors que la même chaîne avait abouti une fois plus tôt. Relancée AU PREMIER PLAN (`timeout: 600000`), suite seule puis tsc/eslint/docs dans un second appel : verte.

Le dossier de job (`~/.claude/jobs/<id>/tmp`) vaut le job COURANT : un script écrit sous l'ancien id n'existe pas sous le nouveau, et le hook pre-commit du dépôt refuse un message de commit dont le chemin de fichier passe par une variable d'environnement (« message en fichier illisible pour le contrôle de solde ») — il faut le chemin LITTÉRAL. Le même hook pattern-matche ce texte jusque dans un heredoc : écrire les fiches mémoire avec l'outil Write.

**How to apply :** gates lourds au premier plan, en deux appels (suite seule ≤ 10 min, puis tsc+eslint+docs) ; chemins littéraux dans tout fichier de message ou de corps ; vérifier l'existence d'un script de job avant de l'appeler.
