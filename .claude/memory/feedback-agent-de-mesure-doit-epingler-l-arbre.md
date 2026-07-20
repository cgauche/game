---
name: feedback-agent-de-mesure-doit-epingler-l-arbre
description: "Incident 2026-07-19 : un juge d'art a rendu un verdict 12/12 entièrement FAUX parce qu'un git stash d'une autre session avait vidé l'arbre pendant sa mesure — tout agent qui MESURE l'arbre partagé doit d'abord l'épingler et s'arrêter s'il ne correspond pas"
metadata:
  node_type: memory
  type: feedback
  originSessionId: cb384a41-d20a-494b-aa60-728b2ed7534f
  modified: 2026-07-20T06:25:32.970Z
---

**Incident fondateur (2026-07-19).** Un juge d'art en aveugle a rendu **12/12 À RETOUCHER** avec un grief « BLOQUANT et UNIVERSEL » : *« le slot `bras` est encore une string front-only, la prémisse du brief est RÉFUTÉE, mesurée sur l'arbre »*. Il l'a étayé de trois preuves croisées et indépendantes — comptage des defs, rendu composé (front vs back = **100,0 % de pixels identiques**), et présence des 12 clés dans le stock du cliquet. Verdict **entièrement faux** : une autre session avait lancé un `git stash` en plein vol, qui avait ramené l'arbre à HEAD. Le juge avait rigoureusement mesuré... l'état d'avant le travail.

**Why :** un agent de mesure ne doute JAMAIS de l'existence du sol sous ses pieds. Plus il est rigoureux, plus son faux verdict est convaincant — les trois preuves croisées ne se contredisaient pas, elles décrivaient toutes fidèlement le mauvais arbre. Et l'orchestrateur qui reçoit un rendu aussi étayé est structurellement enclin à le croire : c'est exactement la forme d'un bon rapport.

**How to apply — tout brief d'agent qui MESURE l'arbre porte un ÉPINGLAGE en tête :**
1. **Un point d'ancrage vérifiable** : `git log --oneline -1` doit montrer le commit attendu (ou un descendant).
2. **Une assertion POSITIVE sur l'artefact jugé** (« dans les 12 defs, `bras:` est suivi d'un `{`, pas d'un backtick ») — l'ancrage git seul ne suffit pas, le travail peut être non commité.
3. **La consigne d'ARRÊTER et de le dire** si l'un des deux échoue, au lieu de mesurer et conclure.
4. Prévenir des **pièges de forme** qui feraient rater l'assertion (ici : un commentaire s'intercale entre `bras: {` et `front:` — une regex naïve conclut « string »). Une assertion positive mal écrite est aussi dangereuse qu'aucune.
5. Signaler que l'arbre contient le **WIP d'autres sessions** et lesquels chemins sont hors périmètre, sinon l'agent impute à son sujet des échecs qui ne sont pas les siens (ici `land-art.test.ts` rougissait à cause du WIP `vehicles.json` d'une autre session).

**Corollaire — protéger le travail plutôt que compter sur la discipline d'autrui.** La parade durable n'est pas d'espérer que personne ne stashe : c'est de **committer tôt**. Un commit ne peut pas être balayé ; un arbre de travail, si. En attendant le commit, exporter hors du dépôt (scratchpad) est la seule sauvegarde qu'aucune commande git ne peut atteindre — c'est ce qui a permis de tout récupérer ici (28/28 fichiers, vérifiés au diff contre l'arbre restauré).

**Second enseignement du même incident — un en-tête périmé FABRIQUE de fausses accusations.** Le même juge a accusé le cliquet des littéraux d'avoir « aligné son plafond sur la dette » (221 clés annoncées, 1381 réelles). Réfuté : le grain était passé de `slot:vue` à `slot:vue#n`, sur les **mêmes 58 defs** — le compteur avait changé d'unité, pas la dette. Mais l'en-tête, lui, annonçait toujours l'ancien grain. Un juge de bonne foi ne pouvait pas conclure autrement. **Un commentaire qui ment ne coûte pas qu'une lecture fausse : il produit du travail de réfutation.** Corriger l'en-tête fait partie du geste qui change le grain.

Lié : [[feedback-jamais-git-surgery-arbre-partage-actif]], [[git-commits-propres-wip-parallele]], [[feedback-relance-agent-verifier-le-contenu-pas-le-status]] (même famille : ne jamais briefer sur un état supposé), [[feedback-verifier-les-claims-architecturaux-des-agents]], [[game-agents-worktree-isolation-shared-branch]].
