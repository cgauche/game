---
name: feedback-mes-propres-sondes-se-remesurent
description: "La règle imposée aux agents — une convergence ne vaut vérification que si les méthodes diffèrent — s'applique d'abord à MES sondes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 411c88e0-9fa2-4d10-a2f5-ee5cc57e7b0e
  modified: 2026-07-28T17:46:48.601Z
---

J'exige de chaque agent, dans son brief : « **« Aucun X » est irrecevable seul** : toute affirmation
d'absence porte SA commande et SON périmètre exact. Une convergence entre deux mesures ne vaut
vérification que si leurs MÉTHODES diffèrent. »

**Le 2026-07-28, j'ai enfreint cette règle QUATRE fois en une session**, et à chaque fois j'étais à
deux doigts de rapporter un défaut inexistant :

1. `Object.keys()` sur une **`Map`** → toujours 0. J'ai conclu « l'ensemble `consumed` est vide, le
   détecteur est cassé ». Il ne l'était pas.
2. `grep` en **guillemets doubles** alors que le code cite en simples → « 14 véhicules orphelins ».
   Il y en avait 2 ; les navires sont cités par leurs gabarits de rig en `'...'`.
3. Regex de chemin excluant les **espaces**, sur un dépôt dont tous les chemins `Source/` en
   contiennent → « 0 chemin mort ». Il y en avait 2.
4. Régénération d'un doc tombée **pile dans la fenêtre de mutation** d'un agent en vol → j'ai lu
   `flexible-MUTATED` comme une orpheline réelle et j'ai failli accuser un revert raté.

**Why:** dans les quatre cas la sonde était plus ÉTROITE que la conclusion, et rien dans son
résultat ne le signalait — un « 0 » a exactement la même tête qu'un vrai zéro. C'est le même mode
d'échec que [[feedback-un-detecteur-ne-mesure-que-sa-couverture]], appliqué à moi.

**How to apply:** avant de rapporter un défaut trouvé par MA propre sonde — surtout un défaut chez
un agent qui vient de rendre — re-mesurer par une méthode DIFFÉRENTE. Et pour le cas 4, qui est
propre à l'arbre partagé : ne jamais mesurer pendant qu'un agent tient une preuve par mutation ;
un chiffre incohérent se re-mesure avant de se conclure. Voir
[[feedback-background-agent-not-done-until-notified]] — la nuance ici est que l'agent AVAIT notifié,
et qu'un AUTRE tenait la mutation.

Corollaire pour les briefs : toute preuve par mutation exigée d'un agent doit muter avec un cas
**délibérément atypique** (nom qui ne suit pas la convention du détecteur), sinon on ne teste que le
motif de la garde — cf. [[game-garde-exemption-au-site-jamais-au-fichier]].
