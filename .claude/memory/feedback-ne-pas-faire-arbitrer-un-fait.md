---
name: feedback-ne-pas-faire-arbitrer-un-fait
description: "Ne jamais faire trancher à l'utilisateur une question de FAIT (ça se mesure) ni une question que la DOCTRINE tranche déjà ; il n'arbitre que le produit et le goût"
metadata:
  type: feedback
---

Verbatims utilisateur : « Moi je n'en sais rien, c'est tes relevés » ; « Je ne fais pas vraiment de choix, j'ai juste cliqué sur "Recommander", tu connais les grands principes de l application » ; « en quoi ca demande une décision de ma part ? ».

**Why:** faire arbitrer un fait transfère MA vérification et fabrique un faux « arbitrage utilisateur » ; une réponse ainsi obtenue est une décision d'ingénierie révisable, jamais un verbatim de doctrine.

**How to apply:** classer avant de demander — FAIT (le RAW dit-il X ? ce champ a-t-il un lecteur ? quelle session est-ce ?) ⇒ mesurer (Atlas puis `Source/`, grep/AST, historique), y compris en relisant son propre fil ; PRODUIT / GOÛT / RISQUE ASSUMÉ ⇒ demander, avec le coût de chaque option. Test : « en retirant le bouton Recommandé, peut-il répondre autrement sans contredire une doctrine écrite ? ». Quand le texte du livre est explicite il n'y a AUCUNE question à poser ; une question nécessaire se pose tout de suite, groupée, jamais parquée dans une spec ; un ticket que J'ÉCRIS sur un socle porte sa section Invariant.
**Corollaire :** « le code ne fait pas ce que le livre dit » est une dette de FIDÉLITÉ à corriger (train dédié, tests réécrits depuis le contrat) — « ça change le RNG » n'est jamais un motif de renvoi, l'invariance RNG n'étant l'invariant que des trains de FORME et ne protégeant jamais un comportement faux.
