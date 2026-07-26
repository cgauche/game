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

**Why:** le RAW compte la monnaie dans l'Enc INDIVIDUEL (LDB 61, 1 Enc/200 pièces) et le jeu ne
connaît pas d'inventaire de GROUPE — tout objet va sur un héros (CLAUDE.md pièges connus). Une
bourse commune contredirait les deux.

**How to apply:** la monnaie vit PAR HÉROS, portée par défaut dans sa bourse-TRAPPING — une
instance `ItemInstance` du trapping `bourse` dans `Combatant.items`, champ `money` (SOCLE
POSSESSIONS §8, #531). Toute somme entrée/sortie est une ALLOCATION sur une ou plusieurs bourses
(la bande peut se cotiser, le bénéficiaire d'un achat est indépendant des payeurs) : primitives de
`src/state/bourseFlow.ts` (`bourseInstanceOf`/`ensureBourse`/`payWithAllocation`), jamais une
écriture directe. L'Enc de monnaie se DÉRIVE du contenant porté (`itemsEncumbrance`/
`totalEncumbrance`, `src/engine/items.ts` : 1 Enc / 200 PIÈCES — le NOMBRE de pièces, pas leur
valeur en sous, LDB 61 l.29), jamais un compteur parallèle — cet arbitrage **débloque #470**
(Encombrement : monnaie et passager non comptés, LDB 61 ; OUVERT). « Par défaut » = un autre contenant/
porteur reste possible (selles de monture, #395). Toute surface « Bourse » de groupe est DÉRIVÉE
(somme) ou par-héros. Voir aussi [[user-arbitrage-vocabulaire-campagne]] (même session
d'arbitrages).
