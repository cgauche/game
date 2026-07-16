---
name: feedback-comment-noise-ratio
description: "Cut comments to the essential — files must be code, not a wall of comments; delete obsolete/confusing ones"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3c607334-9cb9-4345-b0af-44a71a2cc58a
---

Beaucoup de fichiers du projet sont devenus « plus une compilation de commentaires que du code
applicatif » — parfois des commentaires qui ne font qu'embrouiller. Règle : **garder l'ESSENTIEL
seulement** (le *why* non-évident), **supprimer les commentaires obsolètes** au moment où on touche
un fichier, et ne jamais restater ce que le code dit déjà.

**Why:** le bruit de commentaires masque la logique et rend les bugs (ex. moteur de rendu) durs à
lire/corriger. Un refactor qui supprime du code doit supprimer les commentaires devenus faux/inutiles
DANS LA FOULÉE, pas les laisser mentir.

**How to apply:** en refactorant chaque fichier, purger agressivement — un commentaire survit seulement
s'il porte une raison non-déductible du code (calibration, invariant, réf RAW `LDB … l.…`). Pas de
JSDoc verbeux qui paraphrase la signature. Prolonge [[feedback-concis-pas-haiku]] et
[[feedback-pas-de-commentaire-rappel-ancien]] : ici c'est le RATIO commentaire/code qui est visé.
