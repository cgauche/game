---
name: feedback-signalement-de-defaut-nest-pas-correction-de-spec
description: 2026-08-17 — j'ai lu « pas de zone visible pour les états » comme une correction du dessin et j'ai fait RETIRER une feature voulue ; c'était un signalement de DÉFAUT (« Plutôt rien faire que tu saboter le projet !!! »)
metadata:
  type: feedback
---

Incident 2026-08-17 (chantier HUD #1349). L'utilisateur écrit : « il y avait bien les
valeurs mais par contre pas de zone visible pour les etats ». Je le lis comme une
RE-VÉRIFICATION du spécimen (« le dessin n'a pas de zone d'États ») et je fais RETIRER la
niche d'États que le codeur venait de construire — plus le hasard d'un bug (gouttière 0/0
rendue null) : la capture suivante montre DEUX éléments en moins. Réaction : « What !!!!!!
Je te dit qu il n y a pas de zone d état et c est un défaut dans l arche et toi tu me vire
ainsi que la barre de déplacement ? Plutôt rien faire que tu saboter le projet !!! »

**Why:** Une phrase d'utilisateur qui constate une ABSENCE est ambiguë entre « ça manque
(défaut à corriger) » et « ça ne doit pas exister (correction de contrat) ». J'ai choisi le
sens qui ANNULAIT du travail fraîchement livré sans me méfier — or inverser un contrat sur
une seule phrase ambiguë a détruit une feature voulue.
**How to apply:** Quand une phrase user peut se lire comme signalement de défaut OU comme
inversion de contrat : (1) si les deux lectures mènent à des gestes OPPOSÉS (construire vs
détruire), re-demander en une ligne AVANT d'agir ; (2) par défaut, la lecture « c'est un
défaut, ça manque » PRIME quand la feature est dans le dessin/spécimen d'origine ; (3) ne
jamais détruire du travail tout juste livré sur une seule phrase sans confirmation. Voir
[[feedback-reflechir-avant-de-reagir]] et [[feedback-questions-via-outil-askuser]].
