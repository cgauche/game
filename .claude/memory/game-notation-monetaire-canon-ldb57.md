---
name: game-notation-monetaire-canon-ldb57
description: Les notations monétaires « mêlées » (5 CO / 10/– / 10 sc) sont le CANON LDB 57 déjà source-unique — ne jamais les « unifier » sans arbitrage user
metadata: 
  node_type: memory
  type: project
  originSessionId: adfd4529-35c1-4ae9-85da-f959f7971274
---

Le re-jugement joueur-RPG (2026-07-13) a signalé comme « incohérence » les notations
monétaires mêlées dans un même panneau (« 5 CO » vs « 12/– » vs « 10 sc »). Vérification
(lot #375) : c'est la notation CANON multi-dénomination du LDB 57 (or `N CO`, pistoles
`S/C` → « 10/– », sous seuls `N sc`), déjà SOURCE-UNIQUE via `<Coins>` (`src/ui/Coins.tsx`)
+ `formatMoney` (`src/engine/money.ts`), verrouillée par le cliquet (v) de
`src/ui/ui-ratchets.test.ts` (migration #310) et `money.test.ts`.

**Why:** « unifier » ces formats semble un fix UX évident mais violerait la règle stricte 1
(fidélité RAW) et casserait des tests — un agent ou un juge le re-proposera.

**How to apply:** toute proposition d'« harmonisation » des formats monétaires = arbitrage
de GOÛT utilisateur (porté à #366, options : statu quo RAW vs présentation maison taguée),
JAMAIS un lot technique. Les montants apparemment « incohérents » sont souvent des montants
RÉELLEMENT différents (chambre privée 10 pistoles vs commune 10 sous). Cf.
[[feedback-no-fallacious-house-rule-justification]].
