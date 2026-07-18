---
name: user-arbitrage-bourse-personnelle-trapping
description: "Arbitrage 2026-07-16 — la monnaie est PERSONNELLE, par défaut dans la bourse du personnage, et la bourse EST un trapping"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b01212b8-6728-41cc-b726-ae207da81ef1
---

Arbitrage utilisateur (2026-07-16, verbatim) : « Pour la bourse, c'est personnel et par défaut
ça doit être dans… la bourse du personnage. Oui c'est un trapping. »

**Why:** le modèle courant est une bourse de GROUPE (affichage ScreenMeta « Bourse », crédits de
loot « déjà crédité à la bourse ») — le RAW compte la monnaie dans l'Enc INDIVIDUEL (LDB 61,
1 Enc/200 pièces) et le jeu vise « tout objet va sur un héros » (plus d'inventaire de groupe,
CLAUDE.md pièges connus). La monnaie suivait l'ancien modèle.

**How to apply:** la monnaie vit PAR HÉROS, portée par défaut dans sa bourse-TRAPPING
(Combatant.items — l'entrée bourse existe au catalogue LDB) ; l'Enc de monnaie se dérive du
contenant porté via le système existant (totalEncumbrance/inside), jamais un compteur parallèle.
« Par défaut » = un autre contenant/porteur reste possible (selles de monture, #395). Toute
surface « Bourse » de groupe devient DÉRIVÉE (somme) ou migre par-héros. Chantier ouvert le jour
même (voir ticket) — débloque #470. Voir aussi [[user-arbitrage-vocabulaire-campagne]] (même
session d'arbitrages).
