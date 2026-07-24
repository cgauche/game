---
name: feedback-bug-existant-trouve-se-traite-pas-juste-ticketise
description: "Un bug existant trouvé se TRAITE, pas seulement se ticketise — surtout s'il est adjacent au geste courant."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fe865f02-512f-45e7-8886-1a0ed51e079b
  modified: 2026-07-23T22:49:29.161Z
---

Quand un grounding / un juge / une recette met au jour un bug EXISTANT (même hors du périmètre initial), le ticketiser ne suffit PAS : il faut aussi le CORRIGER. Le ticket sert à ne rien perdre ; il ne dispense pas de traiter.

**Why:** verbatim user 2026-07-24, après que j'aie ouvert #788 (débordement étiquette) et #790 (coupe-de-coin cross-couche) puis les aie parqués sans les corriger : « Si tu vois des bugs existant, faut les mettre en ticket et les traiter non ? ». Un bug logué-mais-non-traité, surtout adjacent au code qu'on vient de modifier, est de la dette qu'on avait sous la main.

**How to apply:** un bug trouvé → ticket (gabarit + labels) ET fix dans la foulée, prioritairement s'il touche la fonction/le fichier du geste courant (coût marginal faible, contexte chaud). Ne différer QUE le vraiment subjectif (arbitrage de goût, à caler sur un vrai cas) ou le hors-sujet lourd — et le dire explicitement, pas par omission. Complète [[feedback-jamais-de-constat-silencieux]] (qui exigeait le ticket) : la barre est ticket + traitement, pas ticket seul.
