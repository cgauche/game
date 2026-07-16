---
name: feedback-enterine-mot-reserve-utilisateur
description: "Le tag [entériné] est un mot RÉSERVÉ à l'utilisateur — jamais écrit ni même « proposé comme verdict par défaut » sans son approbation site par site ; son défaut = CORRIGER"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 88e4d329-aad9-4fe6-85b1-19f8e31ecf27
---

2026-07-06, tri des excuses (#136) : j'ai proposé « entériner » pour 2 des 3 vraies excuses —
l'utilisateur a refusé net : « Je n'ai jamais donné mon autorisation pour entériner. Il faut mon
approbation pour mettre ce mot. »

**Why:** le credo dit déjà « sans validation utilisateur explicite et traçable » ; l'utilisateur
précise que même la POSTURE de proposer l'entérinement comme verdict recommandé est une dérive —
et les faits lui ont donné raison : les 2 sites « à entériner » étaient des dettes réelles
(branche legacy SpecEntry morte depuis l'achèvement de la migration ; commentaire shipCrew citant
une issue fermée). Une excuse plausible est presque toujours une dette déguisée.

**How to apply:** le verdict par DÉFAUT d'une excuse est CORRIGER (re-vérifier la vérité actuelle
du site : la donnée, l'état des migrations, le statut des issues citées). N'envisager
l'entérinement que si, après vérification, la déviation est structurellement légitime — et alors
le PRÉSENTER comme question ouverte à l'utilisateur, jamais comme recommandation, et n'écrire le
tag `[entériné AAAA-MM-JJ]` qu'après son accord explicite sur CE site précis.

**Durci 2026-07-07** (ses mots : « je n'accepte aucune justification sans la mention explicite
[entériné] ou celui qu'on a créé et qui demande ma validation explicite ») : une justification de
déviation — « notre arbitrage », « choix de modèle/design », « décision assumée » — n'est valide
QUE portée par le tag. Date, citation de l'utilisateur, ancrage canon, réf d'issue NE remplacent
PAS la validation. Mécanisé : `scanDecisionClaims` (famille 4, `DECISION_TRACE_RX = ENTERINE_TAG_RX`
seul) aux portes stylo + pre-commit. [[game-perennite-portes-chantier]]
