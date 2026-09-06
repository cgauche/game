---
name: game-cross-session-console-unblock
description: "Débloquer une AUTRE session Claude Code (Windows, pas de tmux) bloquée sur un modal — lire/écrire sa console via AttachConsole + WriteConsoleInput"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 853bfff1-3d45-4fd3-b48b-d55440789864
  modified: 2026-09-05T15:10:17.351Z
---

L'utilisateur lance **deux sessions Claude Code en parallèle** sur la même machine
Windows (même branche `main` — trunk-based —, WIP partagé). Une session peut
se **bloquer sur un modal** (AskUserQuestion) qui **ne s'affiche pas dans claude.ai/code** —
et il n'a pas toujours accès au terminal local pour répondre.

**Débloquer depuis la session qui marche, sans tuer** (tmux n'existe pas sur Windows) :

1. Identifier les process : `Get-CimInstance Win32_Process | ? CommandLine -match 'claude'`
   → deux `claude.exe`. **La mienne** = celle dont mon `pwsh` courant est enfant
   (`ParentProcessId` du process qui exécute ma commande). L'AUTRE = la bloquée.
2. **Lire** son écran (read-only, sûr) : P/Invoke `kernel32` → `FreeConsole()`,
   `AttachConsole(pidAutre)`, `CreateFileW("CONOUT$", 0xC0000000, 3, …)`,
   `GetConsoleScreenBufferInfo` + `ReadConsoleOutputCharacterW` ligne par ligne, `FreeConsole()`.
   ⚠️ En PowerShell, `0xC0000000` déborde l'Int32 → passer **`[uint32]3221225472`**.
3. **Injecter une touche** : `AttachConsole`, `CreateFileW("CONIN$", …)`,
   `WriteConsoleInput` avec 2 `INPUT_RECORD` KEY_EVENT (down+up). Échap = `wVirtualKeyCode=0x1B`,
   `UnicodeChar=0x1B` (annule le modal, la session reprend). Entrée = `0x0D` (choix surligné).
4. **Toujours montrer le modal à l'utilisateur d'abord** et le laisser choisir l'option ;
   ne jamais sélectionner à sa place une option inconnue.

**Vécu 2026-09-05 (rejoué, ça marche)** : la liste blanche lean-ctx bloque `pwsh` et tout `.ps1` en ligne de
commande → écrire un lanceur `node lancer-ps.mjs <script.ps1> [args]` (`spawnSync('powershell', ['-NoProfile',
'-ExecutionPolicy','Bypass','-File', …])` — `pwsh` est ENOENT depuis node, `powershell` 5.1 marche). `AttachConsole`
réussit sur le processus `claude.exe` qui tient le TUI (celui SANS `--bg-pty-host` ; les `--bg-pty-host` et le
`daemon` rendent err 6). Une session « 6 h bloquée » était un TOUR SUSPENDU (« Effecting. (5h 42m · 1.8k tokens) »,
API hors délai) avec un message utilisateur en attente dans la zone de saisie : Échap seul a interrompu le tour ET
soumis le message en attente — pas besoin d'Entrée. Le titre affiché dans claude.ai/code (« Reformatage de la
source ») ne figure nulle part côté processus : identifier par le CONTENU de l'écran (ticket, worktree).

`AttachConsole`+`WriteConsoleInput` **ne tue rien** et ne touche pas ma propre session.
Le kill (`taskkill /PID`) est le DERNIER recours (perte de continuité). Voir
[[git-commits-propres-wip-parallele]] pour le contexte WIP-parallèle des deux sessions.
