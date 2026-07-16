---
name: game-raw-comments-suspect-read-source
description: "Un commentaire de code qui CITE le RAW (l.NNN) reste suspect — lire le Source .md avant d'affirmer « le RAW dit X »"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2577dea6-b9f9-4557-8166-af4f3d3af24c
---

Sur Foundry/Game, **un commentaire de code qui prétend citer le RAW (« ADE II ch.8 l.116-118 : une Scène par PJ ») n'est PAS une preuve** — c'est souvent une paraphrase qui a dérivé. Avant d'affirmer « le RAW dit X » ou de construire un design dessus, **ouvrir le `.md` dans `Source/` et lire les lignes**.

**Why:** en une seule session j'ai pris 3 commentaires pour du RAW, et l'user a dû me rattraper à chaque fois (coût : revert + re-scope) :
- `crewMorale.ts` « advances = différence RAW délibérée » → FAUX : le RAW (MDG 14 l.38-39) ne connaît que la compétence (`testValue`), pas les avances.
- `massBattle.ts` « une Scène par PJ (l.116-118) » → FAUX : le texte réel (ADE II ch.8 l.116-118/153/157/163) dit Scènes **MULTI-PJ** résolues en **Soutien** (« tous les Personnages engagés », « en soutien », « contre les Personnages »).

**How to apply:** dès qu'une décision (surtout de cardinalité/mécanique) repose sur « le RAW dit… », grep + lire le Source `.md` cité, pas le commentaire ni l'Atlas seul. Renforce [[feedback-ne-pas-faire-confiance-commentaires]] et [[feedback-source-user-claims]] : le garde-fou vaut AUSSI pour les commentaires qui ont l'air sourcés.
