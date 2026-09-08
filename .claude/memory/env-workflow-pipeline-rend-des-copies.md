---
name: env-workflow-pipeline-rend-des-copies
description: "Dans un script Workflow, pipeline()/parallel() rendent des COPIES des items (identité fausse), agent() rend null sur échec — et tout changement de workflow passe par un juge, jamais par tests+mutations seuls"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 02e357dc-4cb8-4e52-8966-93c37c1ab79e
  modified: 2026-09-05T07:15:01.406Z
---

Mesuré 2026-09-05 sur le premier verdict réel de `juge-design-socle` (run wf_015d42e5-4b1) : `lots.filter((lot) => !examines.some((e) => e.lot === lot))` était faux pour TOUS les lots — les items que `pipeline()` passe aux stages et rend sont des copies (sérialisation à la frontière du sandbox), donc 45 bloquants affichés pour 22 distincts. Le contrat du harnais (référence `workflow-authoring`) : une stage qui lève rend `null` pour l'item ; un thunk de `parallel` qui lève rend `null` ; `agent()` rend `null` si l'agent meurt ou est sauté ; `Date.now()`/`Math.random()` lèvent.

**Why:** une doublure de test qui passe les objets par référence (`workflows-joues.test.mjs` avant le correctif) ne peut pas voir ce défaut : la doublure doit `structuredClone` items et résultats. Et le défaut est né dans un commit de workflow NON jugé (81b624128, « réfutation par lentille ») — l'utilisateur l'a demandé : « Tu l'a jugé ton workflow d'ailleurs ? » (2026-09-05).

**How to apply:** dans un script de workflow, apparier par CLÉ (label, titre normalisé), jamais par identité ; `.filter(Boolean)` après `pipeline`/`parallel` et traiter le `null` d'un agent comme un lot PERDU dit au journal ; tout changement d'un `.claude/workflows/*.js` passe par un juge de diff avec la lentille « hypothèses de harnais » (cumulé avec le lot suivant s'il est petit, jamais sauté). Voir [[env-sous-agents-background-figes]] et [[user-passage-fable-derives-opus]].
