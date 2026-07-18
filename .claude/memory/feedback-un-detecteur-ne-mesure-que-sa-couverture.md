---
name: feedback-un-detecteur-ne-mesure-que-sa-couverture
description: "Le chiffre que rend un détecteur mesure SA COUVERTURE, jamais la taille de la classe — piège tombé le 2026-07-17 sur « 1 seule multi-occurrence sur 1047 », dans un module qui citait reconcile comme garde-fou"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cb384a41-d20a-494b-aa60-728b2ed7534f
---

**Incident fondateur (2026-07-17)** : `scripts/guards/lib/folioIntegrity.mjs:242` annonçait « sur les 1047 entrées à desc retrouvée, **1 SEULE est multi-occurrence** » et en concluait « **la règle ne pèse donc sur rien d'autre** ». J'ai pris ce chiffre pour la taille de la classe et j'ai dimensionné mes décisions dessus. Un juge l'a démoli :

1. Le détecteur cherche **une desc apparaissant deux fois dans UN livre**. Or le duplicat fondateur (`redoutable`) était **splitté en DEUX ids** (`redoutable` / `redoutable-mdg`), chacun audité seul → **invisible par construction**.
2. Il ne voit que les **1047 desc retrouvées** ; **1135/2082 (54 %)** du corpus échappe à tout verdict (desc reformulée 729, trop courte 138, chapitre sans marqueur 127, livre sans extraction 141).
3. Le seul cas qu'il *a* vu (`fouissement`) a été soldé sur une qualification que le Source **réfute**.

⇒ **Le « 1 » mesurait la couverture du détecteur, pas la réalité.** Et le comble : c'est le patron du faux ami **`reconcile`** (157 dettes affichées, CI verte) — que ce module cite lui-même en garde-fou à sa ligne 28.

**Why :** un chiffre produit par un outil hérite de ses angles morts. Le lire comme une mesure du monde est le même geste que lire une CI verte comme « pas de dette ». Ça vaut pour MES chiffres autant que pour ceux des agents.

**How to apply :**
- **Avant de dimensionner quoi que ce soit sur un chiffre d'outil, demander : « que ne peut-il PAS voir ? »** Le taux d'angle mort (ici 54 %) est aussi important que le résultat. Un détecteur qui ne couvre que la moitié du corpus ne borne rien.
- **Un chiffre bas est plus suspect qu'un chiffre haut.** « 1 seul cas » sur un corpus de 2082 doit déclencher la question de couverture, pas le soulagement.
- **Une conclusion de PORTÉE (« ça ne pèse sur rien d'autre ») ne se tire jamais d'un détecteur** — seulement d'une mesure dont on a établi la couverture. Écrire la portée dans le code est du poison durable : le prochain lecteur la prendra pour un fait.
- **Corollaire de brief** : demander à l'agent le **dénominateur ET l'angle mort**, pas seulement le compte. Et vérifier que l'agent a réellement les outils pour mesurer (incident du même jour : un `lecteur` n'avait ni Grep ni Glob ni shell — le mode Replace de lean-ctx les refuse — donc son balayage était structurellement infaisable ; il l'a dit honnêtement au lieu de fabriquer).

Lié : [[feedback-jamais-de-constat-silencieux]] (une garde qui compte sans gater = faux ami — ici, une garde qui compte SA PROPRE VUE), [[feedback-verifier-les-claims-architecturaux-des-agents]], [[game-exhaustive-guard-vs-per-domain]], [[game-collision-livres-identique-vs-divergent]] (le chantier où c'est tombé), [[env-session-background-pieges-outils]].
