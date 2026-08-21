---
name: exemption-structurelle-re-triee-quand-invariant-bouge
description: "Une exemption (surtout STRUCTURELLE, reconnue par forme) est un jugement daté contre un périmètre daté — quand une directive déplace l'invariant, TOUTES les exemptions accordées sous l'ancien invariant se re-trient. Précédent — 45 dés de monde invisibles (#1426)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8f120aa-33d4-4eb8-8332-4e74068f3313
  modified: 2026-08-20T06:07:54.566Z
---

Reproche utilisateur (2026-08-20, verbatim) : « On a fait une migration pour sortir tous les jets
inline par notre nouveau système, je suis toujours étonné que malgres cette migration qui fut tres
longue et que tu as toi même faite (suffit de voir ta liste de tache), tu as trouvé un moyen de ne
pas la finir »

**Le mécanisme de l'échec** (migration seam #918 → socle dés fixés #939 → trou #1426) :
1. #918 : stock des jets inline compté et décroissant (cliquet `ROLL_SEAM_PHASE2_STOCK`) — sain.
2. #918-B : la forme (M) « dé de monde » devient une exemption STRUCTURELLE du scanner
   (`isWorldDie`) — défendable sous l'invariant d'alors (police d'ACTEURS). Effet : ~45 sites
   sortent du compte. Pas migrés — décomptés.
3. #939 (directive 2026-07-29) : « tout jet qu'on contrôle — héros / PNJ / ENVIRONNEMENT » —
   la prémisse de l'exemption est caduque. Personne ne re-trie le stock exempté. Garde vert lu
   comme « migration finie ». Découvert par l'utilisateur un mois plus tard.

**Why** : une whitelist comptée SE VOIT et décroît ; une exemption de forme ne laisse AUCUNE liste
à regarder — c'est [[un-detecteur-ne-mesure-que-sa-couverture]] sous sa forme la plus vicieuse.
L'exemption est un JUGEMENT DATÉ rendu contre un PÉRIMÈTRE DATÉ, pas un acquis.

**How to apply** : à CHAQUE directive/arbitrage qui redéfinit un invariant (qui contrôle quoi, qui
possède quoi, ce qui compte comme X) : inventorier les exemptions/formes/exclusions-de-principe
accordées sous l'ancien invariant (greps des scanners : `isWorldDie`, CORE-sets, formes (S)/(M),
baselines « canonique ») et les RE-JUGER une à une contre le nouveau périmètre — dans le MÊME lot
que la directive, pas plus tard. Une exemption re-confirmée se re-date ; une exemption caduque
devient le stock du lot suivant. Lié : [[registre-fossiles-transition]],
[[jamais-de-demi-migration]].
