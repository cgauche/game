---
name: env-garde-memoire-harnais-gates-serie-detachees
description: "Gates et suite complète ne se lancent JAMAIS depuis le harnais : le rejeu local se borne à `npm run gates -- --gates <noms>`, et le train détaché `npm run ops:publier -- --detache` attend la CI de la branche"
metadata:
  node_type: memory
  type: project
---

**Règle :** gates et suite complète ne se lancent jamais depuis le harnais — son garde-mémoire tue l'enveloppe (« system running low on memory ») et `npm run gates` en LANES sature la RAM (rouges `3221225794`, qui n'attribuent rien). Un veilleur node écrit à la main tombe pareil.

**How to apply :** la porte étant le run CI de la branche, `npm run gates` sert au seul DIAGNOSTIC local : on le borne à ce qu'on veut voir (`-- --gates <noms>`, `--serie` pour une lane unique) et on le lance hors du harnais. Depuis le worktree du chantier, `npm run ops:publier -- --detache` se re-spawne détaché, imprime `pid=` et `log=`, rend la main ; il ne joue aucune gate : son étape `ci` ATTEND le run de la branche (`--ci-timeout-min`) avant le fast-forward de `main`. Veille par l'outil **Monitor** (`until grep -q "^PUBLICATION:" <log>; do sleep 20; done`, jusqu'à 60 min) : la dernière ligne du log est `PUBLICATION: vert|rouge|indéterminée`.

**Timeout du Monitor sans `PUBLICATION:`** = processus TUÉ, jamais « ça tourne encore » : `-- --etapes` lit l'état du journal sans rien jouer, `-- --reprendre` repart de la première étape non verte ; sans `--reprendre` le journal est NEUF, donc c'est un lot neuf, pas une reprise.
