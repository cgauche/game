---
name: user-arbitrage-saves-reset-pas-migration
description: "Changement de forme persistée = bump de `SAVE_VERSION` seul ; les saves antérieures se jettent, on n'écrit pas de migration"
metadata:
  type: user
---

**Verbatim (2026-08-17)** : « L'application n'est pas en prod, si tu perds du temps a faire ces migrations, je prefere que tu supprimer les données plutot que tu les migre »

**Why :** une save perdue coûte moins cher qu'une migration écrite, testée et maintenue à chaque changement de forme.
**How to apply :** un changement de forme persistée bumpe `SAVE_VERSION` et rien d'autre ; une save d'une autre version se jette avec un message clair au joueur ; aucune chaîne de migration ni fixture golden. À re-discuter à la mise en prod réelle.
