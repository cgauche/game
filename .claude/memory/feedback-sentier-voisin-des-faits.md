---
name: feedback-sentier-voisin-des-faits
description: "Un défaut trouvé dans le périmètre d'un AUTRE chantier ouvert se dépose en FAITS mesurés sur SON ticket, après lecture de son fil entier — jamais une clause, un régime de garde, un ordre de trains, ni un contournement committé de son côté"
metadata:
  node_type: memory
  type: feedback
---

Verbatim utilisateur (2026-09-20, vague 5e #1816, devant une « clause de format » postée sur #1739 sans avoir lu son fil) : « On a un vrai chantier dans l'épique sur les sources, il faut absoluement éviter de le saboter en prenant des décisions contradictoires » — précédé de « On avait pas deja un ticket du genre ? ».

**Why:** le sentier voisin a DÉJÀ tranché des choses que le symptôme ne montre pas (ici #1739 : garde `check-source-format` à stock nominatif, « FORME jamais SENS », ordre des trains qui « vit ICI »). Une proposition écrite depuis l'extérieur a la forme d'une décision ; deux sessions finissent par appliquer deux règles. Et la déduplication faite sur le SYMPTÔME (`sectionsOf`, H1) rate le ticket qui porte le REMÈDE (« format unifié des extractions »).

**How to apply:** avant d'ouvrir un ticket, dédupliquer par le symptôme ET par le remède ; devant un défaut hors de son chantier, lire le corps ET tous les commentaires du ticket propriétaire, puis y déposer l'arbitrage verbatim daté, les faits mesurés (commande + sortie) et des QUESTIONS — rien d'autre. Ne rien committer de son côté qui préempte sa réponse (un contournement par livre, une garde au régime différent) : garder l'option MESURÉE au ticket, arbre remis à l'état publié. Voir [[user-doctrine-format-unifie-reextraction-permise]], [[feedback-audit-nest-pas-ordre-de-travail]].
