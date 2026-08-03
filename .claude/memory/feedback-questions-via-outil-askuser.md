---
name: feedback-questions-via-outil-askuser
description: "Toute question à l'utilisateur passe par l'outil AskUserQuestion — jamais en prose de fin de message"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-03T11:28:14.113Z
---

Toute question adressée à l'utilisateur (arbitrage, tri, choix, validation) passe par l'outil
AskUserQuestion — jamais en question ouverte à la fin d'un message texte.

**Why :** demande explicite (2026-08-03, verbatim) : « Pour les questions, passe par l'outil
d'apté [adapté] » — après deux occurrences le même jour : « Une par une, avec le tool demande »
(le tri #136 ligne par ligne), puis deux questions de tag laissées en prose de fin de message,
restées sans réponse sur plusieurs tours. La prose se perd ; l'outil force une réponse structurée
et trace le verbatim de l'option choisie (ce qui nourrit directement les consignations d'arbitrage).

**How to apply :**
1. Une décision utilisateur à obtenir = un AskUserQuestion, même pour une question unique.
2. Les éléments à trier en série : un item PAR question (max 4 par appel), jamais un lot groupé
   d'office — le tri #136 groupé a été refusé (« je veux que tu me listes, pas que tu entérines »).
3. Les réponses libres tapées dans l'outil sont souvent des CONTRE-QUESTIONS ou des corrections —
   les traiter comme telles ([[feedback-questions-stop-loop]] : une question de l'utilisateur
   suspend la boucle jusqu'à réponse).
4. La prose de fin de message reste pour le STATUT, jamais pour solliciter une décision.
