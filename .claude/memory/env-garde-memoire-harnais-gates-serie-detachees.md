---
name: env-garde-memoire-harnais-gates-serie-detachees
description: "Gates et suite complète ne se lancent JAMAIS depuis le harnais : garde-mémoire qui tue l'enveloppe, lanes qui saturent la RAM — le train détaché `npm run ops:publier -- --detache` les joue en --serie, on lit son log"
metadata:
  node_type: memory
  type: project
---

**Why:** le garde-mémoire du harnais tue une commande de fond (« system running low on memory ») — l'enveloppe meurt, les fils continuent —, et `npm run gates` en LANES sature la mémoire : des dizaines de fichiers rouges à `3221225794` (0xC0000142, refus d'initialisation de processus) qui n'attribuent rien. Il tue aussi les POLLS node d'un veilleur écrit à la main : un veilleur de scratchpad n'est pas plus sûr que la commande qu'il surveille.

**How to apply:** l'OUTIL du dépôt joue le train — le scratchpad n'est plus le régime. Depuis le worktree du chantier : `npm run ops:publier -- --detache`. Il se re-spawne lui-même (`spawn(process.execPath, [fichier, ...args], { detached: true, stdio: ['ignore', fdLog, fdLog], windowsHide: true }).unref()`), imprime `pid=<n>` et `log=<chemin>`, et rend la main tout de suite. Veille par l'outil **Monitor**, jamais par une boucle de harnais : `until grep -q "^PUBLICATION:" <log>; do sleep 20; done`, timeout jusqu'à 60 min — la DERNIÈRE ligne du log est toujours `PUBLICATION: vert <tete>` | `PUBLICATION: rouge <étape> — <raison>` | `PUBLICATION: indéterminée ci <tete>`. Machine tuée en plein vol → `npm run ops:publier -- --reprendre` repart de la première étape non verte ; `npm run ops:publier -- --etapes` lit l'état sans rien jouer (journal `node_modules/.cache/publication/<branche>.json`).

Le train joue les gates en `--serie` avec `WFRP_TEST_COEURS=4` par défaut (`scripts/ops/publier.mjs`, étape `gates`) : une mesure prise sous ce bridage n'est PAS comparable à la référence série, et le commentaire de pilotage le dit. La borne se re-mesure par `WFRP_TEST_COEURS` posé par l'appelant, qui prime (`scripts/gates/toutes.mjs:437-447`). D'où vient le 4 — mesure d'origine, session locale du 2026-09-14 : « `WFRP_TEST_COEURS=4` (mesuré 2026-09-14 : à 2 cœurs — ou à 4 cœurs sous une suite concurrente (tronc, 2026-09-14) — la gate `test` EXPIRE au plafond de 900 s et toutes les suivantes sont sautées ; à 6 cœurs en lanes la RAM sature) ». Ni plancher ni plafond théorique : deux bornes mesurées, et un 4 qui tient entre elles.

**Le cas nommé — timeout du Monitor SANS `PUBLICATION:` :** l'absence de la dernière ligne au bout du timeout ne veut pas dire « ça tourne encore », elle dit processus TUÉ (garde-mémoire). Le geste n'est ni relancer à l'aveugle ni conclure au rouge : `npm run ops:publier -- --etapes` lit l'état du journal sans rien jouer (quelle étape est verte, laquelle reprend), puis `npm run ops:publier -- --reprendre` repart de la première non verte. Un run SANS `--reprendre` part d'un journal NEUF : c'est un lot neuf, pas une reprise.

**Preuve de progression :** l'horodatage des justificatifs `node_modules/.cache/gates/*-<pid>.txt` — et désormais le log lui-même, PROGRESSIF, puisque ses fds sont transmis tels quels aux sous-processus (gates, `build-all`, `agents:sync`, push).
