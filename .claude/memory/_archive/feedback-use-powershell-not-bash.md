---
name: feedback-use-powershell-not-bash
description: "Sur cette machine, utiliser PowerShell pour les commandes (Bash traîne / part en arrière-plan)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bf030429-e9e6-4510-9862-ce4901c0d820
---

L'utilisateur : « utilise powershell, Bash met des plombes ». Sur cette machine Windows, l'outil **Bash** s'auto-met en arrière-plan (hook RTK lent) → chaque commande oblige à attendre une notification puis relire le fichier de sortie = très lent. **Préférer PowerShell** pour TOUT (runners inclus : `npm test`, `tsc`, `npx vitest`, `npx tsx`, git) — il rend la main immédiatement.

**Why:** le débit s'effondrait avec Bash (cycles attente/relecture). L'utilisateur veut de la vitesse. Override la règle de routage `runner-routing.md` (qui voulait Bash pour la compression RTK) — l'instruction utilisateur prime.

**How to apply:** lancer test/typecheck/build/git/grep via l'outil **PowerShell** (pas Bash). La sortie vitest n'est pas compressée par RTK en PowerShell → filtrer soi-même (`Select-String`, `| Select-Object -Last N`). Prolonge [[feedback-lean-process-over-ceremony]].
