---
name: game-doc-derivee-jamais-ecrite-a-la-main
description: "Tout duplicata écrit à la main d'un fait vérifiable par la machine pourrit — le DÉRIVER, pas le garder ; patron canonique = docs/systemes.md (« jamais périmée »)"
metadata: 
  node_type: memory
  type: project
  originSessionId: f99ca0f7-6f7b-4bd6-9080-4fe86b48eb33
---

**Loi établie le 2026-07-15**, en réponse à la question utilisateur « comment éviter que cela se
reproduise ? » (audit de l'Atlas RAW, #434).

## Le constat qui la fonde

Le champ `**Implémente :**` de `docs/raw/*.md` est écrit À LA MAIN. Mesuré : **~40 marqueurs sur ~70
vérifiés déclaraient « non implémenté » une règle que le code implémente** (Empoignade, Poursuite,
Avantage de Groupe, Dispersion, combat naval, Critiques AA, Difficultés extrêmes EDO, Retenir ses
coups…). Un marqueur citait même un symbole FANTÔME (`deviateArmour`, 0 occurrence) pour déclarer absente
une règle câblée en donnée avec sa source exacte (`mutations.json`, `noDeviation: true`).

**Ce n'est pas de la négligence, c'est une loi** : un duplicata manuel d'un fait que la machine peut
vérifier pourrit. Toujours. Personne ne met à jour la prose quand il écrit le code — rien ne l'y force et
rien ne la lit.

## Le patron canonique existait DÉJÀ dans le repo

`docs/systemes.md` (#298), en-tête verbatim :

> ⚠️ Fichier **GÉNÉRÉ** par `node scripts/docs/build-systemes.mjs` (`npm run docs:systemes`) — **NE PAS
> ÉDITER À LA MAIN**. Source éditoriale (nom/périmètre/état/ticket) : `src/data/systemes.manifest.json`.
> La matrice ci-dessous est **CALCULÉE du graphe d'imports réel** (closure transitive des modules racines
> déclarés par système) — **jamais périmée**.

Le projet avait écrit la leçon. L'Atlas ne l'a jamais adoptée. `docs/raw/code-map.md` (« module → topics »,
prose manuelle) porte la MÊME maladie et pourrira pareil.

## La règle

**Avant d'écrire un champ de doc, demander : « la machine peut-elle le calculer ? »**
Si oui → le GÉNÉRER, avec un mode `--check` en CI (doc périmée = rouge). Jamais une garde qui vérifie de
la prose manuelle : ça double le travail au lieu de le supprimer.

Partage canonique (patron `systemes`) :
- **Éditorial, à la main** : ce que seule une décision humaine porte — le `#N` du ticket, l'état, le
  périmètre.
- **Calculé** : tout le reste — quels modules, quelles réfs, atteignabilité.

## Application à l'Atlas (#434)

Le code porte déjà sa vérité terrain : **2927 réfs RAW canoniques + 530 en forme `ch.`** en commentaires.
« Qu'est-ce que le code implémente » est donc CALCULABLE :
- `Implémente` d'un topic = les fichiers de `src/` citant les réfs du topic → généré.
- Topic marqué `dette #N` alors que le code cite la réf → **contradiction → exit 1**.
- Réf citée dans un fichier jamais atteint par le graphe d'imports → **`code mort`**, pas `implémenté`
  (3 cas navals réels : survitesse, périls, détroits — écrits, jamais appelés).
- ⚠ **Prérequis non négociable** : normaliser les réfs `ch.NN` → `NN` (530 réfs, 175 fichiers) — sinon la
  dérivation est aveugle sur ~15 % du code (`_lib.mjs` `ldbRe`/`otherRe` ne matchent que `LIVRE NN l.X`).

Machinerie déjà présente, rien à inventer : `build-systemes.mjs` (closure transitive),
`scripts/guards/lib/importGraph.mjs`, `reconcile.mjs` (map chapitre→réfs du code).

Voir aussi [[feedback-jamais-de-constat-silencieux]] (la garde qui compte sans gater),
[[feedback-gardes-structurelles-pas-greps]], [[game-exhaustive-guard-vs-per-domain]].
