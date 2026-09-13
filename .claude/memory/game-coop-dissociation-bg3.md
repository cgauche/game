---
name: game-coop-dissociation-bg3
description: "Coop — chacun gère SON inventaire (intents par propriétaire) ; la vue reste PARTAGÉE et un groupe scindé se joue en deux temporalités successives."
metadata:
  node_type: memory
  type: feedback
---

Arbitrage utilisateur (2026-07-19) : « l'hôte ne doit pas pouvoir tout faire au marchand. Chacun gère SON inventaire au marchand. Un jour en mode coop l'hôte perdra son autorité et les personnages seront dissociés, donc pense dans cette optique dès maintenant, comme dans BG3. »

**Why:** toute surface bâtie en miroir-hôte devra être re-démolie à la dissociation ; l'hôte est l'autorité TECHNIQUE (relay), jamais l'autorité PRODUIT sur les biens d'autrui.

**How to apply:** toute surface neuve qui touche inventaire, bourse ou possessions se conçoit en intents PAR PROPRIÉTAIRE (`src/net/intents.ts`, `intentAllowedFor`) — seul le propriétaire aliène ; un lieu ou un hub raisonne « quels héros sont ICI », jamais « le groupe est ici » ; la VUE reste partagée (un écran doit être regardable par un siège sans héros présent : spectateur riche, jamais un écran cassé) ; un groupe scindé = deux fils joués L'UN APRÈS L'AUTRE (patron suspend/resume de `src/state/cascade.ts`), pas de fenêtres multiples par siège.
