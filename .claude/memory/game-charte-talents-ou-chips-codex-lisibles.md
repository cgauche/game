---
name: game-charte-talents-ou-chips-codex-lisibles
description: "Charte créateur : un « Talent A ou B » = chips SÉPARÉES codex-liées (jamais une chaîne fusionnée), et JAMAIS le style pointillé gris-sur-noir pour « au choix / à choisir plus tard » — même les talents aléatoires ont un codex"
metadata: 
  node_type: memory
  type: project
  originSessionId: adfd4529-35c1-4ae9-85da-f959f7971274
---

Arbitrage utilisateur 2026-07-14, verbatim (erreur « énormément répétée » sur la maquette,
non corrigée là-bas car la planche HTML n'est pas mutualisée — la correction vit dans les
PRIMITIVES) : « évite vraiment le style pouitillé + texte gris sur noir, ce n'est pas
lisible. Et de toute facon, comme l'ancienne interface, un talent ou doit afficher les
différents talents séparé de ou sinon impossible de voir leur description, et même les
talents aléatoires ils ont un codex ... »

**Règles de rendu (DetailFrame, fiche vivante/CreatorSummary, rubriques de dotation,
plaques de talents) :**
1. « Talent A ou Talent B » = chips INDIVIDUELLES (EntityChip/CodexRef, popover de
   description fonctionnel) séparées par un « ou » typographique — JAMAIS une chaîne
   fusionnée illisible et non-cliquable.
2. L'état « au choix / à trancher plus tard » reste LISIBLE : contraste plein + badge
   (« choix à l'étape 5 ») — JAMAIS bordure pointillée + texte gris sur noir.
3. Les talents ALÉATOIRES (« 3 au d100 ») aussi : l'affordance codex existe pour la
   notion (chip vers l'entrée codex du tirage/talent une fois rendu) — pas de placeholder
   mort.
À transposer dans docs/charte-ui.md au premier lot concerné (pilote Race #393).
La planche HTML porte l'erreur partout — elle prend sa retraite, ne pas la copier
aveuglément sur ce point (le « compare à la maquette » de l'utilisateur vaut pour le
STYLE global, cet arbitrage PRIME sur la maquette pour les talents).

⚠ Précision utilisateur (même jour) : « C'est ce qu'on fait deja dans le creator
actuel » — le créateur EN CODE fait déjà bien (chips séparées codex-liées :
TalentChip/SkillChip via EntityChip, cf. CreatorSummary/CharacterCreator). C'est la
MAQUETTE qui a régressé. Le pilote Race doit donc PRÉSERVER le comportement existant
(réutiliser EntityChip/CodexRef tels quels), pas le réinventer — toute conversion
d'écran qui perdrait les chips codex au profit du rendu maquette = régression.
Complément : « Oui enfin en coulant avec le nouveau style graphique » — le COMPORTEMENT
est l'existant, la PEAU est la charte Atelier : c'est EntityChip/CodexRef qui se
restylent aux tokens (chip = référence, lisible, plein contraste), pas un rendu parallèle.
