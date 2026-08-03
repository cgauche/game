---
name: feedback-verbatim-au-ticket-decision-au-code
description: "Le verbatim d'arbitrage vit sur le TICKET ; le commentaire de code énonce la DÉCISION + réf (date, #ticket), concis — jamais la citation conversationnelle brute"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-03T12:04:41.459Z
---

Un commentaire de code qui consigne un arbitrage utilisateur énonce la DÉCISION (la règle retenue,
formulée proprement) + sa réf (« arbitrage utilisateur AAAA-MM-JJ, #ticket ») — le VERBATIM
conversationnel vit sur le TICKET, où la traçabilité l'exige. Et le commentaire se limite à ce qui
sert le lecteur du site : concis, pas exhaustif.

**Why :** feedback 2026-08-03 (deux verbatims) : « S'il te plait, mon verbatim c'est pour te pousser
vers une reflexion, ca fait buzarre cette phrase reprise tel quel » (la citation « On me dit
que... » collée telle quelle dans combatSlice) et « Tu met beaucoup trop de détails. Il faut etre
conscis et surtout limité a ce qui nous interesse » (rollFlowSpecs:89). Ses messages sont des
impulsions de réflexion, pas de la prose à archiver dans le code.

**How to apply :**
1. Au CODE : « <la règle décidée, une phrase> (arbitrage utilisateur AAAA-MM-JJ, #N) » + tag
   [entériné] si autorisé. Rien d'autre.
2. Au TICKET : le verbatim complet + la date (la règle CLAUDE.md « citation verbatim + date »
   s'accomplit LÀ — pas de perte de traçabilité).
3. La contrainte CLAUDE.md reste : un « arbitrage » SANS verbatim NULLE PART = évaluation
   d'ingénierie révisable — le ticket est le porteur obligatoire.
4. S'applique aussi aux citations d'options AskUserQuestion (les labels d'option) : décision
   reformulée au code, label exact au ticket. Cf. [[feedback-questions-via-outil-askuser]].
5. TOUT n'est pas un arbitrage (tri #136, 2026-08-03) : une décision UI/UX, un défaut de chantier
   inachevé, un confort de jeu (« pourrait même évoluer en option comme la cadence ») ne portent NI
   le mot « arbitrage » NI de tag — commentaire d'ingénierie révisable (comportement + réf ticket).
   La cérémonie d'arbitrage est réservée aux RÈGLES DE JEU sur silence/choix du RAW. Et un texte
   énonçant une règle adossée au RAW se formule dans le VOCABULAIRE du Source (« ça ne ressemble
   même pas au texte raw verbatim » — refus d'un énoncé en jargon de modale).
