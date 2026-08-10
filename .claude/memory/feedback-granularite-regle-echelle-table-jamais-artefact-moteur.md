---
name: feedback-granularite-regle-echelle-table-jamais-artefact-moteur
description: "Une règle RAW s'implémente à la granularité de la TABLE (l'unité de sa phrase), jamais à celle du moteur — on ne crée pas un arbitrage maison pour rustiner un artefact de décomposition interne (précédent : lastApproachKey, Peur/approche)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-09T19:10:51.325Z
---

Verbatim utilisateur (2026-08-09+, #1117 L2, à propos du garde `lastApproachKey` « 1 Test par Tour de la source ») :
> « Moi ce que je veux, c'est du RAW. La tu m'as donné une réponse "Moteur" qui a amené a un arbitrage qui n'aurait jamais du existait, personne ne parle en "dois je faire un jet pour chaque pas/metre/segment vers moi qu'il fait vers moi" »

Le cas : LDB 21 l.27 « Si la source de votre Peur se rapproche de vous… » — le moteur décompose les déplacements en segments, chaque segment déclenchait le Test, et un garde-clé (`round:tour`) « arbitrait » la cadence. L'arbitrage rustinait un artefact de NOTRE décomposition, pas un silence du RAW.

**Why:** quand une phrase RAW est écrite à l'échelle de la table (un déplacement, une rencontre, une nuit), son unité d'événement EST cette échelle. Un moteur qui travaille plus fin (segments, ticks) doit AGRÉGER avant d'évaluer le prédicat de la règle — pas évaluer au grain fin puis déduire un garde « maison ». Un arbitrage règle-7 ne se justifie que face à un vrai silence du livre, jamais face à un artefact d'implémentation.

**How to apply:**
1. Avant de taguer « arbitrage maison » sur une cadence/fréquence : demander « le livre a-t-il déjà une unité d'événement dans sa phrase ? » (le déplacement, le Round, la rencontre). Si oui → définir le déclencheur à CETTE unité (ex. : position de la source avant/après SON déplacement complet ; plus près → un Test), et l'arbitrage disparaît.
2. Les gardes anti-spam keyés (`lastXKey`) sont un symptôme : chercher l'agrégation d'événement qui les rend inutiles.
3. Ce principe s'ajoute au test de la règle 7 : « le livre laissait-il le choix ? » se pose APRÈS « notre découpage a-t-il créé la question ? ».
