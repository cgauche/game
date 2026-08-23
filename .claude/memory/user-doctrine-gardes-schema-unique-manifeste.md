---
name: user-doctrine-gardes-schema-unique-manifeste
description: "Doctrine utilisateur 2026-08-23 — les gardes (tests structurels/cliquets) suivent UN schéma unique DÉCLARÉ dans chaque garde (en-tête structuré, doc générée par extraction) ; quatre machineries pour une même question = poison ; PAS de manifeste parallèle (garde de synchronisation, jugé sur #1475)"
metadata: 
  node_type: memory
  type: user
  originSessionId: ba0a846d-5585-40fc-9d7f-ac595de92162
  modified: 2026-08-23T11:59:53.903Z
---

Utilisateur, 2026-08-23, verbatim : « C'est triste d'avoir 4 facon de répondre au même besoin ? »
puis « C'est un besoin global de s'assurer que tous ces éléments soient documentés et suivant un
schéma unique. Triste qu'il soit possible de faire un peu n'importe quoi aujourd'hui ».

Contexte : inventaire perf de la suite — les gardes d'ATTEIGNABILITÉ (« chaque élément A a sa
porte B consommée par la surface C ») existaient en 4 mécanismes : `ts.createProgram`+TypeChecker
(`sceneFieldEditability.mjs`, `gameOpRefFk.mjs`), ESLint (`built-brand-lint`, `cascade-consequence`),
regex de corpus, AST syntaxique sur `readCorpus`. Chacune écrite en regardant sa voisine.

**How to apply :** une garde n'existe que DÉCLARÉE — dans SON fichier, en-tête structuré
(question posée A→B→C, primitive employée, périmètre mesuré, angle mort obligatoire, baseline +
`decroissant: true|false` avec raison, ticket) ; `docs/gardes.md` GÉNÉRÉ par EXTRACTION de ces
en-têtes ; garde structurelle « fichier reconnu comme garde sans en-tête = rouge », mécanisme hors
primitive unique (`scan(relPath, contenu, regles)` sur `readCorpus`) = rouge sur liste nominative
décroissante. **Jamais un `gardes.manifest.json` parallèle** : le jugement de #1475 (2026-08-23,
2 juges) l'a réfuté comme garde de SYNCHRONISATION (credo : « une seule source de vérité ») — la
déclaration vit au même endroit que le code qu'elle décrit. Chiffres réels à HEAD : 120 gardes =
8,3 % des fichiers de test, 31,7 % du temps cumulé (pas 148 / 41 % : ces chiffres datent d'avant le
lot perf `4effe0647`). Une indirection qui « exige des types » est une COUTURE MANQUANTE dans le
code (porte unique à créer), jamais une exception à tolérer — mais les 3 tests ESLint lancent la
config RÉELLE sur du code synthétique (preuve que la règle mord) et ne « migrent » pas. Lié :
[[user-doctrine-verrou-par-construction]], [[feedback-gardes-structurelles-pas-greps]],
[[feedback-un-detecteur-ne-mesure-que-sa-couverture]],
[[feedback-migrer-l-existant-listes-doivent-decroitre]], [[game-detecteur-reference-ancre-index-ids]].
