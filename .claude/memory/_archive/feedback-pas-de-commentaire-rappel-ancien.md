---
name: feedback-pas-de-commentaire-rappel-ancien
description: "Ne JAMAIS commenter en rappelant l'ancien fonctionnement (« anciennement X », « remplace Y », « X a disparu ») — confusion inutile ; commenter le présent."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2bd0b898-fab8-47a8-b273-3403aa017410
---

L'utilisateur (2026-06-19) : « Il faut nettoyer les commentaires qui ne sont pas utiles. **Rappeler l'ancien fonctionnement n'apporte que de la confusion.** » Déclencheur : un agent avait laissé des commentaires de migration (« Mâchoires d'acier — anciennement `hasStunSave` — est devenu… », « L'applier 'steelJaw' a disparu : … ») que j'avais jugés « acceptables ». Ils ne le sont PAS.

**Why:** un commentaire qui décrit ce qui N'EST PLUS oblige le lecteur à reconstruire un état périmé du code pour comprendre le présent — pur bruit. Le code raconte ce qu'il FAIT, pas son historique (git le fait).

**How to apply:** commenter UNIQUEMENT le comportement/la raison ACTUELS (« pourquoi ce choix non-évident »). Bannir : « anciennement / avant c'était / remplace l'ancien / X a disparu / ne sert plus / jadis ». Quand on supprime du code, on supprime AUSSI le commentaire — on n'en pose pas un qui annonce la suppression. Garder les commentaires qui expliquent un choix structurel non-évident (TDZ/cycle, anti-récursion, fidélité RAW avec ref `LDB`). Prolonge [[feedback-concis-pas-haiku]] (« zéro commentaire inutile »).
