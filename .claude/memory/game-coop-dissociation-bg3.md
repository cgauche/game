---
name: game-coop-dissociation-bg3
description: "Arbitrage user 2026-07-19 — cap coop structurel : chacun gère SON inventaire, intents par propriétaire, viser la dissociation des personnages façon BG3 ; jamais un nouveau miroir-hôte."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 28c73772-f9e8-48df-97c3-237da1659a39
  modified: 2026-07-19T20:48:50.530Z
---

**Arbitrage utilisateur (2026-07-19, verbatim)** : « l'hôte ne doit pas pouvoir tout faire au
marchand. Chacun gère SON inventaire au marchand. Un jour en mode coop l'hôte perdra son autorité
et les personnages seront dissociés, donc pense dans cette optique dès maintenant, comme dans
BG3. »

**Why** : la coop actuelle est un miroir-hôte hors combat (`src/net/intents.ts` — marchand/voyage/
hub refusés aux invités). Chaque nouvelle surface bâtie en miroir-hôte devra être re-démolie quand
les personnages seront dissociés.

**How to apply** : toute NOUVELLE surface qui touche l'inventaire, la bourse ou les possessions
d'un héros se conçoit en intents PAR PROPRIÉTAIRE (patron `INTERLUDE_INTENTS`, gate
`intentAllowedFor`) dès sa création — l'hôte reste l'autorité TECHNIQUE (relay), pas l'autorité
PRODUIT sur les biens d'autrui. Seul le propriétaire ALIÈNE (vend/abandonne/transfère) sa
possession. Premier périmètre livré par #619 ; programme complet : #627. Voir
[[game-socle-possessions-programme]].
