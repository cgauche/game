---
name: feedback-registre-fossiles-transition
description: "Reconstruction morceau-par-morceau : tout shim de transition s'inscrit AU REGISTRE à sa création avec sa mort planifiée ; clôture de phase = passe juge « architecture à rebours » ; cliquets de migration temporaires, jamais de garde anti-résurrection post-mortem."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5d129c4b-c665-4e81-9389-8f4edf55ae2a
  modified: 2026-08-09T15:31:02.992Z
---

Directive utilisateur (2026-08-09, chantier moteur WebGL #1176, verbatims) : « Souvent quand on détruit et reconstruit morceau par morceau, on a tendance a garder des morceaux/structure de l'ancien pour s'y connecter, et qui survivent a la fin. Le code si on avait recommencé de 0 ou basé sur l'ancien peuvent etre bien différent » — et sur les gardes : « pourquoi on aurait besoin de guard qui vérifie que les codeurs ne vont pas s'amuser a recréer l'ancien moteur ? »

**Why :** les points de branchement gardés « le temps de la transition » se fossilisent parce que personne ne se souvient qu'ils étaient provisoires ; et une garde anti-résurrection sur du code supprimé est un test-tombale (cf. [[feedback-tests-tombale-contrat-positif]]).

**How to apply :**
- Tout compromis de transition s'inscrit AU REGISTRE (commentaire du ticket-mère du chantier, cf. #1176 « REGISTRE DES FOSSILES ») À SA CRÉATION, avec la phase qui le tue. Un shim non enregistré découvert plus tard = bug.
- Chaque clôture de phase : passe de juge « ARCHITECTURE À REBOURS » — « si on partait de zéro avec la cible d'aujourd'hui, cette couture existerait-elle ? ».
- Cliquets de migration = échafaudage : ils naissent avec la vague de démolition et se SUPPRIMENT dans le commit de la dernière démolition. Après : seuls les contrats POSITIFS du nouveau système restent (fidélité pixel, gardes de planche, pivot obligatoire) — jamais une garde qui nomme l'ancien monde.
- Clôture de chantier : chasse aux cicatrices dans la DONNÉE (contournements authorés pour ruser avec l'ancien comportement) ; les docs d'architecture se réécrivent depuis la cible, jamais s'amendent depuis l'ancienne.
