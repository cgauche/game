---
name: feedback-citation-prouve-ce-quelle-repond
description: "LENTILLE OBLIGATOIRE de tout juge/brief : une citation RAW prouve ce qu'elle RÉPOND, jamais ce qu'on lui fait dire — reconstruire (a) la question du LIVRE et (b) la question du SITE, et juger l'adéquation. Née d'un étirement attrapé par l'USER, passé à travers un juge."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 39a8970a-cba9-474a-be43-12bdf0b366e7
  modified: 2026-08-31T06:43:36.539Z
---

**Le fait fondateur (2026-08-30/31)** : MDG 14 l.39 (« la performance des Personnages représente celle de tout l'équipage ») — une phrase sur QUI LANCE LES DÉS dans un Test d'équipage — a été étirée pour justifier que les blessures individuelles des marins nommés s'oublient. L'étirement a TRAVERSÉ un juge d'inventaire (classé « valeur abstraite RAW légitime ») ; c'est l'utilisateur qui l'a vu : « C'est quoi le rapport entre cette phrase RAW que tu affectionne tant et les blessures que les marins pourrait subir en combat…? Le RAW ca ne parle de des jets non ? ». Puis : « Je n'imagine même pas le nombre de décision que tu as gardé ou prise a cause de RAW mal compris ou utilisé en excuse pour justifier du mauvais code de fénéant. »

**Le trou de méthode** : les juges vérifiaient l'EXISTENCE et le VERBATIM d'une citation, jamais son ADÉQUATION. Une citation vraie appliquée hors de sa question passe tous les contrôles de forme.

**Why** : l'audit dédié (25 sites jugés au Source) a rendu 19 ADÉQUATES / 3 ÉTIRÉES / 1 EXCUSE — les 4 vraies étaient TOUTES navales et germaient de la MÊME citation-mère, avec 3 comportements joueur faussés (voile de nuit ignorant l'effectif, branche PNJ structurellement morte — la citation tronquée AU POINT-VIRGULE, la phrase suivante disait le contraire —, artillerie indestructible par silence). → #1595. La citation tronquée à la ponctuation est la variante la plus vicieuse.

**How to apply** :
- Tout juge qui rencontre une citation en position de JUSTIFICATION (limitation, absence, simplification, abstraction) reconstruit la paire : (a) à quelle question la phrase répond DANS SON CONTEXTE (lire la phrase d'avant/d'après) ; (b) quelle question le code lui fait porter. Différence = ÉTIRÉE. Silence réel = credo cas 1 (maison éditable), jamais un `return` en dur.
- Étalon d'or existant dans le dépôt : `src/engine/conditions.ts:425-428` — un commentaire qui REFUSE lui-même l'étirement de sa propre citation et ticketise.
- La lentille vaut aussi pour MES briefs et les verdicts de MES juges (le cas fondateur a traversé les deux).
- Sonde de classe rejouable : grep des réfs RAW × verbes de limitation (« le RAW ne », « abstrait », « représente », « laissé au MJ »…) — famille à ~104 sites, couverte à 18 % par l'audit, non-naval SOUS-MESURÉ.

Voir [[feedback-verbatims-utilisateur-confrontes-au-raw]], [[feedback-invariant-cite-verbatim-jamais-depuis-un-rendu-de-juge]].
