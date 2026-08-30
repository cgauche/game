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

Lié : [[env-session-background-pieges-outils]], [[env-charge-machine-un-seul-agent-lourd]].
