---
name: ajouter-une-donnee
description: À utiliser quand on ajoute ou cure une entrée dans un src/data/*.json (trapping, qualité, carrière, machine de guerre, trait naval, activité, critique, lieu…), ou dès qu'on est tenté d'ajouter un id/label sans avoir vérifié qu'il existe déjà ailleurs. Route vers le skill de domaine dédié si l'ajout est un sort, une créature, un effet mécanique, une icône ou un livre.
---

# Ajouter une donnée dans src/data

Lire **`docs/ajouter-une-donnee.md`** (déroulé) et **`docs/donnees.md`** (carte + conventions + pièges
d'homonymes). En un mot :

1. **CHECK-FIRST** : `grep -rniE '<id>|<label>|<concept>' src/data/*.json` — le concept vit peut-être déjà
   dans un AUTRE sous-système (incident #148 : le Bélier est dans 6 fichiers). S'il existe → ne duplique
   pas, étends-le ou re-scope.
2. **Router** : si c'est un sort / une créature / un effet mécanique / une icône / un livre → STOP, skill
   de domaine dédié. Sinon, choisir le fichier via la carte `docs/donnees.md` (une « machine de guerre »
   n'est PAS un trapping).
3. **Chaque champ = Source RAW ⊕ convention voisine** — jamais d'invention, jamais d'inflexion RAW
   silencieuse (issue #101+ ou valeur `maison` taguée).
4. **Canonicaliser via `serializeDataset`** + `npm test` + `npm run typecheck` verts ; recette navigateur
   si visible au Codex.
