---
name: feedback-ne-pas-faire-confiance-commentaires
description: Ne jamais faire confiance aux commentaires / marqueurs / docs — ils peuvent cacher de la dette sous de jolis mots ; vérifier contre le code & la donnée réels.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 00336363-0f77-4c1d-8153-f37d57b697b2
---

Ne JAMAIS faire confiance aux commentaires (ni aux marqueurs de doc type « Implémenté »/« (non implémenté) » de l'Atlas RAW, `reconciliation.md`, `code-map.md`, ni aux `// LDB X l.Y` inline). Ils peuvent **cacher de la dette avec de jolis mots** : un commentaire qui prétend « Implémenté » alors que le hook moteur est absent, un `// fait X` divergent du comportement réel, une réf de ligne fausse.

**Why:** Le dépôt est massivement annoté (Atlas, code-map, reconciliation) et ces artefacts sont en partie **agent-générés** → faux positifs/négatifs. Se fier au commentaire = propager la dette qu'il masque.

**How to apply:** Tout commentaire/marqueur/doc est une **graine à vérifier**, jamais une preuve. Confirmer chaque constat en lisant l'**implémentation réelle** (code exécuté, donnée `src/data/*.json`, test qui passe), pas la prose qui la décrit. En audit : ajouter la catégorie « commentaire qui ment / cache de la dette » aux violations. Lié à [[feedback-pas-de-commentaire-rappel-ancien]], [[feedback-affordance-morte-signaler]], [[game-atlas-raw-doc]] (la vérif Atlas a des faux-positifs).
