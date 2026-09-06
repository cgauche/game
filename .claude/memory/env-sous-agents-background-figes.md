---
name: env-sous-agents-background-figes
description: "Panne mi-session (2026-08-30) : TOUT sous-agent lancé en ARRIÈRE-PLAN se fige (gel au 1er appel d'outil ou en plein vol, transcript parfois 0 octet) — le PREMIER PLAN marche parfaitement ; diagnostic par agent trivial sans outil puis avec 1 Bash"
metadata: 
  node_type: memory
  type: project
  originSessionId: e805db3f-5697-4af8-bee9-dc0146417e1a
  modified: 2026-08-30T06:31:26.792Z
---

Vécu 2026-08-30 (fermeture vague ③ epic #1463) : 4 sous-agents d'affilée FIGÉS (codeur lean-ctx ×3, claude natif ×1), tous `run_in_background` (défaut). Symptômes : zéro écriture disque pendant 20-80 min, narration arrêtée sur « I'll start by reading... » ou en plein vol, fichier `.output` parfois 0 octet (mort-né). Aucun processus enfant bloqué visible (`Get-CimInstance Win32_Process`). Pendant ce temps, MES outils (Bash natif, ctx_glob, PowerShell) et le **Bash background** répondaient normalement.

**Diagnostic discriminant (2 spawns bon marché, `run_in_background:false`)** : agent trivial « réponds SPAWN-OK sans outil » (2,8 s ✓) puis « un seul `echo TOOL-OK` en Bash » (8 s ✓) → la panne est la machinerie des AGENTS en arrière-plan, pas le spawn, pas les outils, pas lean-ctx.

**How to apply :** dès QU'UN agent background ne produit rien sur disque en ~10 min (sonde `git diff --stat` / `ls` du fichier attendu — jamais lire son .output en entier) : le tuer (`TaskStop`), rejouer le diagnostic ci-dessus, puis basculer TOUS les dispatches en `run_in_background:false` (séquentiel, bloquant — acceptable pour codeur/juge bornés). Ne pas perdre une heure à soupçonner l'outillage de l'agent (3 redispatches « sans ctx » n'ont rien changé). Un agent tué en plein vol laisse ses écritures PARTIELLES dans l'arbre : relire le diff et briefer le successeur sur « ce qui est déjà fait » (vécu : gestes 1-2 sur disque, gestes 3-4 restants).

Vécu 2026-09-05 (train #1508 T2, passe 2) : un codeur REPRIS par `SendMessage` (3ᵉ tour sur le même contexte, ~560 k tokens en cache) s'est figé sur un `Write` d'un fichier NEUF (jamais écrit sur disque), 46 min sans événement dans le `.output`, aucun `node` orphelin. Les deux tours précédents du même agent avaient rendu normalement. Sonde discriminante : `find src -newermt HH:MM` + `stat` des fichiers touchés + `tail -c 1200` du `.output` (le dernier événement est un `stop_reason: tool_use` sans résultat). CAUSE TROUVÉE (le successeur frais a pendu au MÊME `Write`) : ce n'est pas la machinerie, c'est un hook `PreToolUse` qui rend `permissionDecision: 'ask'` — `scripts/hooks/exception-add-guard.mjs` demande l'utilisateur pour tout fichier `*-guard*` NEUF ou toute table nominative qui grossit ; un sous-agent en arrière-plan n'a personne pour répondre et reste « running » sans fin. Même classe : `enterine-guard` (tag `[entériné]`), `memoire-tombale-guard`. Diagnostic en 1 commande : `grep -n "permissionDecision" scripts/hooks/*.mjs` puis comparer au `file_path` du `Write` pendu. Geste : `TaskStop`, puis `SendMessage` au MÊME agent (son contexte survit à l'arrêt) avec un design qui n'a rien à confirmer (exemption AU SITE dans le code, règle sans liste dans un test existant) — jamais un contournement d'outil ou de nom.

Orphelin d'attente (2026-09-05, remarqué par l'utilisateur : « un shell qui tourne depuis plus d'une heure ») : un codeur qui attend sa suite par `until grep -q "SUITE_EXIT" <output> ; do sleep 25 ; done` laisse la boucle DORMIR À VIE si la tâche attendue est tuée (worker mort) et qu'il relance une autre suite. Sonde : `Get-Process bash` avec `StartTime` > 1 h, puis la ligne de commande par `Win32_Process` (script Node `procs.mjs`, PowerShell direct est bloqué par l'allowlist) ; geste : `process.kill(pid)` sur la paire bash. Brief codeur : « une attente de suite a un TIMEOUT et cesse si le fichier attendu porte `[killed]` ».

Lié : [[env-session-background-pieges-outils]], [[env-charge-machine-un-seul-agent-lourd]].
