---
name: game-collision-edoc-ldb-belliqueux-tranchee
description: "Collision EDOC↔LDB sur le Trait Belliqueux — tranchée 2026-07-15 : le NOM du trait octroyé fait foi, la glose du livre qui l'octroie est écartée"
metadata: 
  node_type: memory
  type: project
  originSessionId: f99ca0f7-6f7b-4bd6-9080-4fe86b48eb33
---

**Décidé le 2026-07-15**, sur délégation utilisateur explicite (verbatim) : « **pour le rattachement y'a
que toi qui a lu le RAW donc c'est toi qui décide** ».

## Le conflit

- **EDOC ch.8 l.222** (table des mutations mentales) : « Masochisme pressant | Gagne le Trait de créature
  **Belliqueux** : impossibilité de Fuir volontairement (voir page 165 du Livre de Règles) »
- **LDB 85 l.49-51** (entrée du Trait) : « **Belliqueux** — La créature adore combattre. Tant qu'elle a
  plus d'Avantages que son adversaire, elle gagne Immunité Psychologique. »

Les deux ne décrivent pas la même chose.

## Verdict : le NOM du trait fait foi, la glose est écartée

**Preuve qui tranche** : la réf de page de l'EDOC s'auto-invalide. Elle renvoie à « page 165 du Livre de
Règles », or l'index du LDB place *Belliqueux* **page 338**, et le folio 164-165 (fichier `14`) porte les
**montures et l'Avantage**, pas les Traits. La parenthèse ne pointe pas sur ce qu'elle prétend citer.

Ce qui est sans ambiguïté, c'est « Gagne le Trait de créature **Belliqueux** ». Le Trait est défini par le
LDB 85 ; sa définition prime sur la description qu'en donne le livre qui l'octroie. Implémenter la glose
(« impossibilité de Fuir ») = **inventer une mécanique qu'aucune définition de Trait ne porte** → règle 1
du CLAUDE.md.

## ⚠ Conséquence : AUCUNE — c'était DÉJÀ FAIT (vérifié le 2026-07-16)

`src/data/mutations.json` porte déjà l'entrée `masochisme-pressant` avec **exactement ce verdict** :
```json
{ "id": "masochisme-pressant", "passive": [{ "op": "grantTrait", "traitId": "belliqueux" }] }
```
Quelqu'un avait rendu le MÊME arbitrage avant moi, correctement — et l'Atlas (`corruption.md:580`) le
déclarait « non implémenté ». **J'ai arbitré une dette fantôme**, et j'ai failli la faire ticketer.

Ce qui reste vrai et utile, c'est la **règle générale** ci-dessus (elle est même confortée : deux
arbitrages indépendants ont convergé). Ce qui était faux, c'est le constat de dette — repris de l'Atlas
sans vérifier le code. Cf. [[feedback-jamais-de-constat-silencieux]] : ~40 marqueurs sur 70 mentent, et
**mes propres briefs les propageaient**.

Même famille, même jour : `corruption.md:574` jurait que « `mutationTables.json` ne contient que les 2
tables LDB 19 » → **17 tables existent**, dont les 15 EDOC par panthéon (`edoc-phys-*`, `edoc-mental-*`,
`edoc-tete-bestiale-*`). Et `corruption.md:581` jurait le Tableau des Obsessions absent → `rollObsession`
+ `argFrom:'obsessions'` existent.

## Règle générale à réutiliser

**Quand un livre B octroie un Trait/Talent défini par un livre A et le décrit au passage, la définition de
A prime ; la glose de B est une commodité éditoriale, pas une règle.** Vérifier la réf de page de B :
si elle ne pointe pas sur l'entrée de A, la glose est présumée fautive. Documenter la collision avec les
DEUX verbatims (jamais une paraphrase — règle 6).

⚠ Précédent de méthode : c'est un agent qui a refusé mon brief affirmant « Belliqueux = impossible de
fuir » et est allé lire. Cf. [[feedback-verifier-les-claims-architecturaux-des-agents]] et
[[game-sources-pdf-errors-verify-case-by-case]] — ici l'erreur était dans la SOURCE, pas dans le code.

Voir aussi [[game-collisions-variantes-livres-deferred]] (politique générale des collisions entre livres).
