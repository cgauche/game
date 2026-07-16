---
name: feedback-personne-ne-lit-le-journal
description: "Règle user (2026-07-09) : « partir du fait que personne ne lit le journal » — un dénouement (test réussi, fin de dialogue, événement) se MONTRE au moment où il se produit ; le journal n'est qu'une archive, jamais le canal principal d'une récompense narrative."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dcfa9f52-337e-40a6-9036-fb84db19e703
---

**Règle utilisateur (playtest étalon naval, 2026-07-09)** : « J'ai plein de dialogues qui finissent en rien… car tu mets tout dans le journal. Faut partir du fait que personne ne lit le journal. »

**Why :** dans l'étalon, les dénouements de tests de dialogue (ex. Intuition réussie sur Kramer → « Elle cache quelque chose ») étaient authorés en `{type:'journal'}` — le joueur réussissait un jet et ne VOYAIT rien : l'expérience = « le dialogue finit en rien ». Le journal est une archive de bord, pas une scène.

**How to apply :**
- Authoring : le payoff d'un choix/test/beat = une surface VISIBLE au moment (réplique de dialogue conditionnelle, texte de révélation/narration à l'écran) ; `journal` en DOUBLON d'archive, jamais seul.
- Moteur : l'auteur doit disposer d'un Effect de narration visible ; instruire pourquoi la remontée [[game-journal-non-lu-remonter-en-modale]] n'a pas suffi dans ce run.
- Recette : « le joueur a-t-il VU sa récompense sans ouvrir le journal ? » devient un critère de passe.

Règle sœur du même soir : « aucun jet ne doit être silencieux » ([[game-trigger-cadence-aware-no-silent]]).
