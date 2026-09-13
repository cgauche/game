---
name: game-campagne-json-portable-frontiere-reference-narratif
description: "Une campagne = JSON portable auto-suffisant ; frontière RÉFÉRENCE (règle globale, feuilletable) vs NARRATIF (embarqué, révélé seulement)."
metadata:
  node_type: memory
  type: project
---

Directive utilisateur (2026-07-22) : « Les campagne sont éditable et on doit pouvoir échanger un fichier json pour l'intégrer en local, ne l'oublie pas ».

**Why:** du contenu d'histoire posé dans `src/data` global ne voyage pas à l'export ET fuite au Compendium — double faute (spoiler et non-portabilité).

**How to apply:** test « pareil dans TOUTE campagne, ou propre à CETTE histoire ? » — la règle (créatures génériques, sorts, talents, carrières) vit dans `src/data` et se référence PAR ID ; l'histoire (méchants nommés et leurs surcharges, indices, documents, dialogues, scènes, carte) s'embarque dans le projet de campagne (`src/state/campaignNarratif.ts`), s'édite en contexte AUTEUR et ne se révèle que par la rencontre.
