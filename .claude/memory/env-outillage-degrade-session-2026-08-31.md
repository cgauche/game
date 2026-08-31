---
name: env-outillage-degrade-session-2026-08-31
description: "Dégradations d'outillage MESURÉES (session L2 #1548, nuit 30-31/08) : triage lean-ctx niveau 2 ampute TOUT (même raw), ctx_search faux négatif TOTAL, ctx_patch faux succès ×6 cumulés, allowlist qui casse sur quotes/pipes/backslashes — la table des replis qui marchent."
metadata: 
  node_type: memory
  type: project
  originSessionId: 39a8970a-cba9-474a-be43-12bdf0b366e7
  modified: 2026-08-31T06:44:17.263Z
---

Dégradations toutes MESURÉES sur cette session (lean-ctx 3.10.x annonce un triage corrigé « à confirmer sur volume » — re-mesurer avant de faire confiance) :

- **`ctx_read` : triage niveau 2 ampute silencieusement**, y compris `raw=true`/`mode=raw`/`fresh`/`aggressiveness:0` (vécu : `structures-lexique.mts` rendu à ~90/396 lignes, `sceneNpc.ts` à 8/35). Repli : **Bash natif `cat`/`sed -n`** (PowerShell `Get-Content` marchait en début de session, puis a dégradé).
- **`ctx_search` : FAUX NÉGATIF TOTAL possible** — « 0 matches for 'sceneNpc' in 629 files » alors que le symbole existait dans 7 fichiers. Un zéro de ctx_search ne prouve RIEN : recouper par grep natif avant toute conclusion d'absence.
- **`ctx_patch` : faux succès ×6 cumulés** (fiche [[env-ctx-patch-faux-succes-relire-au-fichier]] — dont la variante BATCH `ops[]` : un `replace_unique` non-unique est IGNORÉ en silence, le batch rend succès, seuls les autres ops s'appliquent ; le mode single-op, lui, rend l'erreur). TOUJOURS relire au fichier après ctx_patch, surtout multi-ops.
- **Allowlist shell (lean-ctx) : le parseur casse sur** les guillemets doubles dans une chaîne (`castPenalty "all"` dans un here-string), le caractère `⊕`, les pipes PowerShell, les chemins backslash quotés, `--search "deux mots"`, `Out-File`. Replis : chemins en SLASHES sans guillemets, un appel par commande, `--jq` interne simple, `git commit -F <fichier>` en FIN de chaîne `&&` (un `;` collé au chemin rend le fichier « illisible » pour le hook de solde), messages de commit SANS guillemets doubles ni caractères exotiques.
- **PowerShell (fin de session) : avale les backslashes des chemins** (`C:\Users` → `C:Users`) — chemins en slashes partout.
- **Le pont Bash/RTK mange les boucles `for` et les variables shell** (fiche existante confirmée) — tout script multi-étapes passe par un `.mjs` de scratchpad exécuté par `node`.
- **`Write` (outil natif) MATÉRIALISE les échappements unicode** du contenu (un `\u0000` écrit dans un fichier de message devient un VRAI octet NUL) — écrire les séquences en toutes lettres dans les fichiers de prose.
- **Diagnostics LSP sur les sondes de scratchpad d'agents** : bruit permanent, à ignorer — foi au typecheck du dépôt.
