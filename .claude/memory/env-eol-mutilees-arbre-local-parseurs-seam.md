---
name: env-eol-mutilees-arbre-local-parseurs-seam
description: "Suite rouge SANS diff visible = suspecter les fins de ligne : 202 fichiers Source/ mutilés CRLF (invisibles du git status), parseurs $-ancrés effondrés en (intégral) — diagnostic git ls-files --eol, fix au seam readText (#604)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 4a06634e-991a-4803-9853-2db4dc5bb092
  modified: 2026-07-20T14:03:29.756Z
---

**Incident #604 (2026-07-20).** 4 tests `test:raw` rouges en local, verts au checkout propre (cloud) :
un outil Windows (cmdlet PowerShell d'écriture, `WriteAllLines`/`Set-Content` = CRLF par défaut) avait
réécrit **202 fichiers `Source/**`** avec des fins CRLF le 2026-07-07 — **invisible du `git status`**
(contenu identique, l'index reste LF via `text=auto eol=lf`). Les parseurs de `scripts/raw` (regex
heading ancrée `$` sans flag `m` — `.` exclut `\r`, ECMA-262 — + `split('\n')`) s'effondraient
SILENCIEUSEMENT : tout chapitre CRLF devient une section unique `(intégral)`, zéro trou détecté.

- **Diagnostic** : `git ls-files --eol -- Source docs/raw | grep -v w/lf` (états `w/mixed`/`w/crlf`
  avec `i/lf`) + `mtime` pour dater. Un juge qui raisonne « `git log` vide sur scripts/ ⇒ rouge dès la
  fermeture » se trompe de couche : la donnée est l'ARBRE, pas l'historique.
- **Fix de classe (commit `318c6b9e`)** : seam UNIQUE `readText` (`scripts/raw/_lib.mjs`, normalise
  `\r`) consommé par toute lecture Markdown ; garde `sectionsOf(CRLF) ≡ sectionsOf(LF)` avec preuve
  NÉGATIVE du défaut ; arbre re-normalisé par réécriture contenu-identique (jamais git destructif).
- **Écriture d'agents** : jamais de cmdlet PowerShell d'écriture sur les fichiers du repo — Write/node
  avec `\n` explicite, et prouver l'état final par `git ls-files --eol`.
- **Gate `raw:implemente` bloqué par la dérive d'autrui** : les fiches Implémente peuvent être périmées
  par des commits POUSSÉS sans régénération (leurs commits ne touchaient pas `docs/raw` → gate muet).
  Avant d'embarquer le rattrapage dans SON commit : prouver zéro contamination WIP par régénération en
  **worktree isolé à HEAD** (chemin COURT — `C:/Users/.../Temp/wt604`, les noms `Source/` explosent la
  limite de chemin Windows) byte-comparée à celle de l'arbre. Voir [[game-migration-transverse-en-vol-bloque-le-commit]].
