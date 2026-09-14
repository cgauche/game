---
name: env-garde-memoire-harnais-gates-serie-detachees
description: "Gates et suite complète ne se lancent JAMAIS depuis le harnais : garde-mémoire qui tue l'enveloppe, lanes qui saturent la RAM — script détaché + --serie à 4 cœurs, veilleur = outil Monitor"
metadata:
  node_type: memory
  type: project
---

**Why:** le garde-mémoire du harnais tue toute commande de fond (« system running low on memory ») — l'enveloppe ET un simple poll de veille —, et `npm run gates` en LANES sature la RAM (rouges `3221225794` qui n'attribuent rien) ; à 2 cœurs, ou à 4 cœurs sous une suite concurrente, la gate `test` expire au plafond de 900 s et tout ce qui suit est sauté.

**How to apply:** `spawn(process.execPath, [runner], { detached: true, stdio: fichiers, windowsHide: true }).unref()` depuis un script du scratchpad, le runner jouant `scripts/gates/toutes.mjs --serie` avec `WFRP_TEST_COEURS=4`, log en chemin ABSOLU (le cwd du runner est le worktree) terminé par `exit=<code>` ; veilleur = outil **Monitor** (`until grep -q "^exit=" log; do sleep 20; done`), jamais un Bash de fond ; la progression se lit à l'horodatage des justificatifs `node_modules/.cache/gates/*-<pid>.txt` (spawnSync tamponne la sortie) ; avant de lancer : verrou `wfrp-suite.lock` libre et `Get-Process node` calme ; ordre : livraison → `npm run docs:build` → pieds d'empreinte → gates → publication.
