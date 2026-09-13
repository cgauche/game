---
name: user-regime-une-session-par-chantier-2026-09-01
description: "UNE session par chantier ; l'arbre principal ne sert qu'à l'intégration, tout train vit et se commet dans un worktree, gates vertes avant push"
metadata:
  type: user
---

**Verbatim (2026-09-01)** : « Faut arreter les sessions en backgrounds, ca m'inquieye » puis, option retenue, « Finir le merge, puis une seule session par chantier ». **Verbatim (2026-09-12)** : « sauf que j étais absent, ça m a pris plus d une heure à la valider ».

**Why :** paralléliser sur les mêmes fichiers coûte plus qu'il ne rend, et une autorité relayée par une autre session n'autorise rien.
**How to apply :** une session par épic ; l'arbre principal n'est qu'avancé en `git pull --ff-only` — AUCUN commit n'en part, mémoire comprise : tout train se code, se gate et se commet dans son worktree, qui reçoit une copie de `.claude/settings.local.json` (jamais committée) et se pilote par le `cwd` de l'outil, jamais par un `cd`.
**Portes :** `npm run gates` vert avant tout push (les portes sont celles de `.github/workflows/ci.yml` et rien de moins — un step neuf est une porte neuve), jamais de push quand `main` est rouge ; fan-out ≤ 1 par commit ; les trouvailles hors lot vont en inventaire sur le ticket de la vague ; aucune vague hors périmètre sans validation DIRECTE dans la session.
