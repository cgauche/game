---
name: feedback-emoji-morts-definitif
description: "Les EMOJI sont morts PARTOUT dans le produit — arbitrage définitif, AUCUNE nouvelle décision à demander, tout « hors périmètre » sur un emoji = faute"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: adfd4529-35c1-4ae9-85da-f959f7971274
---

2026-07-13, après qu'un commit a requalifié les emoji du journal de combat en « arbitrage
en attente » (#403) : « y'a pas d'arbitrage, on a deja indiqué la mort des emojis, c'est la
5ieme fois qu'on me dit que c'est hors périmetre ... et 5ieme fois que je dis que je ne
veux plus d'EMOJI !!! »

**Why:** l'arbitrage est rendu depuis #139 et répété 5 fois. Chaque fois qu'un agent classe
un emoji « hors périmètre » ou que je le transforme en question, l'utilisateur doit se
répéter — c'est exactement l'érosion de confiance que le mandat interdit.

**How to apply:** un emoji rencontré N'IMPORTE OÙ dans le produit (UI, i18n, journal,
données, scènes, engine, logs joueur) se PURGE dans le geste, sans question — remplacé par
une icône du registre (`<Icon>`) si l'affordance en exige une, par du texte nu sinon.
Aucun brief de codeur ne doit borner la purge d'emoji à un périmètre ; tout rendu d'agent
qui dit « emoji hors périmètre » = recalage immédiat. La garde `no-emoji-affordance`
couvre TOUT src/ (étendue 2026-07-13). Cf. [[feedback-excuse-preexistant-documente]].
