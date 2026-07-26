---
name: feedback-fidelite-raw-et-editabilite-non-negociables
description: "Un ticket « fermé » ne suffit pas — fidélité RAW intégrale ET contenu authorable dans l'éditeur sont exigés, les raccourcis « borne le reste » sont des défauts à débusquer."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cc3c50b6-6b95-4bfa-87ec-88d29228f1d4
---

Sur un sous-système livré vite (mantra agent « livre le cœur, borne le reste »), l'utilisateur exige DEUX choses non négociables, au-delà de « les tests passent / le ticket est fermé » :

1. **Fidélité RAW intégrale** (règle 1). Toute réduction/simplification par rapport au livre est un défaut, pas un choix. Ex. combat de masse #69 (ADE II ch.8) livré à ~50% : Duel modélisé en simple Test au lieu d'un vrai combat de généraux ; « une seule Scène cinématique par Round » alors que le RAW veut une Scène par PJ ; menu complet de Scènes proposé à chaque Round au lieu d'une **situation** par Round (Scènes du moment + Scènes ennemies qui s'imposent). Ces raccourcis passent les tests mais trahissent le livre.
2. **Éditabilité first-class** (règle 2). Un sous-système lançable seulement via action de store / recette `__wfrp` / scénario codé n'est PAS fini : il doit être **authorable dans l'éditeur** (Effet dans l'union `Effect` de scene.ts + handler applyEffects + édition EffectList/GameOpEditor, données via RefField/StructFields). But de l'user : « pouvoir éditer tout cela pour le **scénariser** en suivant les règles ». Un agent qui évite scene.ts pour cause de session parallèle laisse une feature non éditable — dette à combler, pas acceptable en l'état.

**Why** : vider le backlog GitHub (39 issues, cette session) a poussé les agents au plus court ; l'utilisateur, en creusant à la main (« l'ennemi fait des actions ? on peut éditer ça ? »), a trouvé des gaps que les rapports d'agents passaient sous silence — et rappelé « tu ne m'en as remonté que 2, il y en a sûrement plein d'autres ».

**How to apply** :
- Ne jamais clore « fidèle » sur la foi d'un rapport d'agent : lancer un **audit adversarial lecture-seule** qui compare l'impl au RAW ligne à ligne et classe FIDÈLE/RÉDUIT/FAUX/ABSENT (cf. [[credo-exemples-calibrants]]).
- Pour tout nouveau sous-système jouable, vérifier d'emblée qu'il a un **Effet authorable** + son édition, et un **scénario de test jouable** atteignable depuis le menu (cf. [[feedback-affordance-morte-signaler]]).
- Étendre le crible « conforme au livre ET authorable » aux autres gros sous-systèmes livrés vite (naval, jeux de taverne, commerce, interlude), pas seulement à celui que l'user pointe.
