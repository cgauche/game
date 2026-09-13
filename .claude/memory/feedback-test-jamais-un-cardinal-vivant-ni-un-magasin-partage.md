---
name: feedback-test-jamais-un-cardinal-vivant-ni-un-magasin-partage
description: "Un test committé n'asserte jamais un CARDINAL VIVANT du dépôt, ne lit pas un magasin PARTAGÉ et ne mute pas un registre importé — fixture synthétique + invariant"
metadata:
  node_type: memory
  type: feedback
---

Un test asserte une RÈGLE sur une fixture nommée, et sur le corpus réel seulement un INVARIANT
stable. Interdits : le cardinal vivant (taille d'un stock réel, nombre de fichiers d'un magasin), la
lecture d'un magasin partagé entre sessions, la MUTATION en place d'un registre importé, et la
PHOTOGRAPHIE d'une donnée éditable (comptes de murs, de pièces, de scènes d'une carte). Un chiffre
vivant s'imprime en message de diagnostic, jamais dans l'assertion.

**Why:** ces valeurs changent par le travail NORMAL d'une autre session ou de l'utilisateur qui édite
sa carte : le test rougit sans défaut, et son rouge s'attribue au mauvais commit.

**How to apply:** un test qui a besoin d'un régime le POSE lui-même par le seam prévu sur une fixture
et le restaure ; une fenêtre de commits à shas FIGÉS est une fixture, un stock réel à HEAD ne l'est
pas ; une contre-épreuve sur le magasin réel est une SONDE jouée au rendu, pas un test de gate.
