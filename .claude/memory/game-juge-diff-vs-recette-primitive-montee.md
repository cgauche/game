---
name: game-juge-diff-vs-recette-primitive-montee
description: "Un juge de DIFF valide qu'un composant UI COMPOSE bien les primitives ; seule la RECETTE runtime prouve que le joueur le VOIT — une feature peut être câblée sur une primitive que l'écran joueur ne MONTE pas (vécu #572 : rubrique Traits sur HeroSheet, mais la Fiche complète avait son propre FicheBody, invisible)."
metadata: 
  node_type: memory
  type: project
  originSessionId: b7898333-a7b3-4cc0-9fb5-ae369c234e88
---

Vécu 2026-07-17, #572 (rubrique Traits de la fiche héros). Le juge d'ARCHITECTURE a rendu CONFIRMÉ : `TraitChip`/`TraitChips` composent bien le patron `EntityRef`/`QualityChip`, masquage correct, zéro leak. Mais la RECETTE navigateur (walk-through joueur) a réfuté la VISIBILITÉ : le chip était câblé dans `HeroSheet`, primitive JAMAIS montée dans le parcours joueur réel — la « Fiche complète » (`CharacterSheet`/`FicheBody`), la Présentation et le popup avaient chacun leur propre corps, `HeroSheet` n'était monté que dans le picker de candidats pré-tirés (sans ogre). Un PJ ogre ne voyait donc JAMAIS son trait racial, malgré un composant parfaitement composé.

**Why** : un juge de diff raisonne sur le composant en isolation (compose-t-il les bonnes primitives ?). Il ne trace PAS quel ÉCRAN monte ce composant dans le flux réel. « La primitive canonique existe et est bien composée » ≠ « l'écran que le joueur ouvre la rend ». C'est exactement l'angle mort que la recette runtime (clics joueur, écran par écran) couvre — cf. [[feedback-rendu-ui-sans-preuve-navigateur-refuse]], [[feedback-personne-ne-lit-le-journal]] (surface VISIBLE).

**How to apply** :
- Toute feature UI se prouve par une RECETTE qui OUVRE l'écran que le joueur utilise vraiment — jamais par un juge de composition seul. Le brief de recette nomme l'écran-cible du parcours joueur (« Fiche complète », pas « le composant HeroSheet »).
- Quand une primitive canonique (`HeroSheet`) est composée par PLUSIEURS écrans, vérifier lesquels la montent AVEC la donnée concernée — un `sections=[...]` restrictif au niveau appelant (`CharacterSheet:320`) peut masquer une rubrique pourtant présente dans la primitive.
- Corollaire rebase : après une refonte d'écran par une session // (ici « fiche v4 » : `CharacterSheet` finit par composer `HeroSheet`), ré-appliquer une addition UI sur la PRIMITIVE canonique (HeroSheet), pas sur le site obsolète (l'ancien FicheBody), et re-prouver le rendu sur l'écran refactoré.
