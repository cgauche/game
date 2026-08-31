# Orphelines de données — GÉNÉRÉ

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-entity-orphans.mjs` (`npm run docs:orphelines`) — NE PAS ÉDITER À LA MAIN.
> Pour chaque catalogue `src/data/*.json` retenu, les entités qu'AUCUN autre `src/data/*.json`,
> AUCUN code de prod TypeScript (`.ts`/`.tsx`, hors tests) et AUCUN document de projet de scène
> (`*-projet.json` de `src/scenes` — le contenu JOUÉ) ne cite l'id en toutes lettres NI ne
> sélectionne par prédicat de champ (`catalogue.filter(...)`). Périmètre
> mesuré, angles morts déclarés, définition d'un consommateur : voir l'en-tête de
> `scripts/docs/build-entity-orphans.mjs`. Cliquet décroissant : `src/data/entity-orphans.test.ts`
> + `scripts/guards/lib/entityOrphanStock.mjs`.

## Catalogues ÉCARTÉS (angle mort structurel mesuré, pas couverts)

| Catalogue | Entités | Orphelines BRUTES (id seul) | Taux |
|---|---|---|---|
| `spells` | 576 | 278 | 48 % |
| `trappings` | 441 | 211 | 48 % |
| `creatures` | 493 | 353 | 72 % |

Chacun échappe à la détection par id pour une raison PROPRE : un Sort ne se cite pas par id en
prod (il s'obtient par Domaine / Talent de lanceur / `learnSpell` de scène — l'instrument juste
est `src/data/obtainability-guard.test.ts`) ; le stock marchand des `trappings` est bâti par
PRÉDICAT sur des catégories déclarées en donnée (`state/merchantFlow.ts`, hors grammaire MODE 2
— #1631) ; les `creatures` sont candidates au périmètre, non tranchées. Détail et mesure du
canal label (qui n'est PAS la cause) : en-tête de `scripts/docs/build-entity-orphans.mjs`.

## Catalogues MESURÉS

| Catalogue | Entités | Orphelines | Taux |
|---|---|---|---|
| `traits` | 132 | 7 | 5 % |
| `talents` | 187 | 5 | 3 % |
| `qualities` | 59 | 2 | 3 % |
| `maneuvers` | 20 | 0 | 0 % |
| `skills` | 48 | 1 | 2 % |
| `props` | 78 | 0 | 0 % |
| `vehicles` | 31 | 0 | 0 % |
| **Total** | **555** | **15** | — |

### `traits`

- `marque-de-tzeentch` — Marque de Tzeentch
- `absorption` — Absorption
- `amorphe` — Amorphe
- `contagieux` — Contagieux
- `decerebre` — Décérébré
- `voleur-de-chair` — Voleur de chair
- `aura-de-mort` — Aura de Mort

### `talents`

- `benediction-de-tzeentch` — Bénédiction de Tzeentch
- `disciple-du-changement` — Disciple du changement
- `double-vie` — Double vie
- `empreint-de-la-magie` — Empreint de la Magie
- `sang-neuf` — Sang Neuf

### `qualities`

- `filet-barbele` — Filet barbelé
- `deroutante` — Déroutante

### `skills`

- `hypnotisme` — Hypnotisme

