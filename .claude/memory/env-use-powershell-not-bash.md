---
name: env-use-powershell-not-bash
description: "Sur cette machine, le shell est PowerShell pour TOUT (git, runners, fichiers) : le pont Bash est 100× plus lent, pend en arrière-plan et corrompt silencieusement"
metadata:
  node_type: memory
  type: feedback
---

Verbatim utilisateur (2026-06-16) : « Je suis certain qu'une de tes instructions t'interdit d'utiliser Bash. »

**Why:** le même `git ls-files` met ~0,05 s en PowerShell contre des dizaines de secondes ou un hang via le pont Bash — et ce pont ne se contente pas d'être lent : variables de boucle non expansées (résultats faux, sans erreur), échappement cassé, backticks exécutés. La règle globale « runners via Bash pour RTK » est INVERSE de la vérité ici.

**How to apply:** PowerShell pour tout shell/git/runner, jamais d'arrière-plan pour un runner ; lecture et recherche par les outils dédiés ; si Bash est malgré tout employé, mettre la logique ENTIÈRE dans un script node (zéro variable shell, zéro boucle, zéro pipe) ; la consigne est déjà en tête des défs d'agents (`.claude/agents/juge.md:12-14`, `codeur.md`, `artiste.md`) — une déf modifiée ne prend effet qu'à la session suivante.
