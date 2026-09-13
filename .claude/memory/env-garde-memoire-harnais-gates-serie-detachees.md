---
name: env-garde-memoire-harnais-gates-serie-detachees
description: "Gates et suite complète ne se lancent JAMAIS depuis le harnais : garde-mémoire qui tue l'enveloppe, lanes qui saturent la RAM — script détaché + --serie, puis relire le fichier"
metadata:
  node_type: memory
  type: project
---

**Why:** le garde-mémoire du harnais tue une commande de fond (« system running low on memory ») — l'enveloppe meurt, les fils continuent —, et `npm run gates` en LANES sature la mémoire : des dizaines de fichiers rouges à `3221225794` (0xC0000142, refus d'initialisation de processus) qui n'attribuent rien.

**How to apply:** `spawn(process.execPath, [runner], { detached: true, stdio: fichiers, windowsHide: true }).unref()` depuis un script du SCRATCHPAD, le runner jouant `scripts/gates/toutes.mjs --serie` et écrivant son code de sortie en fin de fichier, plus un veilleur léger ; ordre : livraison → `npm run docs:build` → livraison des pieds d'empreinte → gates → publication ; toute attente/boucle s'écrit dans un script node (l'allowlist bloque `node -e`, `until`, l'arithmétique shell) ; fichiers de travail au scratchpad, jamais dans l'arbre.
