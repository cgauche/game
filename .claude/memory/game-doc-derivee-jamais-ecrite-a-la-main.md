---
name: game-doc-derivee-jamais-ecrite-a-la-main
description: "Tout duplicata écrit à la main d'un fait vérifiable par la machine pourrit — le DÉRIVER, pas le garder ; patron canonique = docs/systemes.md (« jamais périmée »)"
metadata: 
  node_type: memory
  type: project
  originSessionId: f99ca0f7-6f7b-4bd6-9080-4fe86b48eb33
  modified: 2026-07-27T09:29:04.914Z
---

**Loi établie le 2026-07-15**, en réponse à la question utilisateur « comment éviter que cela se
reproduise ? » (audit de l'Atlas RAW, #434).

## GÉNÉRALISÉE À TOUT — arbitrage utilisateur 2026-07-27 (verbatim)

> « La documentation doit etre généré, jamais écrite a la main (vu qu'elle va périmer tres
> rapidement), depuis le code lui même comme on a fait pour Op/Flow. Ca doit etre généralisé
> pour tout. Et si cela demande de la discipline dans le code, on mettra de la discipline et
> des guards pour s'assurer que c'est respecté. »

Cadrage donné par l'utilisateur dans le même échange : « L'application va de plus en plus grossir,
on intégré enormement de système qui au fur et a mesure se complexifie, la documentation c'est ce
qui permet d'exposer des informations pertinentes a un agent. »

**La doc n'est pas du confort pour humains : c'est l'INDEX que lit l'agent.** Ce qui n'y est pas
n'est pas « difficile à trouver », c'est INVISIBLE — l'agent cherche au mot-clef, ne trouve rien,
et conclut à l'absence. Vécu 2026-07-27, trois fois dans la même journée : le tirage de Carrière
par BORNES PARTAGÉES (`rollCareer` renvoie `ids` au pluriel, `creation.ts:81`) est en service depuis
trois livres et **13 cases partagées** sur la seule colonne humaine — exposé par zéro référence
vivante. J'ai déclaré la couture inexistante, et un grounding dépêché l'a confirmé à tort.

État mesuré au 2026-07-27 : **3 docs générés sur 26** (`systemes.md`, `vocabulaire-mecanique.md`,
`campagne-effects.md`, plus les champs `Implémente` de `docs/raw/`). ~330 Ko de prose manuelle.

**Corollaire du « si ça demande de la discipline »** : quand un fait n'est pas dérivable en l'état,
la réponse n'est PAS « ce doc restera manuel » — c'est de rendre le code auto-descriptif (annotation
structurée, manifeste éditorial à côté du calculé, graphie de réf non négociable) puis de le dériver.
Le partage reste celui du patron `systemes` : éditorial à la main (le `#N`, l'état, le périmètre),
calculé pour tout le reste. Programme : #903.

## Le constat qui la fonde

Un champ `**Implémente :**` tenu À LA MAIN ment vite. Mesuré sur `docs/raw/*.md` (#434) : **~40
marqueurs sur ~70 vérifiés déclaraient « non implémenté » une règle que le code implémente** (Empoignade, Poursuite,
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

Le projet avait écrit la leçon ; l'Atlas l'applique depuis #487 — le champ `Implémente` des fiches est
GÉNÉRÉ (`npm run raw:implemente`), jamais écrit à la main, et `npm run docs:check` le gate.

## La règle

**Avant d'écrire un champ de doc, demander : « la machine peut-elle le calculer ? »**
Si oui → le GÉNÉRER, avec un mode `--check` en CI (doc périmée = rouge). Jamais une garde qui vérifie de
la prose manuelle : ça double le travail au lieu de le supprimer.

Partage canonique (patron `systemes`) :
- **Éditorial, à la main** : ce que seule une décision humaine porte — le `#N` du ticket, l'état, le
  périmètre.
- **Calculé** : tout le reste — quels modules, quelles réfs, atteignabilité.

## Application à l'Atlas (#434)

Le code porte déjà sa vérité terrain : **2927 réfs RAW canoniques** en commentaires.
« Qu'est-ce que le code implémente » est donc CALCULABLE :
- `Implémente` d'un topic = les fichiers de `src/` citant les réfs du topic → généré.
- Topic marqué `dette #N` alors que le code cite la réf → **contradiction → exit 1**.
- Réf citée dans un fichier jamais atteint par le graphe d'imports → **`code mort`**, pas `implémenté`
  (3 cas navals réels : survitesse, périls, détroits — écrits, jamais appelés).
- ⚠ **Graphie non négociable** : une réf s'écrit `LIVRE NN l.X` — c'est la SEULE forme que `_lib.mjs`
  (`ldbRe`/`otherRe`) matche ; une réf en `ch.NN` est INVISIBLE de la dérivation, qui devient alors aveugle
  sur la part de code concernée. Cliquet en place : la famille `chDot` de `scripts/raw/graphy-baseline.json`
  est à **0** — toute nouvelle occurrence échoue la garde de graphie.

Machinerie déjà présente, rien à inventer : `build-systemes.mjs` (closure transitive),
`scripts/guards/lib/importGraph.mjs`, `reconcile.mjs` (map chapitre→réfs du code).

Voir aussi [[feedback-jamais-de-constat-silencieux]] (la garde qui compte sans gater),
[[feedback-gardes-structurelles-pas-greps]], [[game-exhaustive-guard-vs-per-domain]].
