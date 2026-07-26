---
name: feedback-concis-pas-haiku
description: "Code concis, zéro commentaire inutile, noms de bouton COURTS — « j'ai l'impression d'utiliser haiku »"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9a11e89d-0497-4b0f-9249-26b8c86eb6bd
---

L'utilisateur, agacé, en pleine session de modales : « **arrête avec les commentaires INUTILES ! J'ai l'impression d'utiliser haiku !** Tu ne va pas mettre () sur toutes les sources possibles et inimaginables » ; et « **si tu mets des noms de bouton à rallonge, ça casse l'affichage** ».

**Why:** la sur-explication (commentaires verbeux, énumération entre parenthèses de chaque source/cas) dilue le code et le ralentit ; les libellés de bouton longs cassent la mise en page des modales (`modal-actions` flex).

**How to apply:**
- Commentaires : seulement quand le *pourquoi* n'est pas évident. Pas de paraphrase de la ligne, pas de liste exhaustive de sources entre parenthèses. Une réf RAW suffit (`LDB 17 l.62`), pas dix.
- Boutons : libellés COURTS — « Subir », « ✊ Détermination (2) », « + Vendre », « 🛡️ Dévier (−1 PA) ». Jamais une phrase.
- Messages/réponses : lean, pas de padding. Recommander, pas survoler toutes les options.

Prolonge [[feedback-no-padding-status]] et [[git-commits-propres-wip-parallele]].
