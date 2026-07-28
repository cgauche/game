---
name: game-garde-exemption-au-site-jamais-au-fichier
description: "Une exemption de garde posée sur un FICHIER blanchit tout ce qu'il contiendra ; détecter un NOM ne vaut rien car la violation se renomme"
metadata: 
  node_type: memory
  type: project
  originSessionId: 411c88e0-9fa2-4d10-a2f5-ee5cc57e7b0e
  modified: 2026-07-27T22:49:10.671Z
---

Trois modes d'échec d'une garde, tous mesurés le 2026-07-27, tous à vérifier avant de croire
un cliquet vert.

**1. L'exemption au FICHIER blanchit l'avenir.** `rollSeamWhitelist.mjs` exempte **27 fichiers
entiers** (+ `combatSlice.ts` via `battleRngEngineLeakWhitelist`) — dont `combatFlow.ts`,
`rollFlowFactory.ts`, `triggeredEffects.ts`, `interludeFlow.ts`, `massBattleFlow.ts` : très
exactement les fichiers où les jets vivent. Un jet inline neuf y passe en CI verte, par
construction. L'exemption ne protège pas les sites qui l'ont motivée. Preuve vécue : à
`combatSlice.ts:546`, `res.critical` était jeté depuis des mois (20 doubles → 0 Critique,
`LDB 13 l.183` ; 58 overkills → 0 Blessure critique, `LDB 13 l.161`). Ouvert en #918.

Une exemption se pose **au SITE**, et porte un **test committé** qui prouve sa légitimité —
jamais un commentaire.

**2. Détecter un NOM ne vaut rien.** La garde anti-label cherche `/(BY_?LABEL|byLabel)/`.
`src/state/combatLog.ts:80` porte `STATE_LABEL_TO_ID` — une table libellé→id dans `src/state`,
non exemptée, invisible. La violation s'est renommée hors de portée à un underscore près.
Une garde détecte une **FORME** (structure AST), jamais un nom. Corollaire pour toute preuve
par mutation : muter avec un cas **délibérément mal nommé**, sinon on ne teste que le motif.

**3. Un fichier GÉNÉRÉ n'est pas un consommateur.** Un registre généré exhaustif cite
littéralement CHAQUE id de son catalogue — il neutralise donc en entier toute garde qui mesure
« qui cite cet id ». Découvert en faisant générer `QUALITY_IDS` : deux entrées réellement
orphelines en sont sorties à tort. Un générateur produit un MIROIR de la donnée, pas un USAGE.
Même classe que `falseQualities()` (pool des Particularités qu'on croit *à tort* déceler,
ADE II) : une citation qui n'est pas un chemin d'accès. Règle générale retenue : un filtre
n'est consommateur que si sa chaîne aboutit à un **id** (`.map(q => q.id)`), jamais à un
`.label`.

**Le fil commun** : dans les trois cas, ce qui « prouvait » la légitimité était de la PROSE —
un commentaire, un nom de constante, un rapport d'agent. Voir [[feedback-un-detecteur-ne-mesure-que-sa-couverture]]
et [[feedback-gardes-structurelles-pas-greps]]. Conséquence directe : un cliquet déclaré à ZÉRO
ne prouve la fermeture d'une classe que si son détecteur couvre la classe — `labelResolverCallStock`
a été soldé le 2026-07-27 alors que 5 sites de logique par libellé restaient debout (#919).

Doctrine utilisateur (2026-07-27, verbatim) : « avoir des listes qui doivent dinimuner avec le
temps, c'est un truc pour dire "c'est fait, on en parle plus", et au final on a juste une liste
d'exception qui empoisonne et qu'on maintient a jamais. On l'a vu en plus, les agents le
contournaient ». Et : « Quand on voit une anomalie, on s'assure qu'il n'y en a pas d'autres ».
