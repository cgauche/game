# Ajouter / curer une donnée dans `src/data/*.json`

Guide de la donnée app-owned « générique » (trapping, qualité, carrière, structure, machine de guerre,
trait naval, activité, critique, lieu…). La **carte** de où-vit-quoi et les conventions de champs vivent
dans **`docs/donnees.md`** ; ce guide est le **déroulé**. Motivé par l'incident #148 (doublon + mauvaise
lecture de source par un agent).

## 0. D'abord : router vers le skill de domaine

Si ton ajout tombe dans une de ces familles, **STOP** — le skill dédié couvre le rig / les canaux
d'effet / la résolution que ce guide générique ne connaît pas :

| Tu ajoutes… | Skill | (donnée) |
|---|---|---|
| un **sort**, une bénédiction, un miracle | `ajouter-un-sort` | `spells.json` |
| une **créature**, un PNJ, une race/tenue | `creer-une-creature` | `creatures.json`, `species.json` |
| l'**effet mécanique** d'un trait/talent/qualité/mutation/maladie/atout | `ajouter-une-mecanique` | `passive`/`effects`/`capabilities` |
| une **icône** d'affordance | `ajouter-une-icone` | (registre `Icon`) |
| un **livre source** entier | `ajouter-un-livre-source` | `books.json` + Atlas RAW |

Sinon (le RESTE de `src/data`), suis le déroulé ci-dessous.

## 1. CHECK-FIRST (anti-doublon) — non négociable

```
grep -rniE '<id-candidat>|<label>|<concept>' src/data/*.json
```

Le concept vit peut-être **déjà** dans un autre sous-système (#148 : le Bélier est dans 6 fichiers). S'il
existe → **ne duplique pas** : étends-le là où il vit, ou re-scope la tâche. Détail : `docs/donnees.md`
§C + §D (pièges d'homonymes).

## 2. Choisir le fichier

Via la carte `docs/donnees.md` §A. **Règle d'or** : une « machine de guerre / véhicule / navire » n'est
PAS un `trappings`. En cas d'ambiguïté, lire 2-3 entrées voisines des fichiers candidats (leur forme fait
foi : tableau plat `{id}` vs objet à sous-catalogues vs table d100).

## 3. Vérifier la source RAW

Ouvrir le `Source/…` (FR uniquement — jamais la VO), lire le **tableau ET son en-tête** (l'erreur #148 =
la colonne « Équipe » lue comme « Encombrement »). Citer `<LIVRE> <chap> l.<ligne>` dans le commentaire de
commit / l'issue. ⚠ Le n° de ligne a dérivé (ré-extraction Marker) ET les ancres `<span id="page-N">` sont
**non fiables** : n'en déduis jamais une `source.page`.

## 4. Chaque champ = Source ⊕ convention voisine

Conventions complètes : `docs/donnees.md` §B. En bref : `book` = l'`abr` de `src/data/books.json`
(`grep '"book"'` les voisins — ex. `ADE2`, jamais `ADE II`) ; `page` = vraie page ; `desc` = **verbatim**
Markdown (garde `no-html-in-prose`) ; formes de champ (`damage:{plusBF,flat}`, `qualities:[{id}]`) copiées
des voisins ; logique keyée par **id stable**, `label` = affichage.

## 5. Zéro invention, zéro inflexion RAW

Un champ introuvable au Source → omission assumée (pas une valeur inventée). Une **mécanique RAW que le
moteur ne modélise pas** → ce n'est pas « hors scope » : c'est une dette → **issue au gabarit #101+** (ou
une valeur `maison` taguée si le RAW laissait le choix au MJ — house-rule ≠ lacune). JAMAIS un choix
d'agent silencieux enterré.

## 6. Canonicaliser + gardes

- Canonicaliser via `serializeDataset` (`src/data/serialize.ts`) — jamais un reformatage manuel ni un
  `JSON.stringify` maison (casserait `serialize.test.ts`, byte-exact).
- `npm test` (dont `serialize`, `no-html-in-prose`, `id-collisions`, `data-atlas-complete`) + `npm run
  typecheck` verts.
- Si l'élément est visible au Codex/éditeur → **recette navigateur** (`docs/recette-navigateur.md`).

## Fichiers clés

- `docs/donnees.md` — carte des données + conventions + pièges d'homonymes.
- `src/data/books.json` — registre canonique des abréviations de livre (`abr`).
- `src/data/serialize.ts` — `serializeDataset` (format canonique).
- `src/data/id-collisions.test.ts` — hygiène des ids (collisions inter-catalogues verrouillées).
- `src/data/data-atlas-complete.test.ts` — garde de complétude de l'atlas.

## Gardes

- `src/data/serialize.test.ts` — round-trip byte-exact de chaque dataset.
- `src/data/no-html-in-prose.test.ts` — prose en Markdown, jamais HTML.
- `src/data/id-collisions.test.ts` — unicité intra-catalogue + collisions inter-catalogues = ensemble voulu.
- `src/data/data-atlas-complete.test.ts` — tout `src/data/*.json` cartographié dans `docs/donnees.md`.
- Hook `scripts/hooks/data-edit-guard.mjs` — rappel de check-first à chaque écriture d'un `src/data/*.json`
  (atteint aussi les sous-agents, où les skills ne se déclenchent pas).
