---
name: user-arbitrage-saves-reset-pas-migration
description: "Arbitrage user 2026-08-17 : app pas en prod — les saves anciennes se SUPPRIMENT au changement de forme persistée, on n'écrit PLUS de migrations"
metadata:
  type: feedback
---

Arbitrage utilisateur (2026-08-17, verbatim) : « **L'application n'est pas en prod, si tu perds du temps a faire ces migrations, je prefere que tu supprimer les données plutot que tu les migre** ».

**Why :** l'app n'a pas de joueurs en prod ; le coût récurrent des migrations de save (module de remap + fixture golden + test de comportement + lentille de juge à chaque changement de forme persistée — 3 écrites dans la seule journée du 2026-08-17) n'est pas justifié. Une save perdue coûte moins qu'une migration écrite.

**How to apply :**
- Changement de forme persistée → **bump `SAVE_VERSION` SEUL**. Une save de version antérieure se **jette** (reset propre, message clair au joueur), jamais de remap.
- La machinerie `MIGRATIONS` + fixtures golden + tests legacy = purgée post-arbitrage (vérifier l'état réel avant d'y retoucher).
- La lentille de juge « P1 de save » change : elle exige le BUMP de version quand la forme persistée change (sinon zombie silencieux), plus jamais une migration.
- L'en-tête de doctrine de `src/state/saves.ts` se réécrit dans ce sens.
- Cet arbitrage sera à RE-DISCUTER à la mise en prod réelle — il est daté, pas éternel.

Relié : [[feedback-attendu-valide-est-un-arbitrage]], [[game-newgame-reset-pattern]].
