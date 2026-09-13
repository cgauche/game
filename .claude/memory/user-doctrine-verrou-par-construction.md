---
name: user-doctrine-verrou-par-construction
description: "Une migration police la divergence ; seul le VERROU PAR CONSTRUCTION la supprime — diverger ne doit pas compiler"
metadata:
  type: user
---

**Verbatim (2026-08-10)** : « Tout ca car tu ne veux pas régler le vrai problème, que je tente de régler depuis 1 mois, a savoir que chacun fait ce qu'il veut. Tu migre un truc a la fois, tu modifier 30 endroits dans le code, puis apres on voit un autre problème, tu remigre ce truc encore 30 fois ... »

**Why :** une migration change les USAGES mais laisse la CAPACITÉ de diverger, donc la divergence repousse ; les gardes-scanners courent après les patrons — si on peut le greper, on peut l'écrire.

**How to apply :** devant une classe de dérive, la question est « comment la rendre INEXPRIMABLE ? » — exports privatisés au module socle, primitive à discipline importable par son seul système (quarantaine vérifiée sur le GRAPHE D'IMPORTS), types que seule la fabrique produit, frontières d'import lintées : diverger ne casse pas la CI, ça NE COMPILE PAS ; le découpage est par FAMILLE DE CONSOMMATEURS (chaque fichier touché une fois, directement vers la forme finale), jamais par couche ; une famille murée ne se remigre jamais ; le grep-baseline et les scanners ne subsistent que pour ce que les types ne savent pas exprimer.
