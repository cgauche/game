---
name: user-arbitrage-raison-de-refus-au-survol-jamais-inline
description: "La raison d’un refus vit au SURVOL/focus, jamais en texte inline sous le nom d’une capacité"
metadata:
  node_type: memory
  type: user
---

Verbatim utilisateur (2026-08-24) : « Je n’ai jamais validé ces "textes" impossible a lire sous le nom des capacités, même Rogue Trader qui est notre interface de départ n’a pas un tel comportement. »

**Why:** une bande de raison permanente sous le libellé est illisible et absente de l’interface de référence, qui met la raison d’un slot désactivé dans l’infobulle.

**How to apply:** la case ou la pastille indisponible reste propre (icône, libellé, touche, état grisé) ; la raison vit dans l’infobulle de survol/focus avec `aria-describedby` — vaut pour la console, les pastilles d’entité et la frise.
