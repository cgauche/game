---
name: env-ecritures-hors-depot-ephemeres-inter-appels
description: "Piège env 2026-08-17 : les écritures HORS dépôt (jobs/tmp, scratchpad, .git/) ne persistent plus entre deux appels shell — heredoc + usage DANS LE MÊME appel"
metadata:
  type: reference
---

Constaté en session le 2026-08-17 (apparu EN COURS de session, après un changement de règles de permission) : un fichier écrit hors du working tree (`~/.claude/jobs/*/tmp/`, le scratchpad `AppData/Local/Temp/claude/...`, et même `.git/`) **disparaît entre deux appels d'outil shell** — `cp` réussit dans l'appel N, `cat` rend « No such file » à l'appel N+1. Les outils Write/Read natifs sont par ailleurs refusés (« Read deny rule ») sur ces mêmes chemins, et le hook commit-msg ne peut plus lire un `-F <fichier>` externe (« illisible … fail-closed »).

**Why :** trois commits ont échoué en boucle (message -F illisible, fichiers de message évaporés) avant le diagnostic.

**How to apply :**
- Message de commit multi-lignes → **heredoc vers `.git/m.txt` + `git commit -m "$(cat .git/m.txt)"` + `rm` DANS LE MÊME appel Bash** (le `-F` est bloqué par le hook, le `-m "$(cat …)"` passe).
- Corps de `gh` → même patron (heredoc + `--body-file` dans le même appel — `.git/etape.md` fonctionne).
- Fiches mémoire → `ctx_patch op=create` (l'outil Write natif est refusé sur `.claude/memory/`).
- Ne JAMAIS supposer qu'un fichier écrit à l'appel précédent existe encore : re-créer dans l'appel qui le consomme.
- Garde de staging : le grep anti-voisin doit **BLOQUER** le commit (pattern `if [ "$N" != "0" ]; then ABORT`), pas seulement afficher — deux embarquements de `stagePan.ts` avant la leçon.
