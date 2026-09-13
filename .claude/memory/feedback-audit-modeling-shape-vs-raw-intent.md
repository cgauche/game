---
name: feedback-audit-modeling-shape-vs-raw-intent
description: "Auditer la FORME de modélisation contre l'intention du RAW, pas seulement les valeurs de champs"
metadata:
  node_type: memory
  type: feedback
---

**Règle :** une feature dérivée du RAW s'audite sur sa FORME de modélisation (porté vs servi à un poste vs emplacé ; mobile vs fixe), pas seulement sur ses valeurs de champs.
**Why:** des stats RAW-parfaites peuvent porter un modèle faux qui contourne la règle, et aucune garde ne voit la forme — l'anti-excuse lit les commentaires, la garde d'ajout de donnée lit les champs.
**How to apply:** dériver la forme de l'intention (« Équipe N » ⇒ servi à un poste, jamais porté ; « sur roues » ⇒ mobile, jamais emplacement fixe) ; traiter tout « RAW ne l'exige pas / à notre sauce / pour simplifier » comme poison présumé et rouvrir au `Source/` ; un test vert sur un modèle faux se réécrit depuis le RAW.
