---
name: feedback-gate-de-lot-couvre-tous-les-consommateurs-du-registre
description: "Le périmètre de gates d'un lot se DÉRIVE de qui LIT ce qu'il touche (registre, stock, primitive), jamais de là où il a écrit."
metadata:
  type: feedback
---

Avant d'écrire le brief d'un lot, mesurer ses consommateurs (`grep -rl` sur le symbole ou le module touché, tests compris) et poser CE set de gates ; la suite complète avant fusion reste la règle.

**Why:** un périmètre choisi par « où j'ai écrit » ignore « qui me lit » — un registre d'actions est lu par le monde autant que par la console, un stock de garde par plusieurs suites, et la régression sort après le push.

**How to apply:** toucher `src/data/actions.json`, `src/state/actionRegistry.ts` ou un `scripts/guards/lib/*Stock.mjs` ⇒ dériver la liste des suites par grep et les jouer ; un en-tête ou un littéral récapitulatif se recale avec ses lignes.
