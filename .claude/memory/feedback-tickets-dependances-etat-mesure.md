---
name: feedback-tickets-dependances-etat-mesure
description: Un ticket porte ses dépendances explicites et son état mesuré — commenter les prémisses corrigées sur les tickets ouverts dans le même tour
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b01212b8-6728-41cc-b726-ae207da81ef1
---

Demande utilisateur (2026-07-16, session masse-de-tickets) : « Tu mets des dépendances entre tes
tickets ? Histoire que si un agent retombe dessus il ne refasse pas la même erreur ? » puis
« Pense à mettre à l'élément qui te sert à créer les tickets ce nouveau fonctionnement. »

**Why:** les rétro-liens GitHub automatiques ne portent ni le SENS de la dépendance ni les
prémisses corrigées ; un futur agent lit l'ISSUE, pas mes transcripts. Vécu le jour même :
#454/#434 avaient un état réel très différent de leur corps (défaut A à 0 %, garde Sens B
inexistante) — mesuré par un agent mais visible nulle part ; #445⇄#261 partagent un prérequis
de schéma que chacun aurait pu forker.

**How to apply:** règle institutionnalisée dans le CREDO (`Game/.claude/credo.md`, bullet
« Un ticket porte ses DÉPENDANCES et son ÉTAT MESURÉ ») + skill [[orchestrer-des-agents]]
(étape 6 : ce qu'un grounding/juge établit sur un ticket ouvert se commente dans le même tour).
À l'ouverture : « Bloqué par #N / Débloque #N / Prérequis partagé avec #N » dans le corps.
En cours : prémisse corrigée, état mesuré, dépendance découverte → `gh issue comment` immédiat.
Voir aussi [[feedback-jamais-de-constat-silencieux]].
