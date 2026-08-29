---
name: feedback-invariant-cite-verbatim-jamais-depuis-un-rendu-de-juge
description: "Déviation 2026-08-23 (#1426) : j'ai pris la LECTURE d'un juge (« OFF = silence » = pas de rangée) pour l'invariant, et conçu un seam spécial « monde » — contraire à #939 « SANS nouveau système de jet ». Un invariant se recopie VERBATIM depuis le ticket/la doctrine avec son contexte de question ; un design qui branche sur le TYPE de porteur (monde vs héros) est un drapeau rouge par construction."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2a421ddf-a409-4ee5-990e-1d565fe6bd4f
  modified: 2026-08-24T14:45:48.707Z
---

LOI GÉNÉRALE (2026-08-24, après récidive — user : « tu me revalide du code qui ne remplis pas nos
objectifs » puis « La mémoire devient une véritable poubelle. Le soucis ne se citue pas la ») :
l'autorité descend d'UNE chaîne — doctrine utilisateur > RAW > mesure. TOUT dérivé (rendu de juge,
ticket que j'écris, `why` de whitelist, JSDoc, mon propre design) ne VALIDE rien : il se re-mesure
contre la chaîne avant d'entrer dans un brief, une réponse ou un tableau d'état — l'écart contre
l'OBJECTIF en tête, jamais la cohérence interne du code comme réponse. Le verrou de cette classe est
STRUCTUREL (portes de refus, lentilles imposées), pas une fiche de plus.

Vécu 2026-08-23, reprise #1426 volet maritime. Le juge DoD rend « invariant (2) violé : la fenêtre
existe option OFF ; l'arbitrage utilisateur dit OFF = silence ». Je dispatche un seam
`if (worldOwner && !poseOfferte) → résoudre d'office` : les dés de monde disparaissent de la fenêtre
quand l'option est éteinte. Utilisateur : « Tu es effrayant » / « biensur que tu l'affiche ! On affiche
les jets de maladresse, de critique, alors pourquoi tu voudrais ne pas afficher les jets de météo si
je controle l'environnement ? » / « c'est le même code qu'on soit sur un jet d'environnement ou de
personnage ? Sinon tout notre travail aura servi a RIEN ».

**Why :** (1) grounding de seconde main — la phrase « OFF = silence » répondait à « faut-il ouvrir
une fenêtre de POSE ? », pas « faut-il afficher le jet ? » ; le juge l'a généralisée, je l'ai
recopiée comme invariant. (2) L'invariant réel était écrit (#939 « SANS nouveau système de jet »,
ticket (1) « possession et surface dérivées du MÊME prédicat ») et je ne l'ai pas confronté à mon
design. (3) Le rouge des tests (cascade bloquée en headless) m'a poussé à un design au lieu de
demander « comment fait un héros ? » (rangée + Lancer ; le headless tire lui-même).

**How to apply :**
- Avant tout dispatch de design, recopier l'invariant VERBATIM depuis le ticket/la doctrine avec la
  QUESTION à laquelle le verbatim répondait — jamais depuis un rendu de juge/lecteur.
- Toute branche sur le TYPE de porteur (`worldOwner`, `isWorld`, `kind === …`) dans un socle est un
  drapeau rouge : la question canonique est « que fait le héros dans le même cas ? » et la réponse
  doit être le MÊME code.
- Un test qui bloque en headless se lit d'abord « le pilote de test manque un geste » avant
  « le flux doit changer ».
Lié : [[user-arbitrage-de-de-monde-affiche-comme-un-critique]],
[[feedback-brief-fait-autorite-grounding-seconde-main]],
[[feedback-test-rouge-apres-refonte-reecrire-depuis-le-contrat]].
