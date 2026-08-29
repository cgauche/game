---
name: implantation-proportions-avant-positions
description: "L'utilisateur juge une implantation aux PROPORTIONS des meubles vs le plan source, pas aux positions exactes — et un jugement visuel non mesuré est interdit"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 64ff102c-858d-4a48-8874-499544f67ec4
  modified: 2026-08-24T14:10:22.587Z
---

Chantier mobilier Diligence, 2026-08-24 (verbatim) : « Je m'en fiche que les tables et les chaises ne sont pas exactement au même endroit, tant que les proportions sont proches, mais les tables murales sont pathétiques en terme de taille par rapport a celui du plan. » Et sur ma « validation » du bar à l'œil sur une miniature : « tu dois avoir des mauvais yeux pour valider le bar ». Enfin : « si tu es trop aveugle pour le voir, c'est que l'éditeur n'offre pas les moyens d'afficher mieux et que c'est un défaut ».

**Why :** Le critère de fidélité d'une implantation ([[feedback-la-carte-decide-le-moteur-suit]]) est d'abord DIMENSIONNEL : l'emprise de chaque meuble en cases vs le dessin. Une position à ½ case près est tolérée ; une table à 50 % de la taille du plan ne l'est pas. Et mon « ça colle » énoncé sur une vignette basse résolution est une affirmation non mesurée — la même faute que les claims d'agents que je contre-grep.

**How to apply :** (1) Jamais de verdict « calé / colle » sur une superposition sans MESURE (pixels → cases via le pas de grille, comparés aux dimensions des recettes `props.json`). (2) Toute passe de recalage commence par les EMPRISES (ratios meuble source/meuble rendu), les positions ensuite. (3) Si le jugement visuel est impossible avec l'outillage courant, c'est un DÉFAUT D'OUTILLAGE à traiter (calque de référence dans l'éditeur), pas une excuse.
