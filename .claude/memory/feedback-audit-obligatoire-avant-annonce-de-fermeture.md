---
name: feedback-audit-obligatoire-avant-annonce-de-fermeture
description: "Leçon 2026-07-11 (user : « ces juges ont été lancés à MA demande, et même ainsi certaines mauvaises décisions sont restées ») : la passe adversariale n'est PAS un outil à la demande — c'est une ÉTAPE OBLIGATOIRE de toute vague de fermetures, portée sur les DÉCISIONS entières, AVANT d'annoncer quoi que ce soit fermé."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: adfd4529-35c1-4ae9-85da-f959f7971274
---

**Le constat user (2026-07-11, verbatim)** : « le souci c'est que ces "juges" ont été lancés à ma demande, et que même ainsi certaines mauvaises décisions sont restées. » — Trois étages de vérification de la soirée (audit des fermetures, chasse aux radars, canal GameOp) ont TOUS été déclenchés par des questions de l'user. Entre chaque, des défauts dormaient. L'auto-correction vantée était RÉACTIVE à l'humain, pas structurelle.

**Why :** ma boucle avait des portes obligatoires pour COMMITTER (suite complète, sortie brute) mais AUCUNE pour FERMER. La passe fini-vérifié existait comme patron disponible, jamais comme étape du rituel. Et quand elle a tourné (à la demande), son PÉRIMÈTRE était trop étroit (les 10 fermetures) — les décisions de scope, les splits, les claims d'agents et les dettes consignées-non-ticketées sont restés hors champ jusqu'à la question suivante.

**How to apply (règles de boucle, non négociables) :**
1. **Toute vague qui ferme des tickets se TERMINE par une passe adversariale NON DEMANDÉE** (juges en réfutation, patron fini-vérifié) AVANT d'annoncer les fermetures à l'user. Le message d'annonce porte le verdict d'audit (TIENT/FRAGILE/RÉFUTÉ), jamais un score brut de fermetures.
2. **Le périmètre de l'audit = les DÉCISIONS de la vague**, pas seulement les fermetures : les splits (leur prémisse est-elle vérifiée ?), les claims architecturaux des agents, les « consigné en rendu » qui doivent devenir des tickets (un écart consigné dans un rendu d'agent et non ticketé = backlog invisible = poison).
3. **Un ticket ne se ferme sur « déjà implémenté » ou « documentation faite » qu'après relecture du DoD MOT À MOT** (le raté #254 : documenter ≠ le DoD qui exigeait un comportement).
4. Ces règles valent d'autant PLUS sous contrainte de temps (« 3 h, maximum de tickets ») : la pression au score est précisément quand le tri se dégrade.

Lié : [[feedback-verifier-les-claims-architecturaux-des-agents]], [[feedback-audit-nest-pas-ordre-de-travail]], [[feedback-fidelite-raw-et-editabilite-non-negociables]].
