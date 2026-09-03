---
name: feedback-changement-de-rng-nest-pas-une-decision-utilisateur
description: "2026-09-02 — « c'est quoi ce délire avec la création du ticket 1685, en quoi ça demande une décision de ma part ? » : un écart au RAW (Test de Résistance roulé hors testValue, sans États) est un BUG à corriger, pas un arbitrage ; « ça change le RNG / rend le jet influençable » n'est une contrainte que pour les trains de FORME (invariance exigée), jamais un motif pour renvoyer une règle du livre à l'utilisateur"
metadata:
  type: feedback
---

**Verbatim utilisateur (2026-09-02)** : « Attends, c'est quoi ce délire avec la creation du ticket 1685, en quoi ca demande une décision de ma part ? »

**Fait** : le juge de design B2a × #1682 a trouvé que `critResistValue` (`critical.ts`) roule le Test de Résistance des critiques hors `testValue` (sans États/passifs/séquelles) sur 38 lignes sur 39, et l'a classé « décision utilisateur requise (influence RNG) » ; j'ai recopié cette classification dans #1685, puis la même pour la trouvaille B2b (cycle de maladie roulé contre Endurance + avances de Résistance au lieu d'un « Test d'Endurance » nu). L'utilisateur a refusé : rien à décider, le livre dit la règle (LDB 16, LDB 18 l.164). Corrigé le 2026-09-03 par #1657 B3-1/B3-1b : `critResistValue` n'existe plus, ces Tests passent par la porte canonique (`testValue` par construction).

**Why :** credo « house-rule ≠ lacune » et règle stricte 7 : quand le livre dit quoi faire et que le moteur ne le fait pas, c'est une DETTE D'IMPLÉMENTATION qui se corrige. L'invariance RNG est l'invariant des trains de FORME (#1657 B2x : la forme change, le comportement non) ; elle ne protège pas un comportement FAUX. Confondre les deux, c'est faire porter à l'utilisateur une décision qui n'existe pas ([[feedback-ne-pas-faire-arbitrer-un-fait]], [[feedback-question-viciee-arbitrage-nul]]).

**How to apply :**
1. Une trouvaille « le code ne fait pas ce que le livre dit » = ticket de FIDÉLITÉ à corriger (train dédié, tests réécrits depuis le contrat, invariance RNG NON exigée puisque le comportement doit changer). Jamais « décision utilisateur ».
2. Une DÉCISION utilisateur n'existe que si le livre laisse le choix (fourchette, « au MJ »), ou si deux passages du livre se contredisent (ex. vers-de-carie : J+10 vs « Durée : 1 semaine », MSRC 16 l.78/88/90) — et alors la question cite les deux passages.
3. Relire les verdicts de juge avec cette grille avant de les recopier : un juge qui écrit « décision utilisateur » sur une règle imprimée se corrige.
