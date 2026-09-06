---
name: env-heredoc-interpreteur-pend-au-lieu-de-refuser
description: "Vécu 2026-09-05 : un sous-agent codeur a lancé `python3 - <<'PY' …` (édition de fichier par interpréteur + heredoc) — la politique lean-ctx l'interdit, mais le shell d'enveloppe bash est resté PENDU 36 min (PID visible dans /tasks « Status: running ») au lieu d'échouer net ; l'orchestrateur ne peut pas le tuer (taskkill/Stop-Process bloqués)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: e72180bd-85a9-4fe1-915b-20e4f3d7932a
  modified: 2026-09-05T20:19:24.916Z
---

**Fait** : un codeur a tenté de remettre `src/ui/CombatConsole.tsx` après une mutation avec `python3 - <<'PY'`. Le hook a bloqué l'interpréteur mais le `bash.exe -c "source …snapshot… && …"` parent est resté vivant 36 min, listé côté utilisateur comme un shell de MA session (« C'est un de tes shells de session pourtant »). `taskkill` et `Stop-Process` sont hors allowlist pour moi : seul l'utilisateur peut le fermer (`! taskkill /PID <pid> /T /F` ou /tasks).

**Why** : un shell pendu bloque l'agent qui l'attend et inquiète l'utilisateur (processus fantôme à son nom) ; l'interdiction n'est pas visible dans le brief des agents.

**How to apply** :
- Tout brief de codeur/juge porte la ligne : « JAMAIS d'interpréteur alimenté par heredoc (`python3 -`, `node -e`, `powershell -c`) : édition et remise par `ctx_patch`/Write ; une mutation se pose et se remet avec le MÊME outil d'édition. »
- Si un agent ne rend plus rien depuis > 15 min, vérifier /tasks et les `bash.exe` de la session (`Get-CimInstance Win32_Process` filtré sur `CommandLine -match 'python|node -e'`), prévenir l'agent par SendMessage, demander à l'utilisateur de tuer le PID.
- Après un tel incident : grep des marqueurs de mutation dans `src/` (la remise a pu ne pas avoir lieu).

Lié : [[env-session-background-pieges-outils]], [[env-garde-memoire-harnais-gates-serie-detachees]].
